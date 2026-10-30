import type { APIRoute } from 'astro';
import { waitUntil } from '@vercel/functions';
import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizeOpportunityCaptureUrl } from '../../../../lib/opportunities/captureUrl';
import {
    captureJobToPublic,
    enqueueOpportunityCaptureJob,
    OPPORTUNITY_CAPTURE_FILES_BUCKET,
    processOpportunityCaptureJobs,
    PUBLIC_CAPTURE_JOB_SELECT,
    type OpportunityCaptureAttachment,
    type OpportunityCaptureInputKind,
    type OpportunityCaptureJobPayload,
    type OpportunityCaptureJobRow,
} from '../../../../lib/opportunities/captureJobs';
import {
    OPPORTUNITY_CAPTURE_MAX_TEXT_CHARS,
    OpportunityInputExtractionError,
    validateOpportunityAttachmentMetadata,
} from '../../../../lib/opportunities/inputExtractionService';
import { authorizeOpportunityRequest, opportunityJson } from '../../../../lib/opportunities/userAuth';

export const prerender = false;
export const maxDuration = 300;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const UPLOAD_RECEIPT_TTL_MS = 60 * 60 * 1000;
const UNAVAILABLE_CODES = new Set(['42P01', '42703', 'PGRST204', 'PGRST205']);

type RequestedAttachment = { name: string; type: string; size: number };

const extensionForName = (name: string) => {
    const extension = name.toLowerCase().split('.').pop() || '';
    return /^[a-z0-9]{1,10}$/.test(extension) ? `.${extension}` : '';
};

const requestedAttachments = (value: unknown): RequestedAttachment[] => {
    if (!Array.isArray(value)) return [];
    return value.map((entry) => {
        const attachment = typeof entry === 'object' && entry !== null
            ? entry as Record<string, unknown>
            : {};
        return {
            name: typeof attachment.name === 'string' ? attachment.name.slice(0, 160) : '',
            type: typeof attachment.type === 'string' ? attachment.type.slice(0, 160) : '',
            size: Number(attachment.size) || 0,
        };
    });
};

const createUploadTargets = async (
    serviceClient: SupabaseClient,
    attachments: OpportunityCaptureAttachment[],
) => {
    const uploads = [];
    for (const attachment of attachments) {
        const { data, error } = await serviceClient.storage
            .from(OPPORTUNITY_CAPTURE_FILES_BUCKET)
            .createSignedUploadUrl(attachment.path);
        if (error || !data?.token) throw error || new Error('Could not create a secure upload');
        uploads.push({
            path: attachment.path,
            token: data.token,
            name: attachment.name,
            type: attachment.type,
            size: attachment.size,
        });
    }
    return uploads;
};

const findExistingJob = async (
    userClient: SupabaseClient,
    userId: string,
    idempotencyKey: string,
) => {
    const { data, error } = await userClient
        .from('opportunity_capture_jobs')
        .select(PUBLIC_CAPTURE_JOB_SELECT)
        .eq('user_id', userId)
        .eq('idempotency_key', idempotencyKey)
        .maybeSingle();
    return { job: data as unknown as OpportunityCaptureJobRow | null, error };
};

export const GET: APIRoute = async ({ request }) => {
    const authorization = await authorizeOpportunityRequest(request);
    if (!authorization.ok) return authorization.response;

    const requestUrl = new URL(request.url);
    const requestedLimit = Number(requestUrl.searchParams.get('limit')) || 10;
    const limit = Math.min(25, Math.max(1, requestedLimit));
    const { data, error } = await authorization.userClient
        .from('opportunity_capture_jobs')
        .select(PUBLIC_CAPTURE_JOB_SELECT)
        .eq('user_id', authorization.user.id)
        .order('created_at', { ascending: false })
        .limit(limit);

    if (error) {
        const unavailable = UNAVAILABLE_CODES.has(error.code || '');
        return opportunityJson({
            error: unavailable ? 'Background capture is not configured yet' : 'Capture history could not be loaded',
            code: unavailable ? 'CAPTURE_JOBS_NOT_CONFIGURED' : 'CAPTURE_JOBS_LOAD_FAILED',
        }, unavailable ? 503 : 500);
    }

    return opportunityJson({
        jobs: ((data || []) as unknown as OpportunityCaptureJobRow[]).map(captureJobToPublic),
    });
};

