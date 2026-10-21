import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

export const TELEGRAM_PROVIDER = 'telegram' as const;
export const TELEGRAM_LINK_TOKEN_TTL_MS = 10 * 60 * 1000;
export const TELEGRAM_MAX_DOWNLOAD_BYTES = 20 * 1024 * 1024;

export type TelegramFileDescriptor = {
    file_id: string;
    file_unique_id: string;
    name: string;
    type: string;
    size: number;
    kind: 'document' | 'image' | 'voice';
    duration?: number;
};

type TelegramUser = {
    id: number;
    username?: string;
    first_name?: string;
    last_name?: string;
};

type TelegramChat = {
    id: number;
    type: string;
};

type TelegramDocument = {
    file_id: string;
    file_unique_id: string;
    file_name?: string;
    mime_type?: string;
    file_size?: number;
};

type TelegramPhoto = {
    file_id: string;
    file_unique_id: string;
    file_size?: number;
    width?: number;
    height?: number;
};

type TelegramVoice = {
    file_id: string;
    file_unique_id: string;
    duration: number;
    mime_type?: string;
    file_size?: number;
};

type TelegramMessage = {
    message_id: number;
    date: number;
    chat: TelegramChat;
    from?: TelegramUser;
    text?: string;
    caption?: string;
    document?: TelegramDocument;
    photo?: TelegramPhoto[];
    voice?: TelegramVoice;
    forward_origin?: unknown;
};

type TelegramCallbackQuery = {
    id: string;
    from: TelegramUser;
    data?: string;
    message?: TelegramMessage;
};

export type TelegramUpdate = {
    update_id: number;
    message?: TelegramMessage;
    callback_query?: TelegramCallbackQuery;
};

export type ParsedTelegramUpdate = {
    updateId: string;
    eventType: 'message' | 'callback_query' | 'unsupported';
    chatId: string | null;
    chatType: string | null;
    userId: string | null;
    username: string | null;
    messageId: string | null;
    callbackQueryId: string | null;
    callbackData: string | null;
    text: string;
    command: string | null;
    commandArgument: string;
    files: TelegramFileDescriptor[];
    capturedAt: string;
    isForwarded: boolean;
};

const envValue = (name: string) => {
    const metaEnv = typeof import.meta !== 'undefined'
        ? (import.meta as ImportMeta & { env?: Record<string, unknown> }).env
        : undefined;
    const value = metaEnv?.[name] ?? process.env[name];
    if (value === undefined || value === null) return '';
    return typeof value === 'string' ? value : String(value);
};

export const getTelegramConfig = () => {
    const botToken = envValue('TELEGRAM_BOT_TOKEN').trim();
    const webhookSecret = envValue('TELEGRAM_WEBHOOK_SECRET').trim();
    const enabledValue = envValue('TELEGRAM_BOT_ENABLED').trim().toLowerCase();
    return {
        botToken,
        webhookSecret,
        botUsername: (envValue('TELEGRAM_BOT_USERNAME').trim() || 'AbodidOpportunityBot').replace(/^@/, ''),
        enabled: enabledValue
            ? ['1', 'true', 'yes', 'on'].includes(enabledValue)
            : Boolean(botToken && webhookSecret),
        siteUrl: (envValue('PUBLIC_SITE_URL').trim() || 'https://abodid.com').replace(/\/$/, ''),
    };
};

export const isTelegramConfigured = () => {
    const config = getTelegramConfig();
    return config.enabled
        && Boolean(config.botToken)
        && Boolean(config.webhookSecret)
        && Boolean(config.botUsername);
};

export const createTelegramLinkToken = () => randomBytes(32).toString('base64url');

export const hashTelegramLinkToken = (token: string) => (
    createHash('sha256').update(token, 'utf8').digest('hex')
);

