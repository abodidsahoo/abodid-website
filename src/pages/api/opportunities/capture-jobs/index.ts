import type { APIRoute } from 'astro';
import { waitUntil } from '@vercel/functions';
import { normalizeOpportunityCaptureUrl } from '../../../../lib/opportunities/captureUrl';
import {
    captureJobToPublic,
    processOpportunityCaptureJobs,
    PUBLIC_CAPTURE_JOB_SELECT,
    type OpportunityCaptureJobRow,
} from '../../../../lib/opportunities/captureJobs';
import { authorizeOpportunityRequest, opportunityJson } from '../../../../lib/opportunities/userAuth';

export const prerender = false;
export const maxDuration = 300;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
        const unavailable = ['42P01', 'PGRST204', 'PGRST205'].includes(error.code || '');
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
    const url = typeof body.url === 'string' ? body.url.trim() : '';

    let normalizedUrl: string;
    try {
        normalizedUrl = normalizeOpportunityCaptureUrl(url).sourceUrl;
    } catch {
        return opportunityJson({ error: 'Enter a valid HTTP or HTTPS URL', code: 'INVALID_URL' }, 400);
    }

    const payload = {
        url: normalizedUrl,
        title: typeof body.title === 'string' ? body.title.slice(0, 500) : '',
        page_text: typeof body.page_text === 'string' ? body.page_text.slice(0, 100_000) : '',
        captured_at: typeof body.captured_at === 'string' ? body.captured_at : new Date().toISOString(),
        capture_timezone: typeof body.capture_timezone === 'string' ? body.capture_timezone.slice(0, 100) : 'UTC',
    };

    const { data, error } = await authorization.userClient
        .from('opportunity_capture_jobs')
        .insert({
            user_id: authorization.user.id,
            idempotency_key: idempotencyKey,
            channel,
            input_kind: 'url',
            payload,
        })
        .select(PUBLIC_CAPTURE_JOB_SELECT)
        .single();

    let job = data as unknown as OpportunityCaptureJobRow | null;
    if (error?.code === '23505') {
        const { data: existing, error: existingError } = await authorization.userClient
            .from('opportunity_capture_jobs')
            .select(PUBLIC_CAPTURE_JOB_SELECT)
            .eq('user_id', authorization.user.id)
            .eq('idempotency_key', idempotencyKey)
            .single();
        if (existingError || !existing) {
            return opportunityJson({ error: 'The existing capture receipt could not be loaded' }, 500);
        }
        job = existing as unknown as OpportunityCaptureJobRow;
    } else if (error || !job) {
        const unavailable = ['42P01', 'PGRST204', 'PGRST205'].includes(error?.code || '');
        return opportunityJson({
            error: unavailable
                ? 'Background capture is not configured yet. Apply the latest Supabase migration first.'
                : 'The capture could not be safely recorded',
            code: unavailable ? 'CAPTURE_JOBS_NOT_CONFIGURED' : 'CAPTURE_JOB_CREATE_FAILED',
        }, unavailable ? 503 : 500);
    }

    if (job.status === 'pending') {
        waitUntil(processOpportunityCaptureJobs({
            jobId: job.id,
            limit: 1,
            serviceClient: authorization.serviceClient,
        }));
    }

    return opportunityJson({
        accepted: true,
        job: captureJobToPublic(job),
    }, job.status === 'succeeded' ? 200 : 202);
};
