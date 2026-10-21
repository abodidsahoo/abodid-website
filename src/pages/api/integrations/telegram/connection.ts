import type { APIRoute } from 'astro';
import {
    configureTelegramBot,
    createTelegramLinkToken,
    getTelegramConfig,
    hashTelegramLinkToken,
    isTelegramConfigured,
    TELEGRAM_LINK_TOKEN_TTL_MS,
} from '../../../../lib/integrations/telegram';
import { authorizeOpportunityRequest, opportunityJson } from '../../../../lib/opportunities/userAuth';

export const prerender = false;

const connectionStatus = (row: Record<string, unknown> | null) => {
    const config = getTelegramConfig();
    return {
        enabled: isTelegramConfigured(),
        status: row?.status === 'active' ? 'active' : row?.status === 'pending' ? 'pending' : 'disconnected',
        username: typeof row?.provider_username === 'string' ? row.provider_username : null,
        linked_at: typeof row?.linked_at === 'string' ? row.linked_at : null,
        missing_configuration: [
            !config.botToken && 'TELEGRAM_BOT_TOKEN',
            !config.webhookSecret && 'TELEGRAM_WEBHOOK_SECRET',
            !config.botUsername && 'TELEGRAM_BOT_USERNAME',
            !config.enabled && 'TELEGRAM_BOT_ENABLED',
        ].filter(Boolean),
    };
};

const requestedTimezone = async (request: Request) => {
    const body = await request.json().catch(() => ({})) as { timezone?: unknown };
    const timezone = typeof body.timezone === 'string' ? body.timezone.trim() : '';
    if (!timezone || timezone.length > 100) return null;
    try {
        new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format();
        return timezone;
    } catch {
        return null;
    }
};

export const GET: APIRoute = async ({ request }) => {
    const authorization = await authorizeOpportunityRequest(request);
    if (!authorization.ok) return authorization.response;
    const { data, error } = await authorization.serviceClient
        .from('messaging_connections')
        .select('status, provider_username, linked_at')
        .eq('user_id', authorization.user.id)
        .eq('provider', 'telegram')
        .maybeSingle();
    if (error && !['42P01', 'PGRST205'].includes(error.code || '')) {
        return opportunityJson({ error: 'Telegram connection could not be loaded.' }, 500);
    }
    return opportunityJson(connectionStatus(data as Record<string, unknown> | null));
};

export const POST: APIRoute = async ({ request }) => {
    const authorization = await authorizeOpportunityRequest(request);
    if (!authorization.ok) return authorization.response;
    if (!isTelegramConfigured()) {
        return opportunityJson({
            error: 'Telegram is not configured yet.',
            code: 'TELEGRAM_NOT_CONFIGURED',
        }, 503);
    }
    try {
        await configureTelegramBot();
    } catch (error) {
        console.error('Telegram bot configuration failed', error);
        return opportunityJson({
            error: 'Telegram could not be prepared. Try again in a moment.',
            code: 'TELEGRAM_CONFIGURATION_FAILED',
        }, 502);
    }
    const timezone = await requestedTimezone(request);
    const { data: current, error: currentError } = await authorization.serviceClient
        .from('messaging_connections')
        .select('status, provider_username, linked_at, settings')
        .eq('user_id', authorization.user.id)
        .eq('provider', 'telegram')
        .maybeSingle();
    if (currentError) return opportunityJson({ error: 'Telegram connection could not be checked.' }, 500);
    if (current?.status === 'active') {
        if (timezone) {
            const settings = current.settings && typeof current.settings === 'object'
                ? current.settings as Record<string, unknown>
                : {};
            await authorization.serviceClient.from('messaging_connections').update({
                settings: { reminders_enabled: true, ...settings, timezone },
            }).eq('user_id', authorization.user.id).eq('provider', 'telegram');
        }
        return opportunityJson(connectionStatus(current), 200);
    }

    const token = createTelegramLinkToken();
    const expiresAt = new Date(Date.now() + TELEGRAM_LINK_TOKEN_TTL_MS).toISOString();
    const { error } = await authorization.serviceClient
        .from('messaging_connections')
        .upsert({
            user_id: authorization.user.id,
            provider: 'telegram',
            status: 'pending',
            provider_user_id: null,
            provider_chat_id: null,
            provider_username: null,
            link_token_hash: hashTelegramLinkToken(token),
            link_token_expires_at: expiresAt,
            link_token_used_at: null,
            disconnected_at: null,
            settings: {
                reminders_enabled: true,
                default_reminder_offsets_minutes: [1440, 120, 30],
                ...(timezone ? { timezone } : {}),
            },
        }, { onConflict: 'user_id,provider' });
    if (error) return opportunityJson({ error: 'Telegram connection could not be prepared.' }, 500);
    const { botUsername } = getTelegramConfig();
    return opportunityJson({
        enabled: true,
        status: 'pending',
        expires_at: expiresAt,
        connect_url: `https://t.me/${encodeURIComponent(botUsername)}?start=${encodeURIComponent(token)}`,
    }, 201);
};

export const PATCH: APIRoute = async ({ request }) => {
    const authorization = await authorizeOpportunityRequest(request);
    if (!authorization.ok) return authorization.response;
    const timezone = await requestedTimezone(request);
    if (!timezone) return opportunityJson({ error: 'A valid timezone is required.' }, 400);
    const { data: current, error: currentError } = await authorization.serviceClient
        .from('messaging_connections')
        .select('settings')
        .eq('user_id', authorization.user.id)
        .eq('provider', 'telegram')
        .maybeSingle();
    if (currentError || !current) return opportunityJson({ error: 'Telegram is not connected.' }, 404);
    const settings = current.settings && typeof current.settings === 'object'
        ? current.settings as Record<string, unknown>
        : {};
    const { error } = await authorization.serviceClient.from('messaging_connections').update({
        settings: { reminders_enabled: true, ...settings, timezone },
    }).eq('user_id', authorization.user.id).eq('provider', 'telegram');
    if (error) return opportunityJson({ error: 'Telegram timezone could not be updated.' }, 500);
    return opportunityJson({ success: true, timezone });
};

export const DELETE: APIRoute = async ({ request }) => {
    const authorization = await authorizeOpportunityRequest(request);
    if (!authorization.ok) return authorization.response;
    const now = new Date().toISOString();
    const { error } = await authorization.serviceClient
        .from('messaging_connections')
        .update({
            status: 'disconnected',
            provider_user_id: null,
            provider_chat_id: null,
            provider_username: null,
            link_token_hash: null,
            link_token_expires_at: null,
            link_token_used_at: null,
            disconnected_at: now,
        })
        .eq('user_id', authorization.user.id)
        .eq('provider', 'telegram');
    if (error) return opportunityJson({ error: 'Telegram could not be disconnected.' }, 500);
    return opportunityJson({ enabled: isTelegramConfigured(), status: 'disconnected' });
};
