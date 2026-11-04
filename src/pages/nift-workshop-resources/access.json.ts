import type { APIRoute } from 'astro';
import { requestReceipt, receiptCookie, clearLegacyReceiptCookie } from '../../lib/feedback/receipt';

export const prerender = false;
export const GET: APIRoute = ({ request }) => {
    const access = requestReceipt(request);
    const response = Response.json({ unlocked: Boolean(access) }, { headers: { 'Cache-Control': 'private, no-store', Vary: 'Cookie' } });
    if (access) {
        response.headers.append('Set-Cookie', receiptCookie(access.value, request));
        response.headers.append('Set-Cookie', clearLegacyReceiptCookie(request));
    }
    return response;
};