export const POST: APIRoute = async ({ request }) => {
    const authorization = await authorizeOpportunityRequest(request);
    if (!authorization.ok) return authorization.response;

    const body = await request.json().catch(() => ({}));
    const idempotencyKey = typeof body.idempotency_key === 'string' && UUID_PATTERN.test(body.idempotency_key)
        ? body.idempotency_key
        : crypto.randomUUID();
    const channel = body.channel === 'extension' ? 'extension' : 'dashboard';
    const text = typeof body.text === 'string'
        ? body.text.trim().slice(0, OPPORTUNITY_CAPTURE_MAX_TEXT_CHARS)
        : '';
    const attachmentRequests = requestedAttachments(body.attachments);

    if (text.length > 0 && text.length < 3 && attachmentRequests.length === 0) {
        return opportunityJson({
            error: 'Add a little more detail before capturing this note.',
            code: 'EMPTY_CAPTURE',
        }, 400);
    }

    try {
        validateOpportunityAttachmentMetadata(attachmentRequests);
    } catch (error) {
        if (error instanceof OpportunityInputExtractionError) {
            return opportunityJson({ error: error.message, code: error.code }, error.status);
        }
        return opportunityJson({ error: 'The attachment details are invalid' }, 400);
    }

    const existingResult = await findExistingJob(
        authorization.userClient,
        authorization.user.id,
        idempotencyKey,
    );
    if (existingResult.error) {
        const unavailable = UNAVAILABLE_CODES.has(existingResult.error.code || '');
        if (!unavailable) return opportunityJson({ error: 'Capture history could not be checked' }, 500);
    }
    if (existingResult.job) {
        const existingAttachments = Array.isArray(existingResult.job.payload.attachments)
            ? existingResult.job.payload.attachments
            : [];
        const uploads = existingResult.job.status === 'uploading'
            ? await createUploadTargets(authorization.serviceClient, existingAttachments)
            : [];
        return opportunityJson({
            accepted: existingResult.job.status !== 'uploading',
            job: captureJobToPublic(existingResult.job),
            uploads,
        }, 202);
    }

    const capturedAt = typeof body.captured_at === 'string' ? body.captured_at : new Date().toISOString();
    const captureTimezone = typeof body.capture_timezone === 'string'
        ? body.capture_timezone.slice(0, 100)
        : 'UTC';
    const jobId = crypto.randomUUID();
    let inputKind: OpportunityCaptureInputKind;
    let payload: OpportunityCaptureJobPayload;
    let attachmentDescriptors: OpportunityCaptureAttachment[] = [];

    if (attachmentRequests.length > 0) {
        inputKind = text ? 'mixed' : 'attachments';
        attachmentDescriptors = attachmentRequests.map((attachment) => ({
            ...attachment,
            path: `${authorization.user.id}/${jobId}/${crypto.randomUUID()}${extensionForName(attachment.name)}`,
        }));
        payload = {
            text,
            mode: text.length < 50 ? 'note' : 'text',
            attachments: attachmentDescriptors,
            captured_at: capturedAt,
            capture_timezone: captureTimezone,
        };
    } else if (text) {
        inputKind = 'text';
        payload = {
            text,
            mode: text.length < 50 ? 'note' : 'text',
            captured_at: capturedAt,
            capture_timezone: captureTimezone,
        };
    } else {
        const url = typeof body.url === 'string' ? body.url.trim() : '';
        let normalizedUrl: string;
        try {
            normalizedUrl = normalizeOpportunityCaptureUrl(url).sourceUrl;
        } catch {
            return opportunityJson({ error: 'Enter a valid HTTP or HTTPS URL', code: 'INVALID_URL' }, 400);
        }
        inputKind = 'url';
        payload = {
            url: normalizedUrl,
            title: typeof body.title === 'string' ? body.title.slice(0, 500) : '',
            page_text: typeof body.page_text === 'string'
                ? body.page_text.slice(0, OPPORTUNITY_CAPTURE_MAX_TEXT_CHARS)
                : '',
            captured_at: capturedAt,
            capture_timezone: captureTimezone,
        };
    }

    const uploading = attachmentDescriptors.length > 0;
    let job: OpportunityCaptureJobRow;
    try {
        const result = await enqueueOpportunityCaptureJob({
            client: authorization.serviceClient,
            userId: authorization.user.id,
            idempotencyKey,
            channel,
            inputKind,
            payload,
            status: uploading ? 'uploading' : 'pending',
            jobId,
            sourceCleanupAt: uploading
                ? new Date(Date.now() + UPLOAD_RECEIPT_TTL_MS).toISOString()
                : null,
        });
        job = result.job;
    } catch (error) {
        const code = typeof error === 'object' && error !== null && 'code' in error
            ? String(error.code || '')
            : '';
        const unavailable = UNAVAILABLE_CODES.has(code) || code === '23514';
        return opportunityJson({
            error: unavailable
                ? 'Background capture is not configured for this input yet.'
                : 'The capture could not be safely recorded',
            code: unavailable ? 'CAPTURE_JOBS_NOT_CONFIGURED' : 'CAPTURE_JOB_CREATE_FAILED',
        }, unavailable ? 503 : 500);
    }

    let uploads: Awaited<ReturnType<typeof createUploadTargets>> = [];
    if (job.status === 'uploading') {
        try {
            uploads = await createUploadTargets(
                authorization.serviceClient,
                Array.isArray(job.payload.attachments) ? job.payload.attachments : [],
            );
        } catch (uploadError) {
            await authorization.serviceClient
                .from('opportunity_capture_jobs')
                .delete()
                .eq('id', job.id)
                .eq('user_id', authorization.user.id);
            console.error('Opportunity signed upload creation failed', uploadError);
            return opportunityJson({ error: 'Secure attachment upload could not be prepared' }, 500);
        }
    } else if (job.status === 'pending') {
        waitUntil(processOpportunityCaptureJobs({
            jobId: job.id,
            limit: 1,
            serviceClient: authorization.serviceClient,
        }));
    }

    return opportunityJson({
        accepted: job.status !== 'uploading',
        job: captureJobToPublic(job),
        uploads,
    }, job.status === 'succeeded' ? 200 : 202);
};
