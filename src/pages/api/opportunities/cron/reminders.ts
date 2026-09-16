import type { APIRoute } from 'astro';
import { isCronAuthenticated } from '../../../../lib/opportunities/auth';
import { processOpportunityReminders } from '../../../../lib/opportunities/reminders';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
    if (!isCronAuthenticated(request)) {
        return new Response(JSON.stringify({ error: 'Unauthorized cron request' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    try {
        const result = await processOpportunityReminders();
        return new Response(JSON.stringify({
            success: true,
            sent_count: result.sent,
            errors: result.errors,
            timestamp: new Date().toISOString(),
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (err: any) {
        return new Response(JSON.stringify({
            error: err?.message || 'Error processing opportunity reminders',
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
};

export const GET: APIRoute = POST;
