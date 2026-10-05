import { createHmac } from 'node:crypto';

const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
export const CONTACT_RATE_LIMIT_MAX = 6;
export const CONTACT_RATE_LIMIT_WINDOW_SECONDS = 15 * 60;

const envValue = (name) => {
    const astroValue = typeof import.meta !== 'undefined' ? import.meta.env?.[name] : undefined;
    return astroValue || process.env[name] || '';
};

export const getContactClientIp = (request) => (
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
).slice(0, 80);

export const contactRateLimitKey = (request, secret = '') => {
    const salt = secret || envValue('CONTACT_RATE_LIMIT_SECRET') || envValue('TURNSTILE_SECRET_KEY');
    if (!salt) return '';
    return createHmac('sha256', salt).update(getContactClientIp(request)).digest('hex');
};

export const consumeContactRateLimit = async ({ supabase, request, secret = '' }) => {
    const keyHash = contactRateLimitKey(request, secret);
    if (!keyHash || getContactClientIp(request) === 'unknown') {
        return { allowed: true, retryAfter: 0, enforced: false };
    }

    const { data, error } = await supabase.rpc('consume_contact_rate_limit', {
        p_key_hash: keyHash,
        p_limit: CONTACT_RATE_LIMIT_MAX,
        p_window_seconds: CONTACT_RATE_LIMIT_WINDOW_SECONDS,
    });

    if (error) {
        // Turnstile still protects the endpoint if a migration is briefly unavailable.
        console.error('[contact] Durable rate limit unavailable:', error.message);
        return { allowed: true, retryAfter: 0, enforced: false };
    }

    const result = Array.isArray(data) ? data[0] : data;
    return {
        allowed: result?.allowed === true,
        retryAfter: Math.max(0, Number(result?.retry_after_seconds) || 0),
        enforced: true,
    };
};

export const verifyContactTurnstile = async ({
    request,
    token,
    fetchImpl = fetch,
    secret = envValue('TURNSTILE_SECRET_KEY'),
    allowLocalPreview = Boolean(import.meta.env?.DEV),
}) => {
    const hostname = new URL(request.url).hostname;
    if (allowLocalPreview && ['localhost', '127.0.0.1', '::1'].includes(hostname) && token === 'local-preview') {
        return { success: true, method: 'local-preview' };
    }
    if (!secret || !token || token.length > 2048) {
        return { success: false, method: 'turnstile', reason: 'missing-or-invalid-token' };
    }

    const form = new FormData();
    form.set('secret', secret);
    form.set('response', token);
    const remoteIp = getContactClientIp(request);
    if (remoteIp !== 'unknown') form.set('remoteip', remoteIp);
    form.set('idempotency_key', crypto.randomUUID());

    try {
        const response = await fetchImpl(TURNSTILE_VERIFY_URL, {
            method: 'POST',
            body: form,
            signal: AbortSignal.timeout(8000),
        });
        if (!response.ok) return { success: false, method: 'turnstile', reason: 'verification-unavailable' };

        const result = await response.json();
        const validHostname = !result.hostname || result.hostname === hostname;
        return {
            success: result.success === true && result.action === 'contact' && validHostname,
            method: 'turnstile',
            reason: result.success === true ? 'invalid-context' : 'challenge-rejected',
        };
    } catch {
        return { success: false, method: 'turnstile', reason: 'verification-unavailable' };
    }
};
