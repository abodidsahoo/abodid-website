import { consumeOpportunityAiLimit } from './rateLimit';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseServiceClient } from '../supabaseServer';
import { AudioTranscriptionError, transcribeAudio } from '../audio/transcribeAudio';
import {
    downloadTelegramFile,
    TelegramApiError,
    type TelegramFileDescriptor,
} from '../integrations/telegram';
import { notifyTelegramCaptureResult } from '../integrations/telegramDelivery';
import {
    captureOpportunityFromUrl,
    OpportunityCaptureError,
    type OpportunityUrlCaptureInput,
} from './captureService';
import {
    createOpportunityFromPayload,
    OpportunityCreateError,
} from './createOpportunityService';
import {
    extractOpportunityFromInput,
    OpportunityInputExtractionError,
} from './inputExtractionService';
import { buildExtractedOpportunityPayload } from './unifiedInput';

export const OPPORTUNITY_CAPTURE_FILES_BUCKET = 'opportunity-capture-files';
const FINAL_FAILURE_SOURCE_RETENTION_MS = 24 * 60 * 60 * 1000;

export type OpportunityCaptureJobStatus = 'uploading' | 'pending' | 'processing' | 'succeeded' | 'failed';
export type OpportunityCaptureInputKind = 'url' | 'text' | 'attachments' | 'mixed';

export type OpportunityCaptureAttachment = {
    path: string;
    name: string;
    type: string;
    size: number;
    kind?: 'document' | 'image' | 'voice';
    telegram_file_unique_id?: string;
};

export type OpportunityCaptureJobPayload = Partial<OpportunityUrlCaptureInput> & {
    text?: string;
    mode?: 'note' | 'text';
    attachments?: OpportunityCaptureAttachment[];
    telegram_files?: TelegramFileDescriptor[];
};

export type OpportunityCaptureJobRow = {
    id: string;
    user_id: string;
    idempotency_key: string;
    channel: 'dashboard' | 'extension' | 'telegram' | 'whatsapp';
    input_kind: OpportunityCaptureInputKind;
    status: OpportunityCaptureJobStatus;
    payload: OpportunityCaptureJobPayload;
    attempt_count: number;
    max_attempts: number;
    available_at: string;
    locked_at: string | null;
    started_at: string | null;
    completed_at: string | null;
    opportunity_id: string | null;
    is_duplicate: boolean;
    error_code: string | null;
    error_message: string | null;
    source_cleanup_at: string | null;
    source_cleaned_at: string | null;
    messaging_event_id: string | null;
    created_at: string;
    updated_at: string;
};

export const PUBLIC_CAPTURE_JOB_SELECT = [
    'id',
    'user_id',
    'idempotency_key',
    'channel',
    'input_kind',
    'status',
    'payload',
    'attempt_count',
    'max_attempts',
    'available_at',
    'started_at',
    'completed_at',
    'opportunity_id',
    'is_duplicate',
    'error_code',
    'error_message',
    'source_cleanup_at',
    'source_cleaned_at',
    'messaging_event_id',
    'created_at',
    'updated_at',
].join(', ');

const captureSourceTitle = (job: OpportunityCaptureJobRow) => {
    if (typeof job.payload?.title === 'string' && job.payload.title.trim()) return job.payload.title;
    const names = Array.isArray(job.payload?.attachments)
        ? job.payload.attachments.map((attachment) => attachment.name).filter(Boolean)
        : [];
    if (names.length > 0) return names.join(', ').slice(0, 500);
    if (job.input_kind === 'text') return 'Pasted note';
    return null;
};

export const captureJobToPublic = (job: OpportunityCaptureJobRow) => ({
    id: job.id,
    idempotency_key: job.idempotency_key,
    channel: job.channel,
    input_kind: job.input_kind,
    status: job.status,
    source_url: typeof job.payload?.url === 'string' ? job.payload.url : null,
    source_title: captureSourceTitle(job),
    attempt_count: job.attempt_count,
    max_attempts: job.max_attempts,
    available_at: job.available_at,
    started_at: job.started_at,
    completed_at: job.completed_at,
    opportunity_id: job.opportunity_id,
    is_duplicate: job.is_duplicate,
    error_code: job.error_code,
    error_message: job.error_message,
    source_cleanup_at: job.source_cleanup_at,
    source_cleaned_at: job.source_cleaned_at,
    created_at: job.created_at,
    updated_at: job.updated_at,
});

