export const prerender = false;

import type { APIRoute } from 'astro';
import { authorizeAdminRequest, jsonResponse } from '../../../../lib/admin/serverAuth';
import { getTelegramConfig, isTelegramConfigured } from '../../../../lib/integrations/telegram';

const runtimeValue = (name: string) => {
    const metaEnv = typeof import.meta !== 'undefined'
        ? (import.meta as ImportMeta & { env?: Record<string, unknown> }).env
        : undefined;
    const value = metaEnv?.[name] ?? process.env[name];
    return typeof value === 'string' ? value.trim() : '';
};

const summarizeQueue = (rows: Array<{ status?: string }> = [], completedStatus: string) => ({
    pending: rows.filter((row) => row.status === 'pending' || row.status === 'uploading').length,
    processing: rows.filter((row) => row.status === 'processing').length,
    completed: rows.filter((row) => row.status === completedStatus).length,
    failed: rows.filter((row) => row.status === 'failed').length,
});

export const GET: APIRoute = async ({ request }) => {
    const authorization = await authorizeAdminRequest(request);
    if (!authorization.ok) return authorization.response;

    const { supabase } = authorization;
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const [mailSettings, captureJobs, reminders] = await Promise.all([
        supabase
            .from('reading_digest_settings')
            .select('recipient_email, sender_email')
            .eq('id', true)
            .maybeSingle(),
        supabase
            .from('opportunity_capture_jobs')
            .select('status')
            .gte('created_at', since),
        supabase
            .from('opportunity_reminders')
            .select('status')
            .gte('updated_at', since),
    ]);

    const resendConfigured = Boolean(runtimeValue('RESEND_API_KEY'));
    const notificationConfigured = resendConfigured
        && !mailSettings.error
        && Boolean(mailSettings.data?.recipient_email)
        && Boolean(mailSettings.data?.sender_email);
    const extractionConfigured = Boolean(runtimeValue('OPENROUTER_API_KEY'));
    const extractionModel = runtimeValue('OPENROUTER_OPPORTUNITIES_MODEL') || 'google/gemini-3.8-flash';
    const telegramConfig = getTelegramConfig();
    const telegramConfigured = isTelegramConfigured();
    const queuesAvailable = !captureJobs.error && !reminders.error;
    const capture = summarizeQueue(captureJobs.data || [], 'succeeded');
    const reminderQueue = summarizeQueue(reminders.data || [], 'sent');
    const queueNeedsAttention = queuesAvailable && (capture.failed > 0 || reminderQueue.failed > 0);

    return jsonResponse({
        services: [
            {
                id: 'database',
                label: 'Database',
                status: 'ready',
                statusLabel: 'Connected',
                detail: 'Supabase authentication and admin data access are active.',
                meta: 'Managed in Supabase.',
            },
            {
                id: 'notifications',
                label: 'Signup email',
                status: notificationConfigured ? 'ready' : 'attention',
                statusLabel: notificationConfigured ? 'Active' : 'Check setup',
                detail: notificationConfigured
                    ? 'New-user messages use the existing digest recipient.'
                    : 'Resend or the digest mail recipient is not fully configured.',
                meta: 'No email address or API key is exposed here.',
            },
            {
                id: 'extraction',
                label: 'Extraction',
                status: extractionConfigured ? 'ready' : 'attention',
                statusLabel: extractionConfigured ? 'Configured' : 'Missing key',
                detail: extractionConfigured
                    ? 'OpenRouter is available for opportunity extraction.'
                    : 'The OpenRouter credential is not configured.',
                meta: `Model: ${extractionModel}`,
            },
            {
                id: 'telegram',
                label: 'Telegram',
                status: telegramConfigured ? 'ready' : 'attention',
                statusLabel: telegramConfigured ? 'Enabled' : 'Not ready',
                detail: telegramConfigured
                    ? 'Telegram capture and reminder delivery are enabled.'
                    : 'The bot configuration is incomplete or disabled.',
                meta: `Bot: @${telegramConfig.botUsername}`,
            },
            {
                id: 'jobs',
                label: 'Background jobs',
                status: !queuesAvailable || queueNeedsAttention ? 'attention' : 'ready',
                statusLabel: !queuesAvailable ? 'Unavailable' : queueNeedsAttention ? 'Attention' : 'Healthy',
                detail: !queuesAvailable
                    ? 'Queue tables could not be checked.'
                    : queueNeedsAttention
                        ? 'One or more jobs failed during the last 24 hours.'
                        : 'Capture and reminder queues show no recent failures.',
                meta: 'Activity window: last 24 hours.',
            },
        ],
        activity: queuesAvailable ? { capture, reminders: reminderQueue } : null,
        checkedAt: new Date().toISOString(),
    });
};
