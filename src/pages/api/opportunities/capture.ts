import type { APIRoute } from 'astro';
import { authorizeOpportunityRequest, opportunityJson } from '../../../lib/opportunities/userAuth';
import {
    captureOpportunityFromUrl,
    OpportunityCaptureError,
} from '../../../lib/opportunities/captureService';

export const prerender = false;
export const maxDuration = 90;

export const POST: APIRoute = async ({ request }) => {
    const authorization = await authorizeOpportunityRequest(request);
    if (!authorization.ok) return authorization.response;

    try {
        const input = await request.json().catch(() => ({}));
        const result = await captureOpportunityFromUrl({
            userId: authorization.user.id,
            userClient: authorization.userClient,
            serviceClient: authorization.serviceClient,
            input,
        });
        return opportunityJson({ success: true, ...result }, result.is_duplicate ? 200 : 201);
    } catch (error) {
        if (error instanceof OpportunityCaptureError) {
            const response = opportunityJson({
                error: error.message,
                ...(error.code ? { code: error.code } : {}),
                ...error.details,
            }, error.status);
            if (error.status === 429 && typeof error.details.retry_after === 'number') {
                response.headers.set('Retry-After', String(error.details.retry_after));
            }
            return response;
        }
        console.error('Capture endpoint failed', error instanceof Error ? error.name : 'UnknownError');
        return opportunityJson({ error: 'Capture failed unexpectedly' }, 500);
    }
};
