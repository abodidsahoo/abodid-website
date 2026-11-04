import { FeedbackValidationError } from './schema';

export function isSameOrigin(request: Request) {
    const origin = request.headers.get('origin');
    return (!origin || origin === new URL(request.url).origin) && request.headers.get('sec-fetch-site') !== 'cross-site';
}

export function normalizeEmail(value: FormDataEntryValue | null, required = false) {
    if (value !== null && typeof value !== 'string') throw new FeedbackValidationError('Please enter a valid email.');
    const email = String(value || '').trim().toLowerCase();
    if ((required && !email) || email.length > 254 || (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
        throw new FeedbackValidationError('Please enter a valid email, or leave the optional field blank.');
    }
    return email;
}

export async function readFeedbackForm(request: Request) {
    const reader = request.body?.getReader();
    if (!reader) throw new FeedbackValidationError('Please complete the form.');
    const chunks: Uint8Array[] = [];
    let length = 0;
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        length += value.length;
        if (length > 96 * 1024) {
            await reader.cancel();
            throw new FeedbackValidationError('Your response is too long. Please shorten it.');
        }
        chunks.push(value);
    }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    try {
        return await new Response(bytes, { headers: { 'Content-Type': request.headers.get('content-type') || '' } }).formData();
    } catch {
        throw new FeedbackValidationError('Please submit using the form.');
    }
}
