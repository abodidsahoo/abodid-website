import type { APIRoute } from 'astro';
import { waitUntil } from '@vercel/functions';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
    captureJobToPublic,
    OPPORTUNITY_CAPTURE_FILES_BUCKET,
    processOpportunityCaptureJobs,
    PUBLIC_CAPTURE_JOB_SELECT,
    type OpportunityCaptureAttachment,
    type OpportunityCaptureJobRow,
} from '../../../../../lib/opportunities/captureJobs';
import { authorizeOpportunityRequest, opportunityJson } from '../../../../../lib/opportunities/userAuth';

export const prerender = false;
export const maxDuration = 300;

const uploadedAttachmentNames = async (
    serviceClient: SupabaseClient,
    userId: string,
    jobId: string,
) => {
    const { data, error } = await serviceClient.storage
        .from(OPPORTUNITY_CAPTURE_FILES_BUCKET)
        .list(`${userId}/${jobId}`, { limit: 100 });
    return {
        objects: new Map((data || []).map((entry) => [
            entry.name,
            typeof entry.metadata?.size === 'number' ? entry.metadata.size : null,
        ])),
        error,
    };
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
    if (current.status !== 'uploading') {
        if (current.status === 'pending') {
            waitUntil(processOpportunityCaptureJobs({
                jobId,
                limit: 1,
                serviceClient: authorization.serviceClient,
            }));
        }
        return opportunityJson({
            accepted: current.status !== 'failed',
            job: captureJobToPublic(current),
        }, current.status === 'succeeded' ? 200 : 202);
    }

    const attachments = Array.isArray(current.payload.attachments)
        ? current.payload.attachments as OpportunityCaptureAttachment[]
        : [];
    if (attachments.length === 0) {
        return opportunityJson({ error: 'This upload receipt has no attachments' }, 409);
    }

    const uploaded = await uploadedAttachmentNames(
        authorization.serviceClient,
        authorization.user.id,
        jobId,
    );
    if (uploaded.error) {
        console.error('Opportunity upload verification failed', uploaded.error);
        return opportunityJson({ error: 'The attachment upload could not be verified' }, 500);
    }
    const missing = attachments.filter((attachment) => {
        const fileName = attachment.path.split('/').pop() || '';
        const uploadedSize = uploaded.objects.get(fileName);
        return uploadedSize === undefined
            || (uploadedSize !== null && uploadedSize !== attachment.size);
    });
    if (missing.length > 0) {
        return opportunityJson({
            error: `${missing.length} attachment${missing.length === 1 ? '' : 's'} did not finish uploading.`,
            code: 'ATTACHMENT_UPLOAD_INCOMPLETE',
        }, 409);
    }

    const { data, error } = await authorization.serviceClient
        .from('opportunity_capture_jobs')
        .update({
            status: 'pending',
            available_at: new Date().toISOString(),
            source_cleanup_at: null,
            source_cleaned_at: null,
            completed_at: null,
            locked_at: null,
            error_code: null,
            error_message: null,
        })
        .eq('id', jobId)
        .eq('user_id', authorization.user.id)
        .eq('status', 'uploading')
        .select(PUBLIC_CAPTURE_JOB_SELECT)
        .single();
    if (error || !data) return opportunityJson({ error: 'The upload could not be finalized' }, 500);

    waitUntil(processOpportunityCaptureJobs({
        jobId,
        limit: 1,
        serviceClient: authorization.serviceClient,
    }));
    return opportunityJson({
        accepted: true,
        job: captureJobToPublic(data as unknown as OpportunityCaptureJobRow),
    }, 202);
};