export const enqueueOpportunityCaptureJob = async ({
    client,
    userId,
    idempotencyKey,
    channel,
    inputKind,
    payload,
    status = 'pending',
    jobId = crypto.randomUUID(),
    sourceCleanupAt = null,
    messagingEventId = null,
}: {
    client: SupabaseClient;
    userId: string;
    idempotencyKey: string;
    channel: OpportunityCaptureJobRow['channel'];
    inputKind: OpportunityCaptureInputKind;
    payload: OpportunityCaptureJobPayload;
    status?: OpportunityCaptureJobStatus;
    jobId?: string;
    sourceCleanupAt?: string | null;
    messagingEventId?: string | null;
}) => {
    const { data, error } = await client
        .from('opportunity_capture_jobs')
        .insert({
            id: jobId,
            user_id: userId,
            idempotency_key: idempotencyKey,
            channel,
            input_kind: inputKind,
            status,
            // One worker attempt per submission. The extractor already has
            // a bounded retry for genuinely transient provider failures.
            max_attempts: 1,
            payload,
            source_cleanup_at: sourceCleanupAt,
            messaging_event_id: messagingEventId,
        })
        .select(PUBLIC_CAPTURE_JOB_SELECT)
        .single();
    if (!error && data) return { job: data as unknown as OpportunityCaptureJobRow, existing: false };
    if (error?.code !== '23505') throw error || new Error('The capture could not be safely recorded.');
    let query = client
        .from('opportunity_capture_jobs')
        .select(PUBLIC_CAPTURE_JOB_SELECT)
        .eq('user_id', userId);
    query = messagingEventId
        ? query.eq('messaging_event_id', messagingEventId)
        : query.eq('idempotency_key', idempotencyKey);
    const { data: existing, error: existingError } = await query.maybeSingle();
    if (existingError || !existing) {
        throw existingError || new Error('The existing capture receipt could not be loaded.');
    }
    return { job: existing as unknown as OpportunityCaptureJobRow, existing: true };
};

const redactCapturePayload = (
    payload: OpportunityCaptureJobPayload,
    keepAttachments = false,
): OpportunityCaptureJobPayload => ({
    url: typeof payload.url === 'string' ? payload.url.slice(0, 4096) : '',
    title: typeof payload.title === 'string' ? payload.title.slice(0, 500) : '',
    captured_at: typeof payload.captured_at === 'string' ? payload.captured_at : undefined,
    capture_timezone: typeof payload.capture_timezone === 'string'
        ? payload.capture_timezone.slice(0, 100)
        : undefined,
    ...(keepAttachments && Array.isArray(payload.attachments)
        ? { attachments: payload.attachments }
        : {}),
});

const attachmentsFromPayload = (payload: OpportunityCaptureJobPayload) => (
    Array.isArray(payload.attachments)
        ? payload.attachments.filter((attachment) => attachment?.path)
        : []
);

const removeCaptureAttachments = async (
    serviceClient: SupabaseClient,
    attachments: OpportunityCaptureAttachment[],
) => {
    if (attachments.length === 0) return;
    const { error } = await serviceClient.storage
        .from(OPPORTUNITY_CAPTURE_FILES_BUCKET)
        .remove(attachments.map((attachment) => attachment.path));
    if (error) throw error;
};

const downloadCaptureAttachments = async (
    serviceClient: SupabaseClient,
    attachments: OpportunityCaptureAttachment[],
) => Promise.all(attachments.map(async (attachment) => {
    const { data, error } = await serviceClient.storage
        .from(OPPORTUNITY_CAPTURE_FILES_BUCKET)
        .download(attachment.path);
    if (error || !data) throw error || new Error(`Could not load ${attachment.name}`);
    return new File([data], attachment.name, { type: attachment.type || data.type });
}));

const extensionForAttachment = (attachment: TelegramFileDescriptor) => {
    const extension = attachment.name.toLowerCase().split('.').pop() || '';
    return /^[a-z0-9]{1,10}$/.test(extension) ? `.${extension}` : '';
};

