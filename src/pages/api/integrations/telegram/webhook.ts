import type { APIRoute } from 'astro';
import { waitUntil } from '@vercel/functions';
import {
    answerTelegramCallback,
    getTelegramConfig,
    hashTelegramLinkToken,
    isTelegramConfigured,
    parseTelegramUpdate,
    telegramUpdateIdempotencyKey,
    verifyTelegramWebhookSecret,
    type ParsedTelegramUpdate,
    type TelegramUpdate,
} from '../../../../lib/integrations/telegram';
import {
    deliverTelegramEvent,
    queueAndDeliverTelegramMessage,
    queueTelegramMessage,
} from '../../../../lib/integrations/telegramDelivery';
import {
    enqueueOpportunityCaptureJob,
    processOpportunityCaptureJobs,
    type OpportunityCaptureInputKind,
    type OpportunityCaptureJobPayload,
} from '../../../../lib/opportunities/captureJobs';
import { normalizeOpportunityCaptureUrl } from '../../../../lib/opportunities/captureUrl';
import { createSupabaseServiceClient } from '../../../../lib/supabaseServer';

export const prerender = false;
export const maxDuration = 300;

const telegramJson = (body: unknown = { ok: true }, status = 200) => new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

const inboundPayload = (parsed: ParsedTelegramUpdate) => {
    if (parsed.command === 'start') return { command: 'start' };
    return {
        text: parsed.text.slice(0, 100_000),
        command: parsed.command,
        callback_data: parsed.callbackData,
        files: parsed.files,
        captured_at: parsed.capturedAt,
        is_forwarded: parsed.isForwarded,
    };
};

const exactUrl = (text: string) => {
    if (!/^https?:\/\/\S+$/i.test(text.trim())) return null;
    try {
        return normalizeOpportunityCaptureUrl(text.trim()).sourceUrl;
    } catch {
        return null;
    }
};

const supportedTelegramFiles = (parsed: ParsedTelegramUpdate) => parsed.files.every((file) => (
    file.kind === 'voice'
    || file.kind === 'image'
    || file.type === 'application/pdf'
    || file.name.toLowerCase().endsWith('.pdf')
    || file.type === 'text/plain'
    || file.type === 'text/markdown'
));

const responseFor = async ({
    serviceClient,
    parsed,
    connection,
    text,
    eventType,
}: {
    serviceClient: NonNullable<ReturnType<typeof createSupabaseServiceClient>>;
    parsed: ParsedTelegramUpdate;
    connection?: { id: string; user_id: string } | null;
    text: string;
    eventType: string;
}) => {
    if (!parsed.chatId) return;
    await queueAndDeliverTelegramMessage({
        serviceClient,
        chatId: parsed.chatId,
        text,
        eventType,
        dedupeKey: `update-response:${parsed.updateId}:${eventType}`,
        connectionId: connection?.id || null,
        userId: connection?.user_id || null,
    });
};

const findActiveConnection = async (
    serviceClient: NonNullable<ReturnType<typeof createSupabaseServiceClient>>,
    parsed: ParsedTelegramUpdate,
) => {
    if (!parsed.userId || !parsed.chatId) return null;
    const { data } = await serviceClient
        .from('messaging_connections')
        .select('id, user_id, provider_chat_id, provider_username, settings')
        .eq('provider', 'telegram')
        .eq('status', 'active')
        .eq('provider_user_id', parsed.userId)
        .eq('provider_chat_id', parsed.chatId)
        .maybeSingle();
    return data as {
        id: string;
        user_id: string;
        provider_chat_id: string;
        provider_username: string | null;
        settings: Record<string, unknown>;
    } | null;
};

const linkTelegramConnection = async (
    serviceClient: NonNullable<ReturnType<typeof createSupabaseServiceClient>>,
    parsed: ParsedTelegramUpdate,
) => {
    if (!parsed.commandArgument || !parsed.userId || !parsed.chatId) return null;
    const now = new Date().toISOString();
    const { data, error } = await serviceClient
        .from('messaging_connections')
        .update({
            status: 'active',
            provider_user_id: parsed.userId,
            provider_chat_id: parsed.chatId,
            provider_username: parsed.username,
            link_token_used_at: now,
            link_token_hash: null,
            link_token_expires_at: null,
            linked_at: now,
            disconnected_at: null,
        })
        .eq('provider', 'telegram')
        .eq('status', 'pending')
        .eq('link_token_hash', hashTelegramLinkToken(parsed.commandArgument))
        .gt('link_token_expires_at', now)
        .is('link_token_used_at', null)
        .select('id, user_id')
        .maybeSingle();
    if (error) {
        if (error.code === '23505') throw new Error('This Telegram account is already linked to another tracker account.');
        throw error;
    }
    return data as { id: string; user_id: string } | null;
};

