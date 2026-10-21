import type { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseServiceClient } from '../supabaseServer';
import { queueAndDeliverTelegramMessage } from '../integrations/telegramDelivery';

type ReminderRow = {
    id: string;
    opportunity_id: string;
    user_id: string;
    target_kind: 'deadline' | 'event';
    target_at: string;
    offset_minutes: number;
    scheduled_for: string;
    status: string;
    attempt_count: number;
    max_attempts: number;
};

const offsetLabel = (minutes: number) => {
    if (minutes === 0) return 'now';
    if (minutes === 30) return '30 minutes before';
    if (minutes === 120) return '2 hours before';
    if (minutes === 1440) return '1 day before';
    if (minutes % 1440 === 0) return `${minutes / 1440} days before`;
    if (minutes % 60 === 0) return `${minutes / 60} hours before`;
    return `${minutes} minutes before`;
};

const formatTarget = (value: string, timezone: string) => {
    try {
        return new Intl.DateTimeFormat('en-GB', {
            timeZone: timezone,
            weekday: 'short',
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
        }).format(new Date(value));
    } catch {
        return new Date(value).toUTCString();
    }
};

const retryReminder = async (
    serviceClient: SupabaseClient,
    reminder: ReminderRow,
    code: string,
    message: string,
) => {
    const exhausted = reminder.attempt_count >= reminder.max_attempts;
    const retryDelayMinutes = Math.min(30, 2 ** Math.max(0, reminder.attempt_count - 1));
    await serviceClient.from('opportunity_reminders').update({
        status: exhausted ? 'cancelled' : 'failed',
        available_at: new Date(Date.now() + retryDelayMinutes * 60_000).toISOString(),
        locked_at: null,
        error_code: code,
        error_message: message.slice(0, 1000),
    }).eq('id', reminder.id);
};

export const processTaskReminders = async ({
    limit = 25,
    serviceClient = createSupabaseServiceClient(),
}: {
    limit?: number;
    serviceClient?: SupabaseClient | null;
} = {}): Promise<{ claimed: number; sent: number; cancelled: number; failed: number; errors: string[] }> => {
    if (!serviceClient) {
        return { claimed: 0, sent: 0, cancelled: 0, failed: 0, errors: ['Missing Supabase service client'] };
    }

    const { data, error } = await serviceClient.rpc('claim_opportunity_reminders', {
        p_limit: Math.min(100, Math.max(1, limit)),
    });
    if (error) {
        return { claimed: 0, sent: 0, cancelled: 0, failed: 0, errors: [error.message] };
    }

    const reminders = (data || []) as ReminderRow[];
    let sent = 0;
    let cancelled = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const reminder of reminders) {
        try {
            const [{ data: opportunity, error: opportunityError }, { data: connection, error: connectionError }] = await Promise.all([
                serviceClient.from('saved_opportunities')
                    .select('id, title, status, deadline_at, content')
                    .eq('id', reminder.opportunity_id)
                    .eq('user_id', reminder.user_id)
                    .maybeSingle(),
                serviceClient.from('messaging_connections')
                    .select('id, provider_chat_id, settings')
                    .eq('user_id', reminder.user_id)
                    .eq('provider', 'telegram')
                    .eq('status', 'active')
                    .maybeSingle(),
            ]);
            if (opportunityError) throw opportunityError;
            if (connectionError) throw connectionError;

            const content = opportunity?.content && typeof opportunity.content === 'object'
                ? opportunity.content as Record<string, unknown>
                : {};
            if (!opportunity
                || opportunity.status !== 'reviewing'
                || content.reminders_disabled === true
                || new Date(reminder.target_at).getTime() <= Date.now() - 60_000) {
                await serviceClient.from('opportunity_reminders').update({
                    status: 'cancelled',
                    locked_at: null,
                    error_code: 'REMINDER_NO_LONGER_ACTIONABLE',
                }).eq('id', reminder.id);
                cancelled += 1;
                continue;
            }

            if (!connection?.provider_chat_id) {
                await retryReminder(serviceClient, reminder, 'TELEGRAM_NOT_CONNECTED', 'Telegram is not connected.');
                failed += 1;
                continue;
            }

            const settings = connection.settings && typeof connection.settings === 'object'
                ? connection.settings as Record<string, unknown>
                : {};
            if (settings.reminders_enabled === false) {
                await serviceClient.from('opportunity_reminders').update({
                    status: 'cancelled',
                    locked_at: null,
                    error_code: 'ACCOUNT_REMINDERS_DISABLED',
                }).eq('id', reminder.id);
                cancelled += 1;
                continue;
            }

            const timezone = typeof settings.timezone === 'string' && settings.timezone
                ? settings.timezone
                : typeof content.deadline_timezone === 'string' && content.deadline_timezone
                    ? content.deadline_timezone
                    : 'UTC';
            const label = offsetLabel(reminder.offset_minutes);
            const targetLabel = reminder.target_kind === 'deadline' ? 'Deadline' : 'When';
            const outbound = await queueAndDeliverTelegramMessage({
                serviceClient,
                chatId: String(connection.provider_chat_id),
                text: `⏰ Reminder · ${label}\n\n${String(opportunity.title || 'Task')}\n${targetLabel}: ${formatTarget(reminder.target_at, timezone)}`,
                eventType: 'scheduled_reminder',
                dedupeKey: `scheduled-reminder:${reminder.id}`,
                connectionId: connection.id,
                userId: reminder.user_id,
                opportunityId: reminder.opportunity_id,
                keyboard: [
                    [{ text: 'Open dashboard', url: 'https://abodid.com/opportunities' }],
                    [{ text: 'Done — stop reminders', callback_data: `opportunity:done:${reminder.opportunity_id}` }],
                ],
            });
            await serviceClient.from('opportunity_reminders').update({
                status: 'sent',
                sent_at: new Date().toISOString(),
                locked_at: null,
                messaging_event_id: outbound.id,
                error_code: null,
                error_message: null,
            }).eq('id', reminder.id);

            await serviceClient.from('messaging_connections').update({
                settings: {
                    ...settings,
                    last_active_opportunity_id: reminder.opportunity_id,
                },
            }).eq('id', connection.id);
            sent += 1;
        } catch (reminderError) {
            const message = reminderError instanceof Error ? reminderError.message : 'Reminder delivery failed';
            errors.push(`${reminder.id}: ${message}`);
            await retryReminder(serviceClient, reminder, 'REMINDER_DELIVERY_FAILED', message).catch(() => undefined);
            failed += 1;
        }
    }

    return { claimed: reminders.length, sent, cancelled, failed, errors };
};

