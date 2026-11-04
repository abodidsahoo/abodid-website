import { createHmac, timingSafeEqual } from 'node:crypto';

export const NIFT_SLUG = 'nift-bhubaneswar-space-materiality-2026-11-03';
export const NIFT_RESOURCES_PATH = '/nift-workshop-resources';
export const RECEIPT_COOKIE = 'nift_lecture_receipt';
const MAX_AGE = 30 * 24 * 3600;
const secret = () => import.meta.env?.FEEDBACK_RECEIPT_SECRET || process.env.FEEDBACK_RECEIPT_SECRET
    || import.meta.env?.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
    || import.meta.env?.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_KEY || '';

export function createReceipt(slug: string, responseId: string, signingSecret = secret()) {
    if (!signingSecret) throw new Error('Feedback receipt signing is unavailable.');
    const payload = Buffer.from(JSON.stringify({ slug, id: responseId, expires: Date.now() + MAX_AGE * 1000 })).toString('base64url');
    return `${payload}.${createHmac('sha256', signingSecret).update(payload).digest('base64url')}`;
}

export type FeedbackReceipt = { slug: string; id: string; expires: number };

export function readReceipt(value: string | undefined, slug: string, signingSecret = secret()): FeedbackReceipt | null {
    if (!value || value.length > 1024 || !signingSecret) return null;
    try {
        const [payload, signature, extra] = value.split('.');
        if (!payload || !signature || extra) return null;
        const expected = createHmac('sha256', signingSecret).update(payload).digest();
        const actual = Buffer.from(signature, 'base64url');
        if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
        const receipt = JSON.parse(Buffer.from(payload, 'base64url').toString());
        return receipt.slug === slug && typeof receipt.id === 'string' && Boolean(receipt.id)
            && Number.isFinite(receipt.expires) && receipt.expires > Date.now() ? receipt : null;
    } catch { return null; }
}

export function verifyReceipt(value: string | undefined, slug: string, signingSecret = secret()) {
    return Boolean(readReceipt(value, slug, signingSecret));
}

export function followUpToken(receipt: FeedbackReceipt, signingSecret = secret()) {
    if (!signingSecret) throw new Error('Feedback receipt signing is unavailable.');
    return createHmac('sha256', signingSecret).update(`photography-follow-up:${receipt.slug}:${receipt.id}:${receipt.expires}`).digest('hex');
}

export function verifyFollowUpToken(value: FormDataEntryValue | null, receipt: FeedbackReceipt) {
    if (typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value)) return false;
    return timingSafeEqual(Buffer.from(value, 'hex'), Buffer.from(followUpToken(receipt), 'hex'));
}

export function receiptCookie(value: string, request: Request) {
    return `${RECEIPT_COOKIE}=${value}; Path=/; Max-Age=${MAX_AGE}; HttpOnly; SameSite=Lax${new URL(request.url).protocol === 'https:' ? '; Secure' : ''}`;
}

export function requestReceipt(request: Request) {
    // During migration a browser may send both the old path-scoped cookie and the new one.
    // Prefer the most recent valid proof rather than whichever cookie happens to come first.
    return (request.headers.get('cookie') || '').split(';').map((part) => part.trim())
        .filter((part) => part.startsWith(`${RECEIPT_COOKIE}=`))
        .map((part) => { const value = part.slice(RECEIPT_COOKIE.length + 1); return { value, receipt: readReceipt(value, NIFT_SLUG) }; })
        .filter((entry): entry is { value: string; receipt: FeedbackReceipt } => Boolean(entry.receipt))
        .sort((a, b) => b.receipt.expires - a.receipt.expires)[0] || null;
}

export function clearLegacyReceiptCookie(request: Request) {
    return `${RECEIPT_COOKIE}=; Path=${NIFT_RESOURCES_PATH}; Max-Age=0; HttpOnly; SameSite=Lax${new URL(request.url).protocol === 'https:' ? '; Secure' : ''}`;
}