const prepareTelegramAttachments = async (
    serviceClient: SupabaseClient,
    job: OpportunityCaptureJobRow,
) => {
    const telegramFiles = Array.isArray(job.payload.telegram_files) ? job.payload.telegram_files : [];
    if (telegramFiles.length === 0) return;
    const attachments: OpportunityCaptureAttachment[] = [...attachmentsFromPayload(job.payload)];
    for (const telegramFile of telegramFiles) {
        if (attachments.some((attachment) => attachment.telegram_file_unique_id === telegramFile.file_unique_id)) {
            continue;
        }
        const bytes = await downloadTelegramFile(telegramFile);
        const safeUniqueId = telegramFile.file_unique_id.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 100)
            || crypto.randomUUID();
        const path = `${job.user_id}/${job.id}/telegram-${safeUniqueId}${extensionForAttachment(telegramFile)}`;
        const { error } = await serviceClient.storage
            .from(OPPORTUNITY_CAPTURE_FILES_BUCKET)
            .upload(path, bytes, {
                contentType: telegramFile.type,
                upsert: true,
            });
        if (error) throw error;
        attachments.push({
            path,
            name: telegramFile.name,
            type: telegramFile.type,
            size: bytes.byteLength,
            kind: telegramFile.kind,
            telegram_file_unique_id: telegramFile.file_unique_id,
        });
        job.payload = { ...job.payload, attachments };
        const { error: progressError } = await serviceClient
            .from('opportunity_capture_jobs')
            .update({ payload: job.payload })
            .eq('id', job.id)
            .eq('user_id', job.user_id);
        if (progressError) throw progressError;
    }
    const { telegram_files: _telegramFiles, ...remainingPayload } = job.payload;
    job.payload = { ...remainingPayload, attachments };
    const { error } = await serviceClient
        .from('opportunity_capture_jobs')
        .update({ payload: job.payload })
        .eq('id', job.id)
        .eq('user_id', job.user_id);
    if (error) throw error;
};

const errorStatus = (error: unknown) => {
    if (error instanceof OpportunityCaptureError
        || error instanceof OpportunityInputExtractionError
        || error instanceof OpportunityCreateError
        || error instanceof AudioTranscriptionError
        || error instanceof TelegramApiError) return error.status;
    return 500;
};

const errorCode = (error: unknown) => {
    if (error instanceof OpportunityCaptureError
        || error instanceof OpportunityInputExtractionError
        || error instanceof OpportunityCreateError
        || error instanceof AudioTranscriptionError
        || error instanceof TelegramApiError) return error.code;
    return 'CAPTURE_FAILED';
};

const isRetryableCaptureError = (error: unknown) => {
    if (['AI_MONTHLY_LIMIT_REACHED', 'EXTRACTION_FAILED', 'EXTRACTION_TRUNCATED',
        'INPUT_EXTRACTION_FAILED', 'SAVED_CAPACITY_REACHED',
    ].includes(errorCode(error))) return false;
    const status = errorStatus(error);
    return status === 429 || status >= 500;
};

const processCapturedInput = async (
    serviceClient: SupabaseClient,
    job: OpportunityCaptureJobRow,
) => {
    if (job.input_kind === 'url') {
        const result = await captureOpportunityFromUrl({
            userId: job.user_id,
            userClient: serviceClient,
            serviceClient,
            input: {
                ...job.payload,
                url: typeof job.payload.url === 'string' ? job.payload.url : '',
            },
        });
        return {
            opportunityId: result.opportunity.id,
            isDuplicate: result.is_duplicate,
        };
    }

    await prepareTelegramAttachments(serviceClient, job);
    const attachmentDescriptors = attachmentsFromPayload(job.payload);
    const attachments = await downloadCaptureAttachments(serviceClient, attachmentDescriptors);
    const audioAttachments = attachments.filter((attachment) => attachment.type.startsWith('audio/'));
    const readableAttachments = attachments.filter((attachment) => !attachment.type.startsWith('audio/'));
    const allowance = await consumeOpportunityAiLimit(serviceClient, job.user_id);
    if (!allowance.allowed) throw new OpportunityInputExtractionError(
        allowance.message || 'Processing is temporarily unavailable. Please try again shortly.',
        allowance.unavailable ? 503 : allowance.status || 429,
        allowance.code || 'CAPTURE_QUOTA_UNAVAILABLE', allowance.retryAfter);
    let extraction: Awaited<ReturnType<typeof extractOpportunityFromInput>>;
    let capturedText = '';
    try {
    const transcriptSections = await Promise.all(audioAttachments.map(async (attachment) => {
        const transcript = await transcribeAudio({ file: attachment });
        return `VOICE NOTE TRANSCRIPT:\n${transcript.text}`;
    }));
    capturedText = [
        typeof job.payload.text === 'string' ? job.payload.text : '',
        ...transcriptSections,
    ].filter(Boolean).join('\n\n');
    extraction = await extractOpportunityFromInput({
        reservedAllowance: allowance,
        userId: job.user_id,
        serviceClient,
        text: capturedText,
        attachments: readableAttachments,
        capturedAt: job.payload.captured_at,
        captureTimezone: job.payload.capture_timezone,
        mode: job.payload.mode,
    });
    } finally { await allowance.release?.(); }
    const body = buildExtractedOpportunityPayload({
        draft: extraction.draft,
        input: capturedText,
        directEntryId: job.id,
    });
    const result = await createOpportunityFromPayload({
        userId: job.user_id,
        client: serviceClient,
        body,
        extractionMetadata: { model: extraction.model, count: 1 },
    });
    return {
        opportunityId: result.opportunity.id,
        isDuplicate: result.isDuplicate,
    };
};

