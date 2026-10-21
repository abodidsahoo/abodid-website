import type { SupabaseClient } from '@supabase/supabase-js';
import {
    getTelegramConfig,
    sendTelegramMessage,
    type TelegramInlineKeyboard,
} from './telegram';

type MessagingEventRow = {
    id: string;
    connection_id: string | null;
    user_id: string | null;
    provider_chat_id: string | null;
    status: string;
    event_type: string;
    dedupe_key: string | null;
    capture_job_id: string | null;
    opportunity_id: string | null;
    payload: {
        text?: string;
        keyboard?: TelegramInlineKeyboard;
    };
};

export const queueTelegramMessage = async ({
    serviceClient,
    chatId,
    text,
    eventType,
    dedupeKey,
    connectionId = null,
    userId = null,
    captureJobId = null,
    opportunityId = null,
    keyboard,
}: {
    serviceClient: SupabaseClient;
    chatId: string;
    text: string;
    eventType: string;
    dedupeKey: string;
    connectionId?: string | null;
    userId?: string | null;
    captureJobId?: string | null;
    opportunityId?: string | null;
    keyboard?: TelegramInlineKeyboard;
}) => {
    const row = {
        connection_id: connectionId,
        user_id: userId,
        provider: 'telegram',
        direction: 'outbound',
        event_type: eventType,
        status: 'queued',
        provider_chat_id: chatId,
        dedupe_key: dedupeKey,
        capture_job_id: captureJobId,
        opportunity_id: opportunityId,
        payload: { text: text.slice(0, 4096), ...(keyboard ? { keyboard } : {}) },
    };
    const { data, error } = await serviceClient
        .from('messaging_events')
        .insert(row)
        .select('id, connection_id, user_id, provider_chat_id, status, event_type, dedupe_key, capture_job_id, opportunity_id, payload')
        .single();
    if (!error && data) return data as MessagingEventRow;
    if (error?.code !== '23505') throw error || new Error('Telegram delivery could not be queued.');
    const { data: existing, error: existingError } = await serviceClient
        .from('messaging_events')
        .select('id, connection_id, user_id, provider_chat_id, status, event_type, dedupe_key, capture_job_id, opportunity_id, payload')
        .eq('provider', 'telegram')
        .eq('dedupe_key', dedupeKey)
        .maybeSingle();
    if (existingError || !existing) throw existingError || new Error('Telegram delivery receipt could not be loaded.');
    return existing as MessagingEventRow;
};

export const deliverTelegramEvent = async (
    serviceClient: SupabaseClient,
    eventOrId: MessagingEventRow | string,
) => {
    let event: MessagingEventRow | null = typeof eventOrId === 'string' ? null : eventOrId;
    if (!event) {
        const { data, error } = await serviceClient
            .from('messaging_events')
            .select('id, connection_id, user_id, provider_chat_id, status, event_type, dedupe_key, capture_job_id, opportunity_id, payload')
            .eq('id', eventOrId)
            .maybeSingle();
        if (error || !data) throw error || new Error('Telegram delivery was not found.');
        event = data as MessagingEventRow;
    }
    if (event.status === 'sent' || event.status === 'processed') return event;
    if (!event.provider_chat_id || !event.payload?.text) {
        throw new Error('Telegram delivery is missing a chat or message.');
    }
    const { data: claim, error: claimError } = await serviceClient
        .from('messaging_events')
        .update({ status: 'processing', attempted_at: new Date().toISOString(), error_code: null, error_message: null })
        .eq('id', event.id)
        .in('status', ['queued', 'failed'])
        .select('id')
        .maybeSingle();
    if (claimError) throw claimError;
    if (!claim) return event;
    try {
        const sent = await sendTelegramMessage({
            chatId: event.provider_chat_id,
            text: event.payload.text,
            keyboard: event.payload.keyboard,
        });
        const sentAt = new Date().toISOString();
        await serviceClient
            .from('messaging_events')
            .update({
                status: 'sent',
                provider_message_id: String(sent.message_id),
                sent_at: sentAt,
                processed_at: sentAt,
                payload: { delivered: true },
            })
            .eq('id', event.id);
        return { ...event, status: 'sent', payload: { delivered: true } };
    } catch (error) {
        await serviceClient
            .from('messaging_events')
            .update({
                status: 'failed',
                error_code: 'TELEGRAM_SEND_FAILED',
                error_message: error instanceof Error ? error.message.slice(0, 1000) : 'Telegram send failed',
            })
            .eq('id', event.id);
        throw error;
    }
};

