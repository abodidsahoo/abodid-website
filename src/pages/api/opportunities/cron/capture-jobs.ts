import type { APIRoute } from 'astro';
import { isCronAuthenticated } from '../../../../lib/opportunities/auth';
import { processOpportunityCaptureJobs } from '../../../../lib/opportunities/captureJobs';
import { opportunityJson } from '../../../../lib/opportunities/userAuth';

export const prerender = false;
export const maxDuration = 300;

export const POST: APIRoute = async ({ request }) => {
    if (!isCronAuthenticated(request)) {
        return opportunityJson({ error: 'Unauthorized cron request' }, 401);
    }

    const result = await processOpportunityCaptureJobs({ limit: 10 });
    return opportunityJson({
        success: !('error' in result),
        ...result,
        timestamp: new Date().toISOString(),
    }, 'error' in result ? 500 : 200);
};