export const telegramUpdateIdempotencyKey = (updateId: string) => {
    const bytes = createHash('sha256').update(`telegram:${updateId}`, 'utf8').digest().subarray(0, 16);
    bytes[6] = (bytes[6] & 0x0f) | 0x50;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = bytes.toString('hex');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

export const verifyTelegramWebhookSecret = (provided: string | null) => {
    const expected = getTelegramConfig().webhookSecret;
    if (!provided || !expected) return false;
    const providedBytes = Buffer.from(provided, 'utf8');
    const expectedBytes = Buffer.from(expected, 'utf8');
    return providedBytes.length === expectedBytes.length
        && timingSafeEqual(providedBytes, expectedBytes);
};

const commandParts = (text: string) => {
    const match = text.trim().match(/^\/([a-z_]+)(?:@[a-z0-9_]+)?(?:\s+([\s\S]*))?$/i);
    return {
        command: match?.[1]?.toLowerCase() || null,
        argument: match?.[2]?.trim() || '',
    };
};

const documentDescriptor = (document: TelegramDocument): TelegramFileDescriptor => ({
    file_id: document.file_id,
    file_unique_id: document.file_unique_id,
    name: (document.file_name || 'telegram-document').slice(0, 160),
    type: (document.mime_type || 'application/octet-stream').slice(0, 160),
    size: Number(document.file_size) || 0,
    kind: 'document',
});

const photoDescriptor = (photos: TelegramPhoto[]): TelegramFileDescriptor[] => {
    const largest = [...photos].sort((a, b) => (
        (b.file_size || b.width || 0) - (a.file_size || a.width || 0)
    ))[0];
    if (!largest) return [];
    return [{
        file_id: largest.file_id,
        file_unique_id: largest.file_unique_id,
        name: `telegram-photo-${largest.file_unique_id}.jpg`.slice(0, 160),
        type: 'image/jpeg',
        size: Number(largest.file_size) || 0,
        kind: 'image',
    }];
};

const voiceDescriptor = (voice: TelegramVoice): TelegramFileDescriptor => ({
    file_id: voice.file_id,
    file_unique_id: voice.file_unique_id,
    name: `telegram-voice-${voice.file_unique_id}.ogg`.slice(0, 160),
    type: (voice.mime_type || 'audio/ogg').slice(0, 160),
    size: Number(voice.file_size) || 0,
    duration: Number(voice.duration) || 0,
    kind: 'voice',
});

export const parseTelegramUpdate = (update: TelegramUpdate): ParsedTelegramUpdate => {
    const callback = update.callback_query;
    const message = update.message || callback?.message;
    const sender = update.message?.from || callback?.from;
    const text = (update.message?.text || update.message?.caption || '').trim();
    const { command, argument } = commandParts(text);
    const files = update.message?.voice
        ? [voiceDescriptor(update.message.voice)]
        : update.message?.document
            ? [documentDescriptor(update.message.document)]
            : photoDescriptor(update.message?.photo || []);
    return {
        updateId: String(update.update_id),
        eventType: callback ? 'callback_query' : update.message ? 'message' : 'unsupported',
        chatId: message?.chat?.id !== undefined ? String(message.chat.id) : null,
        chatType: message?.chat?.type || null,
        userId: sender?.id !== undefined ? String(sender.id) : null,
        username: sender?.username || null,
        messageId: message?.message_id !== undefined ? String(message.message_id) : null,
        callbackQueryId: callback?.id || null,
        callbackData: callback?.data || null,
        text,
        command,
        commandArgument: argument,
        files,
        capturedAt: message?.date
            ? new Date(message.date * 1000).toISOString()
            : new Date().toISOString(),
        isForwarded: Boolean(update.message?.forward_origin),
    };
};

type TelegramApiResponse<T> = {
    ok: boolean;
    result?: T;
    description?: string;
    error_code?: number;
};

export class TelegramApiError extends Error {
    constructor(
        message: string,
        readonly status: number,
        readonly code = 'TELEGRAM_API_ERROR',
    ) {
        super(message);
        this.name = 'TelegramApiError';
    }
}

export const callTelegramApi = async <T>(
    method: string,
    body: Record<string, unknown>,
    fetchImpl: typeof fetch = fetch,
): Promise<T> => {
    const { botToken } = getTelegramConfig();
    if (!botToken) throw new TelegramApiError('Telegram bot token is not configured.', 503, 'TELEGRAM_NOT_CONFIGURED');
    const response = await fetchImpl(`https://api.telegram.org/bot${botToken}/${method}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15_000),
    });
    const payload = await response.json().catch(() => ({})) as TelegramApiResponse<T>;
    if (!response.ok || !payload.ok || payload.result === undefined) {
        throw new TelegramApiError(
            payload.description || `Telegram ${method} failed.`,
            response.status || 502,
        );
    }
    return payload.result;
};

export const answerTelegramCallback = async (callbackQueryId: string, text = '') => (
    callTelegramApi<boolean>('answerCallbackQuery', {
        callback_query_id: callbackQueryId,
        ...(text ? { text: text.slice(0, 200) } : {}),
    })
);

export type TelegramInlineKeyboard = Array<Array<{
    text: string;
    url?: string;
    callback_data?: string;
}>>;

export const sendTelegramMessage = async ({
    chatId,
    text,
    keyboard,
}: {
    chatId: string;
    text: string;
    keyboard?: TelegramInlineKeyboard;
}) => callTelegramApi<{ message_id: number }>('sendMessage', {
    chat_id: chatId,
    text: text.slice(0, 4096),
    link_preview_options: { is_disabled: true },
    ...(keyboard ? { reply_markup: { inline_keyboard: keyboard } } : {}),
});

export const configureTelegramBot = async () => {
    const config = getTelegramConfig();
    if (!isTelegramConfigured()) {
        throw new TelegramApiError('Telegram is not configured.', 503, 'TELEGRAM_NOT_CONFIGURED');
    }
    const me = await callTelegramApi<{ username?: string }>('getMe', {});
    if (!me.username || me.username.toLowerCase() !== config.botUsername.toLowerCase()) {
        throw new TelegramApiError(
            `Configured Telegram username does not match @${me.username || 'unknown'}.`,
            500,
            'TELEGRAM_USERNAME_MISMATCH',
        );
    }
    await Promise.all([
        callTelegramApi<boolean>('setMyCommands', {
            commands: [
                { command: 'start', description: 'Connect or open Opportunity Tracker' },
                { command: 'help', description: 'See supported captures' },
                { command: 'settings', description: 'View Telegram settings' },
                { command: 'disconnect', description: 'Disconnect this Telegram account' },
            ],
        }),
        callTelegramApi<boolean>('setMyDescription', {
            description: 'Send opportunity links, notes, forwarded text, PDFs, images, or voice notes. They are processed through your existing Opportunity Tracker.',
        }),
        callTelegramApi<boolean>('setMyShortDescription', {
            short_description: 'Save opportunities to your personal radar from Telegram.',
        }),
    ]);
    await callTelegramApi<boolean>('setWebhook', {
        url: `${config.siteUrl}/api/integrations/telegram/webhook`,
        secret_token: config.webhookSecret,
        allowed_updates: ['message', 'callback_query'],
        drop_pending_updates: false,
        max_connections: 40,
    });
    const webhook = await callTelegramApi<{
        url?: string;
        pending_update_count?: number;
        last_error_message?: string;
    }>('getWebhookInfo', {});
    const expectedUrl = `${config.siteUrl}/api/integrations/telegram/webhook`;
    if (webhook.url !== expectedUrl) {
        throw new TelegramApiError('Telegram webhook verification failed.', 502, 'TELEGRAM_WEBHOOK_MISMATCH');
    }
    return {
        username: me.username,
        webhookUrl: webhook.url,
        pendingUpdateCount: webhook.pending_update_count || 0,
        lastErrorMessage: webhook.last_error_message || null,
    };
};

export const downloadTelegramFile = async (
    descriptor: TelegramFileDescriptor,
    fetchImpl: typeof fetch = fetch,
) => {
    if (descriptor.size > TELEGRAM_MAX_DOWNLOAD_BYTES) {
        throw new TelegramApiError('Telegram file is larger than 20 MB.', 413, 'TELEGRAM_FILE_TOO_LARGE');
    }
    const file = await callTelegramApi<{ file_path?: string; file_size?: number }>(
        'getFile',
        { file_id: descriptor.file_id },
        fetchImpl,
    );
    const size = Number(file.file_size) || descriptor.size;
    if (size > TELEGRAM_MAX_DOWNLOAD_BYTES || !file.file_path) {
        throw new TelegramApiError(
            size > TELEGRAM_MAX_DOWNLOAD_BYTES
                ? 'Telegram file is larger than 20 MB.'
                : 'Telegram did not return a downloadable file.',
            size > TELEGRAM_MAX_DOWNLOAD_BYTES ? 413 : 502,
            size > TELEGRAM_MAX_DOWNLOAD_BYTES ? 'TELEGRAM_FILE_TOO_LARGE' : 'TELEGRAM_FILE_UNAVAILABLE',
        );
    }
    const { botToken } = getTelegramConfig();
    const response = await fetchImpl(`https://api.telegram.org/file/bot${botToken}/${file.file_path}`, {
        signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) throw new TelegramApiError('Telegram file download failed.', response.status || 502);
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > TELEGRAM_MAX_DOWNLOAD_BYTES) {
        throw new TelegramApiError('Telegram file is larger than 20 MB.', 413, 'TELEGRAM_FILE_TOO_LARGE');
    }
    return bytes;
};
