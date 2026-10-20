import type { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseServiceClient } from '../supabaseServer';
import {
    captureOpportunityFromUrl,
    OpportunityCaptureError,
    type OpportunityUrlCaptureInput,
} from './captureService';

export type OpportunityCaptureJobStatus = 'pending' | 'processing' | 'succeeded' | 'failed';

export type OpportunityCaptureJobRow = {
    id: string;
    user_id: string;
    idempotency_key: string;
    channel: 'dashboard' | 'extension' | 'telegram' | 'whatsapp';
    input_kind: 'url';
    status: OpportunityCaptureJobStatus;
    payload: OpportunityUrlCaptureInput;
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
    'created_at',
    'updated_at',
].join(', ');

export const captureJobToPublic = (job: OpportunityCaptureJobRow) => ({
    id: job.id,
    idempotency_key: job.idempotency_key,
    channel: job.channel,
    input_kind: job.input_kind,
    status: job.status,
    source_url: typeof job.payload?.url === 'string' ? job.payload.url : null,
    source_title: typeof job.payload?.title === 'string' ? job.payload.title : null,
    attempt_count: job.attempt_count,
    max_attempts: job.max_attempts,
    available_at: job.available_at,
    started_at: job.started_at,
    completed_at: job.completed_at,
    opportunity_id: job.opportunity_id,
    is_duplicate: job.is_duplicate,
    error_code: job.error_code,
    error_message: job.error_message,
    created_at: job.created_at,
    updated_at: job.updated_at,
});

const redactCapturePayload = (payload: OpportunityUrlCaptureInput) => ({
    url: typeof payload.url === 'string' ? payload.url.slice(0, 4096) : '',
    title: typeof payload.title === 'string' ? payload.title.slice(0, 500) : '',
    captured_at: typeof payload.captured_at === 'string' ? payload.captured_at : null,
    capture_timezone: typeof payload.capture_timezone === 'string' ? payload.capture_timezone.slice(0, 100) : null,
});

const isRetryableCaptureError = (error: unknown) => (
    !(error instanceof OpportunityCaptureError)
    || error.status === 429
    || error.status >= 500
);

const processClaimedJob = async (
    serviceClient: SupabaseClient,
    job: OpportunityCaptureJobRow,
) => {
    try {
        const result = await captureOpportunityFromUrl({
            userId: job.user_id,
            userClient: serviceClient,
            serviceClient,
            input: job.payload,
        });

        const { error } = await serviceClient
            .from('opportunity_capture_jobs')
            .update({
                status: 'succeeded',
                opportunity_id: result.opportunity.id,
                is_duplicate: result.is_duplicate,
                completed_at: new Date().toISOString(),
                locked_at: null,
                error_code: null,
                error_message: null,
                payload: redactCapturePayload(job.payload),
            })
            .eq('id', job.id)
            .eq('user_id', job.user_id);
        if (error) throw error;

        return { id: job.id, status: 'succeeded' as const, opportunityId: result.opportunity.id };
    } catch (error) {
        const message = error instanceof Error ? error.message.slice(0, 1000) : 'Capture failed unexpectedly';
        const code = error instanceof OpportunityCaptureError ? error.code || 'CAPTURE_FAILED' : 'CAPTURE_FAILED';
        const shouldRetry = job.attempt_count < job.max_attempts && isRetryableCaptureError(error);
        const retryDelaySeconds = Math.min(15 * 60, 30 * (2 ** Math.max(0, job.attempt_count - 1)));

        const { error: updateError } = await serviceClient
            .from('opportunity_capture_jobs')
            .update({
                status: shouldRetry ? 'pending' : 'failed',
                available_at: shouldRetry
                    ? new Date(Date.now() + retryDelaySeconds * 1000).toISOString()
                    : new Date().toISOString(),
                locked_at: null,
                completed_at: shouldRetry ? null : new Date().toISOString(),
                error_code: code,
                error_message: message,
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
        return { id: job.id, status: shouldRetry ? 'pending' as const : 'failed' as const };
    }
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
        return { claimed: 0, succeeded: 0, failed: 0, pending: 0, error: 'Missing Supabase service client' };
    }

    const { data, error } = await serviceClient.rpc('claim_opportunity_capture_jobs', {
        p_limit: Math.min(20, Math.max(1, limit)),
        p_job_id: jobId,
    });
    if (error) {
        console.error('Opportunity capture job claim failed', { code: error.code, message: error.message });
        return { claimed: 0, succeeded: 0, failed: 0, pending: 0, error: error.message };
    }

    const jobs = (data || []) as OpportunityCaptureJobRow[];
    const results = await Promise.all(jobs.map((job) => processClaimedJob(serviceClient, job)));
    return {
        claimed: jobs.length,
        succeeded: results.filter((result) => result.status === 'succeeded').length,
        failed: results.filter((result) => result.status === 'failed').length,
        pending: results.filter((result) => result.status === 'pending').length,
    };
};
