import type { APIRoute } from 'astro';
import { isCronAuthenticated } from '../../../../lib/opportunities/auth';
import { processTaskReminders } from '../../../../lib/opportunities/taskReminders';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
    if (!isCronAuthenticated(request)) {
        return new Response(JSON.stringify({ error: 'Unauthorized cron request' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    try {
        const result = await processTaskReminders();
        return new Response(JSON.stringify({
            success: true,
            sent_count: result.sent,
            claimed_count: result.claimed,
            cancelled_count: result.cancelled,
            failed_count: result.failed,
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
