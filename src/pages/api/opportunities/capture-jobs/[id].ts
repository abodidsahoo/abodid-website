import type { APIRoute } from 'astro';
import { waitUntil } from '@vercel/functions';
import {
    captureJobToPublic,
    processOpportunityCaptureJobs,
    PUBLIC_CAPTURE_JOB_SELECT,
    type OpportunityCaptureJobRow,
} from '../../../../lib/opportunities/captureJobs';
import { authorizeOpportunityRequest, opportunityJson } from '../../../../lib/opportunities/userAuth';

export const prerender = false;
export const maxDuration = 300;

export const GET: APIRoute = async ({ request, params }) => {
    const authorization = await authorizeOpportunityRequest(request);
    if (!authorization.ok) return authorization.response;

    const { data, error } = await authorization.userClient
        .from('opportunity_capture_jobs')
        .select(PUBLIC_CAPTURE_JOB_SELECT)
        .eq('id', params.id || '')
        .eq('user_id', authorization.user.id)
        .maybeSingle();

    if (error) return opportunityJson({ error: 'Capture status could not be loaded' }, 500);
    if (!data) return opportunityJson({ error: 'Capture job not found' }, 404);
    return opportunityJson({ job: captureJobToPublic(data as unknown as OpportunityCaptureJobRow) });
};

export const POST: APIRoute = async ({ request, params }) => {
    const authorization = await authorizeOpportunityRequest(request);
    if (!authorization.ok) return authorization.response;

    const jobId = params.id || '';
    const { data: existing, error: existingError } = await authorization.userClient
        .from('opportunity_capture_jobs')
        .select(PUBLIC_CAPTURE_JOB_SELECT)
        .eq('id', jobId)
        .eq('user_id', authorization.user.id)
        .maybeSingle();
    if (existingError) return opportunityJson({ error: 'Capture status could not be loaded' }, 500);
    if (!existing) return opportunityJson({ error: 'Capture job not found' }, 404);

    const current = existing as unknown as OpportunityCaptureJobRow;
    if (current.status !== 'failed') {
        return opportunityJson({ job: captureJobToPublic(current) });
    }
    if (current.input_kind !== 'url' && current.source_cleaned_at) {
        return opportunityJson({
            error: 'The temporary note or attachment has expired. Submit it again to create a new capture.',
            code: 'CAPTURE_SOURCE_EXPIRED',
        }, 410);
    }

    const { data, error } = await authorization.serviceClient
        .from('opportunity_capture_jobs')
        .update({
            status: 'pending',
            attempt_count: 0,
            available_at: new Date().toISOString(),
            completed_at: null,
            locked_at: null,
            error_code: null,
            error_message: null,
            source_cleanup_at: null,
            source_cleaned_at: null,
        })
        .eq('id', jobId)
        .eq('user_id', authorization.user.id)
        .select(PUBLIC_CAPTURE_JOB_SELECT)
        .single();
    if (error || !data) return opportunityJson({ error: 'Capture could not be retried' }, 500);

    waitUntil(processOpportunityCaptureJobs({
        jobId,
        limit: 1,
        serviceClient: authorization.serviceClient,
    }));
    return opportunityJson({ accepted: true, job: captureJobToPublic(data as unknown as OpportunityCaptureJobRow) }, 202);
};