const updateInboundEvent = async (
    serviceClient: NonNullable<ReturnType<typeof createSupabaseServiceClient>>,
    eventId: string,
    updates: Record<string, unknown>,
) => serviceClient.from('messaging_events').update(updates).eq('id', eventId);

const handleCallback = async ({
    serviceClient,
    parsed,
    connection,
    eventId,
}: {
    serviceClient: NonNullable<ReturnType<typeof createSupabaseServiceClient>>;
    parsed: ParsedTelegramUpdate;
    connection: NonNullable<Awaited<ReturnType<typeof findActiveConnection>>>;
    eventId: string;
}) => {
    const match = parsed.callbackData?.match(/^opportunity:(submitted|snooze|mute):([0-9a-f-]{36})$/i);
    if (!match) {
        if (parsed.callbackQueryId) await answerTelegramCallback(parsed.callbackQueryId, 'This action is no longer available.');
        await updateInboundEvent(serviceClient, eventId, { status: 'ignored', processed_at: new Date().toISOString() });
        return;
    }
    const [, action, opportunityId] = match;
    const { data: opportunity, error: opportunityError } = await serviceClient
        .from('saved_opportunities')
        .select('id, content')
        .eq('id', opportunityId)
        .eq('user_id', connection.user_id)
        .maybeSingle();
    if (opportunityError) throw opportunityError;
    if (!opportunity) {
        if (parsed.callbackQueryId) await answerTelegramCallback(parsed.callbackQueryId, 'Opportunity not found.');
        await updateInboundEvent(serviceClient, eventId, { status: 'ignored', processed_at: new Date().toISOString() });
        return;
    }
    let message = 'Updated.';
    if (action === 'submitted') {
        const { error } = await serviceClient.from('saved_opportunities')
            .update({ status: 'submitted' })
            .eq('id', opportunityId)
            .eq('user_id', connection.user_id);
        if (error) throw error;
        message = 'Marked as applied.';
    } else {
        const content = typeof opportunity.content === 'object' && opportunity.content !== null
            ? opportunity.content as Record<string, unknown>
            : {};
        const { error } = await serviceClient.from('saved_opportunities')
            .update({
                content: action === 'snooze'
                    ? { ...content, reminders_snoozed_until: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() }
                    : { ...content, reminders_disabled: true },
            })
            .eq('id', opportunityId)
            .eq('user_id', connection.user_id);
        if (error) throw error;
        message = action === 'snooze' ? 'Reminders snoozed for 24 hours.' : 'Reminders stopped for this opportunity.';
    }
    if (parsed.callbackQueryId) await answerTelegramCallback(parsed.callbackQueryId, message);
    await updateInboundEvent(serviceClient, eventId, {
        connection_id: connection.id,
        user_id: connection.user_id,
        opportunity_id: opportunityId,
        status: 'processed',
        processed_at: new Date().toISOString(),
        payload: { action },
    });
};