export const queueAndDeliverTelegramMessage = async (
    input: Parameters<typeof queueTelegramMessage>[0],
) => {
    const event = await queueTelegramMessage(input);
    return deliverTelegramEvent(input.serviceClient, event);
};

export const deliverPendingTelegramMessages = async (
    serviceClient: SupabaseClient,
    limit = 10,
) => {
    const now = Date.now();
    await serviceClient
        .from('messaging_events')
        .update({ status: 'failed', error_code: 'DELIVERY_LEASE_EXPIRED' })
        .eq('provider', 'telegram')
        .eq('direction', 'outbound')
        .eq('status', 'processing')
        .lt('updated_at', new Date(now - 15 * 60 * 1000).toISOString());
    await serviceClient
        .from('messaging_events')
        .update({ status: 'ignored', error_code: 'DELIVERY_RETRY_EXPIRED' })
        .eq('provider', 'telegram')
        .eq('direction', 'outbound')
        .in('status', ['queued', 'failed'])
        .lt('created_at', new Date(now - 24 * 60 * 60 * 1000).toISOString());
    const { data, error } = await serviceClient
        .from('messaging_events')
        .select('id, connection_id, user_id, provider_chat_id, status, event_type, dedupe_key, capture_job_id, opportunity_id, payload')
        .eq('provider', 'telegram')
        .eq('direction', 'outbound')
        .in('status', ['queued', 'failed'])
        .or(`attempted_at.is.null,attempted_at.lt.${new Date(now - 5 * 60 * 1000).toISOString()}`)
        .order('created_at', { ascending: true })
        .limit(Math.min(25, Math.max(1, limit)));
    if (error) return { delivered: 0, error: error.message };
    let delivered = 0;
    for (const row of (data || []) as MessagingEventRow[]) {
        try {
            await deliverTelegramEvent(serviceClient, row);
            delivered += 1;
        } catch {
            // A later cron pass retries the durable outbound event.
        }
    }
    return { delivered };
};

export const notifyTelegramCaptureResult = async ({
    serviceClient,
    jobId,
    messagingEventId,
    opportunityId,
    isDuplicate,
    failedMessage,
}: {
    serviceClient: SupabaseClient;
    jobId: string;
    messagingEventId: string;
    opportunityId?: string | null;
    isDuplicate?: boolean;
    failedMessage?: string;
}) => {
    const { data: inbound, error } = await serviceClient
        .from('messaging_events')
        .select('connection_id, user_id, provider_chat_id')
        .eq('id', messagingEventId)
        .maybeSingle();
    if (error || !inbound?.provider_chat_id) return;
    const dashboardUrl = `${getTelegramConfig().siteUrl}/opportunities`;
    const text = failedMessage
        ? failedMessage
        : isDuplicate
            ? 'Already in your radar.'
            : 'Saved to your radar.';
    const keyboard: TelegramInlineKeyboard = opportunityId
        ? [
            [{ text: 'Open dashboard', url: dashboardUrl }],
            [
                { text: 'Mark applied', callback_data: `opportunity:submitted:${opportunityId}` },
                { text: 'Snooze', callback_data: `opportunity:snooze:${opportunityId}` },
            ],
            [{ text: 'Stop reminders', callback_data: `opportunity:mute:${opportunityId}` }],
        ]
        : [[{ text: 'Open dashboard', url: dashboardUrl }]];
    const outbound = await queueTelegramMessage({
        serviceClient,
        chatId: String(inbound.provider_chat_id),
        text,
        keyboard,
        eventType: failedMessage ? 'capture_failed' : isDuplicate ? 'capture_duplicate' : 'capture_succeeded',
        dedupeKey: `capture-result:${jobId}`,
        connectionId: inbound.connection_id,
        userId: inbound.user_id,
        captureJobId: jobId,
        opportunityId: opportunityId || null,
    });
    await serviceClient
        .from('messaging_events')
        .update({
            status: 'processed',
            opportunity_id: opportunityId || null,
            processed_at: new Date().toISOString(),
            payload: { capture_completed: !failedMessage, capture_failed: Boolean(failedMessage) },
        })
        .eq('id', messagingEventId);
    await deliverTelegramEvent(serviceClient, outbound);
};