const processClaimedJob = async (
    serviceClient: SupabaseClient,
    job: OpportunityCaptureJobRow,
) => {
    try {
        const result = await processCapturedInput(serviceClient, job);
        const completedAt = new Date().toISOString();
        const attachments = attachmentsFromPayload(job.payload);
        // Commit success before deleting temporary files. If cleanup fails, the
        // recovery worker can retry it without ever re-running extraction/save.
        const { error } = await serviceClient
            .from('opportunity_capture_jobs')
            .update({
                status: 'succeeded',
                opportunity_id: result.opportunityId,
                is_duplicate: result.isDuplicate,
                completed_at: completedAt,
                locked_at: null,
                error_code: null,
                error_message: null,
                payload: redactCapturePayload(job.payload, attachments.length > 0),
                source_cleanup_at: completedAt,
                source_cleaned_at: attachments.length === 0 ? completedAt : null,
            })
            .eq('id', job.id)
            .eq('user_id', job.user_id);
        if (error) throw error;

        if (attachments.length > 0) {
            try {
                await removeCaptureAttachments(serviceClient, attachments);
                const { error: cleanupUpdateError } = await serviceClient
                    .from('opportunity_capture_jobs')
                    .update({
                        payload: redactCapturePayload(job.payload),
                        source_cleaned_at: new Date().toISOString(),
                    })
                    .eq('id', job.id)
                    .eq('user_id', job.user_id);
                if (cleanupUpdateError) throw cleanupUpdateError;
            } catch (cleanupError) {
                console.error('Opportunity capture attachment cleanup deferred', {
                    jobId: job.id,
                    message: cleanupError instanceof Error ? cleanupError.message : 'Unknown cleanup failure',
                });
            }
        }

        if (job.messaging_event_id) {
            try {
                await notifyTelegramCaptureResult({
                    serviceClient,
                    jobId: job.id,
                    messagingEventId: job.messaging_event_id,
                    opportunityId: result.opportunityId,
                    isDuplicate: result.isDuplicate,
                });
            } catch (notificationError) {
                console.error('Telegram capture completion message deferred', {
                    jobId: job.id,
                    message: notificationError instanceof Error ? notificationError.message : 'Unknown Telegram delivery failure',
                });
            }
        }

        return { id: job.id, status: 'succeeded' as const, opportunityId: result.opportunityId };
    } catch (error) {
        const message = error instanceof Error ? error.message.slice(0, 1000) : 'Capture failed unexpectedly';
        const code = errorCode(error) || 'CAPTURE_FAILED';
        const shouldRetry = job.attempt_count < job.max_attempts && isRetryableCaptureError(error);
        const retryDelaySeconds = Math.min(15 * 60, 30 * (2 ** Math.max(0, job.attempt_count - 1)));
        const now = Date.now();

        const { error: updateError } = await serviceClient
            .from('opportunity_capture_jobs')
            .update({
                status: shouldRetry ? 'pending' : 'failed',
                available_at: shouldRetry
                    ? new Date(now + retryDelaySeconds * 1000).toISOString()
                    : new Date(now).toISOString(),
                locked_at: null,
                completed_at: shouldRetry ? null : new Date(now).toISOString(),
                error_code: code,
                error_message: message,
                source_cleanup_at: shouldRetry
                    ? null
                    : new Date(now + FINAL_FAILURE_SOURCE_RETENTION_MS).toISOString(),
                source_cleaned_at: null,
            })
            .eq('id', job.id)
            .eq('user_id', job.user_id);

        if (updateError) {
            console.error('Opportunity capture job status update failed', {
                jobId: job.id,
                code: updateError.code,
                message: updateError.message,
            });
        }
        console.error('Opportunity capture job attempt failed', {
            jobId: job.id,
            userId: job.user_id,
            attempt: job.attempt_count,
            retrying: shouldRetry,
            code,
            message,
        });
        if (!shouldRetry && job.messaging_event_id) {
            try {
                await notifyTelegramCaptureResult({
                    serviceClient,
                    jobId: job.id,
                    messagingEventId: job.messaging_event_id,
                    failedMessage: errorStatus(error) >= 400 && errorStatus(error) < 500
                        ? 'I need one clarification. Send a little more context and try again.'
                        : 'This could not be processed. Try again.',
                });
            } catch (notificationError) {
                console.error('Telegram capture failure message deferred', {
                    jobId: job.id,
                    message: notificationError instanceof Error ? notificationError.message : 'Unknown Telegram delivery failure',
                });
            }
        }
        return { id: job.id, status: shouldRetry ? 'pending' as const : 'failed' as const };
    }
};