export const POST: APIRoute = async ({ request }) => {
    if (!isTelegramConfigured()) return telegramJson({ ok: false }, 503);
    if (!verifyTelegramWebhookSecret(request.headers.get('x-telegram-bot-api-secret-token'))) {
        return telegramJson({ ok: false }, 401);
    }
    const serviceClient = createSupabaseServiceClient();
    if (!serviceClient) return telegramJson({ ok: false }, 503);
    const update = await request.json().catch(() => null) as TelegramUpdate | null;
    if (!update || !Number.isSafeInteger(update.update_id)) return telegramJson({ ok: false }, 400);
    const parsed = parseTelegramUpdate(update);
    const eventInsert = {
        provider: 'telegram',
        direction: 'inbound',
        event_type: parsed.eventType,
        status: 'received',
        provider_update_id: parsed.updateId,
        provider_chat_id: parsed.chatId,
        provider_message_id: parsed.messageId,
        payload: inboundPayload(parsed),
    };
    const { data: inserted, error: insertError } = await serviceClient
        .from('messaging_events')
        .insert(eventInsert)
        .select('id, status')
        .single();
    let event = inserted as { id: string; status: string } | null;
    if (insertError?.code === '23505') {
        const { data: existing } = await serviceClient
            .from('messaging_events')
            .select('id, status')
            .eq('provider', 'telegram')
            .eq('provider_update_id', parsed.updateId)
            .maybeSingle();
        if (!existing || !['received', 'failed'].includes(existing.status)) return telegramJson();
        event = existing as { id: string; status: string };
    } else if (insertError || !event) {
        return telegramJson({ ok: false }, 500);
    }

    if (parsed.chatType !== 'private' || !parsed.chatId || !parsed.userId) {
        await updateInboundEvent(serviceClient, event.id, { status: 'ignored', processed_at: new Date().toISOString() });
        return telegramJson();
    }

    let connection = await findActiveConnection(serviceClient, parsed);
    if (parsed.command === 'start' && parsed.commandArgument) {
        try {
            const linked = await linkTelegramConnection(serviceClient, parsed);
            connection = await findActiveConnection(serviceClient, parsed);
            await updateInboundEvent(serviceClient, event.id, {
                connection_id: connection?.id || linked?.id || null,
                user_id: connection?.user_id || linked?.user_id || null,
                status: 'processed',
                processed_at: new Date().toISOString(),
                payload: { command: 'start', linked: Boolean(linked || connection) },
            });
            await responseFor({
                serviceClient,
                parsed,
                connection,
                eventType: linked || connection ? 'connection_succeeded' : 'connection_expired',
                text: linked || connection
                    ? 'Telegram is connected to your Opportunity Tracker. Send a URL, note, forwarded message, PDF, image, or voice note.'
                    : 'This connection link is invalid or expired. Generate a new one from Opportunity Tracker settings.',
            });
        } catch (error) {
            await updateInboundEvent(serviceClient, event.id, {
                status: 'failed',
                error_code: 'CONNECTION_FAILED',
                error_message: error instanceof Error ? error.message.slice(0, 1000) : 'Connection failed',
            });
            await responseFor({
                serviceClient,
                parsed,
                eventType: 'connection_failed',
                text: error instanceof Error ? error.message : 'Telegram could not be connected.',
            });
        }
        return telegramJson();
    }

    if (!connection) {
        await updateInboundEvent(serviceClient, event.id, { status: 'ignored', processed_at: new Date().toISOString() });
        await responseFor({
            serviceClient,
            parsed,
            eventType: 'connection_required',
            text: `Connect Telegram from ${getTelegramConfig().siteUrl}/opportunities before sending opportunities.`,
        });
        return telegramJson();
    }

    await updateInboundEvent(serviceClient, event.id, {
        connection_id: connection.id,
        user_id: connection.user_id,
    });

    if (parsed.eventType === 'callback_query') {
        try {
            await handleCallback({ serviceClient, parsed, connection, eventId: event.id });
        } catch (error) {
            await updateInboundEvent(serviceClient, event.id, {
                status: 'failed',
                error_code: 'CALLBACK_FAILED',
                error_message: error instanceof Error ? error.message.slice(0, 1000) : 'Callback failed',
            });
            if (parsed.callbackQueryId) {
                await answerTelegramCallback(parsed.callbackQueryId, 'This update could not be completed. Try again.').catch(() => undefined);
            }
        }
        return telegramJson();
    }
    if (parsed.command === 'help' || parsed.command === 'start') {
        await updateInboundEvent(serviceClient, event.id, { status: 'processed', processed_at: new Date().toISOString() });
        await responseFor({
            serviceClient,
            parsed,
            connection,
            eventType: 'help',
            text: 'Send a URL, written note, forwarded text, PDF, image, or voice note. I will extract it and save it to your radar. Use /settings or /disconnect at any time.',
        });
        return telegramJson();
    }
    if (parsed.command === 'settings') {
        await updateInboundEvent(serviceClient, event.id, { status: 'processed', processed_at: new Date().toISOString() });
        await responseFor({
            serviceClient,
            parsed,
            connection,
            eventType: 'settings',
            text: `Connected as @${parsed.username || 'Telegram user'}. Opportunity reminders: ${connection.settings?.reminders_enabled === false ? 'off' : 'on'}.`,
        });
        return telegramJson();
    }
    if (parsed.command === 'disconnect') {
        const now = new Date().toISOString();
        const { error: disconnectError } = await serviceClient.from('messaging_connections').update({
            status: 'disconnected',
            provider_user_id: null,
            provider_chat_id: null,
            provider_username: null,
            link_token_hash: null,
            link_token_expires_at: null,
            link_token_used_at: null,
            disconnected_at: now,
        }).eq('id', connection.id).eq('user_id', connection.user_id);
        if (disconnectError) {
            await updateInboundEvent(serviceClient, event.id, {
                status: 'failed',
                error_code: 'DISCONNECT_FAILED',
                error_message: disconnectError.message.slice(0, 1000),
            });
            await responseFor({
                serviceClient,
                parsed,
                connection,
                eventType: 'disconnect_failed',
                text: 'Telegram could not be disconnected. Try again.',
            });
            return telegramJson();
        }
        await updateInboundEvent(serviceClient, event.id, { status: 'processed', processed_at: now, payload: { command: 'disconnect' } });
        await responseFor({
            serviceClient,
            parsed,
            connection,
            eventType: 'disconnected',
            text: 'Telegram has been disconnected from your Opportunity Tracker.',
        });
        return telegramJson();
    }
    if (parsed.command) {
        await updateInboundEvent(serviceClient, event.id, { status: 'ignored', processed_at: new Date().toISOString() });
        await responseFor({
            serviceClient,
            parsed,
            connection,
            eventType: 'unknown_command',
            text: 'I do not recognise that command. Use /help to see what you can send.',
        });
        return telegramJson();
    }
    if (!supportedTelegramFiles(parsed)) {
        await updateInboundEvent(serviceClient, event.id, { status: 'ignored', processed_at: new Date().toISOString() });
        await responseFor({
            serviceClient,
            parsed,
            connection,
            eventType: 'unsupported_input',
            text: 'That file type is not supported yet. Send a PDF, image, voice note, URL, or written note.',
        });
        return telegramJson();
    }
    if (!parsed.text && parsed.files.length === 0) {
        await updateInboundEvent(serviceClient, event.id, { status: 'ignored', processed_at: new Date().toISOString() });
        await responseFor({
            serviceClient,
            parsed,
            connection,
            eventType: 'empty_input',
            text: 'Send a URL, note, PDF, image, or voice note to save an opportunity.',
        });
        return telegramJson();
    }

    const url = parsed.files.length === 0 ? exactUrl(parsed.text) : null;
    const inputKind: OpportunityCaptureInputKind = url
        ? 'url'
        : parsed.files.length > 0
            ? parsed.text ? 'mixed' : 'attachments'
            : 'text';
    const payload: OpportunityCaptureJobPayload = url
        ? { url, captured_at: parsed.capturedAt, capture_timezone: 'UTC' }
        : {
            text: parsed.text,
            mode: parsed.text.length < 50 ? 'note' : 'text',
            telegram_files: parsed.files,
            captured_at: parsed.capturedAt,
            capture_timezone: 'UTC',
        };
    try {
        const queued = await enqueueOpportunityCaptureJob({
            client: serviceClient,
            userId: connection.user_id,
            idempotencyKey: telegramUpdateIdempotencyKey(parsed.updateId),
            channel: 'telegram',
            inputKind,
            payload,
            messagingEventId: event.id,
        });
        await updateInboundEvent(serviceClient, event.id, {
            status: 'queued',
            capture_job_id: queued.job.id,
            payload: { capture_recorded: true, input_kind: inputKind },
        });
        const acknowledgement = await queueTelegramMessage({
            serviceClient,
            chatId: parsed.chatId,
            text: 'Received — processing in the background.',
            eventType: 'capture_received',
            dedupeKey: `capture-received:${queued.job.id}`,
            connectionId: connection.id,
            userId: connection.user_id,
            captureJobId: queued.job.id,
        });
        waitUntil((async () => {
            try {
                await deliverTelegramEvent(serviceClient, acknowledgement);
            } catch (error) {
                console.error('Telegram acknowledgement delivery deferred', error);
            }
            await processOpportunityCaptureJobs({ jobId: queued.job.id, limit: 1, serviceClient });
        })());
    } catch (error) {
        await updateInboundEvent(serviceClient, event.id, {
            status: 'failed',
            error_code: 'CAPTURE_ENQUEUE_FAILED',
            error_message: error instanceof Error ? error.message.slice(0, 1000) : 'Capture enqueue failed',
        });
        await responseFor({
            serviceClient,
            parsed,
            connection,
            eventType: 'capture_enqueue_failed',
            text: 'This could not be processed. Try again.',
        });
    }
    return telegramJson();
};
