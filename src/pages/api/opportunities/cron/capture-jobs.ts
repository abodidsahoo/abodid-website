import type { APIRoute } from 'astro';
import { isCronAuthenticated } from '../../../../lib/opportunities/auth';
import { processOpportunityCaptureJobs } from '../../../../lib/opportunities/captureJobs';
import { opportunityJson } from '../../../../lib/opportunities/userAuth';
import { deliverPendingTelegramMessages } from '../../../../lib/integrations/telegramDelivery';
import { createSupabaseServiceClient } from '../../../../lib/supabaseServer';

export const prerender = false;
export const maxDuration = 300;

export const POST: APIRoute = async ({ request }) => {
    if (!isCronAuthenticated(request)) {
        return opportunityJson({ error: 'Unauthorized cron request' }, 401);
    }

    const result = await processOpportunityCaptureJobs({ limit: 10 });
    const serviceClient = createSupabaseServiceClient();
    const telegram = serviceClient
        ? await deliverPendingTelegramMessages(serviceClient, 10)
        : { delivered: 0, error: 'Missing Supabase service client' };
    return opportunityJson({
        success: !('error' in result) && !('error' in telegram),
        ...result,
        telegram,
        timestamp: new Date().toISOString(),
    }, 'error' in result || 'error' in telegram ? 500 : 200);
};