export const cleanupExpiredOpportunityCaptureSources = async (
    serviceClient: SupabaseClient,
    limit = 25,
) => {
    const { data, error } = await serviceClient
        .from('opportunity_capture_jobs')
        .select(PUBLIC_CAPTURE_JOB_SELECT)
        .not('source_cleanup_at', 'is', null)
        .is('source_cleaned_at', null)
        .lte('source_cleanup_at', new Date().toISOString())
        .order('source_cleanup_at', { ascending: true })
        .limit(Math.min(100, Math.max(1, limit)));
    if (error) {
        console.error('Opportunity capture source cleanup lookup failed', {
            code: error.code,
            message: error.message,
        });
        return { cleaned: 0, error: error.message };
    }

    let cleaned = 0;
    for (const job of (data || []) as unknown as OpportunityCaptureJobRow[]) {
        try {
            await removeCaptureAttachments(serviceClient, attachmentsFromPayload(job.payload));
            const uploadExpired = job.status === 'uploading';
            const { error: updateError } = await serviceClient
                .from('opportunity_capture_jobs')
                .update({
                    payload: redactCapturePayload(job.payload),
                    source_cleaned_at: new Date().toISOString(),
                    ...(uploadExpired ? {
                        status: 'failed',
                        completed_at: new Date().toISOString(),
                        error_code: 'UPLOAD_EXPIRED',
                        error_message: 'The attachment upload was not completed. Submit the files again.',
                    } : {}),
                })
                .eq('id', job.id)
                .eq('user_id', job.user_id);
            if (updateError) throw updateError;
            cleaned += 1;
        } catch (cleanupError) {
            console.error('Opportunity capture source cleanup failed', {
                jobId: job.id,
                message: cleanupError instanceof Error ? cleanupError.message : 'Unknown cleanup failure',
            });
        }
    }
    return { cleaned };
};

export const processOpportunityCaptureJobs = async ({
    jobId = null,
    limit = 5,
    serviceClient = createSupabaseServiceClient(),
}: {
    jobId?: string | null;
    limit?: number;
    serviceClient?: SupabaseClient | null;
} = {}) => {
    if (!serviceClient) {
        return { claimed: 0, succeeded: 0, failed: 0, pending: 0, cleaned: 0, error: 'Missing Supabase service client' };
    }

    const cleanup = await cleanupExpiredOpportunityCaptureSources(serviceClient);
    const { data, error } = await serviceClient.rpc('claim_opportunity_capture_jobs', {
        p_limit: Math.min(20, Math.max(1, limit)),
        p_job_id: jobId,
    });
    if (error) {
        console.error('Opportunity capture job claim failed', { code: error.code, message: error.message });
        return { claimed: 0, succeeded: 0, failed: 0, pending: 0, cleaned: cleanup.cleaned, error: error.message };
    }

    const jobs = (data || []) as OpportunityCaptureJobRow[];
    const results = await Promise.all(jobs.map((job) => processClaimedJob(serviceClient, job)));
    return {
        claimed: jobs.length,
        succeeded: results.filter((result) => result.status === 'succeeded').length,
        failed: results.filter((result) => result.status === 'failed').length,
        pending: results.filter((result) => result.status === 'pending').length,
        cleaned: cleanup.cleaned,
    };
};
