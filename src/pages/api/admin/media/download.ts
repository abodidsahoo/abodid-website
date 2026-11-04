export const prerender = false;

import type { APIRoute } from 'astro';
import { authorizeAdminRequest, jsonResponse } from '../../../../lib/admin/serverAuth';
import { assertSafeR2ObjectKey, streamR2Object } from '../../../../lib/media/r2';

export const POST: APIRoute = async ({ request }) => {
    const authorization = await authorizeAdminRequest(request);
    if (!authorization.ok) return authorization.response;

    let objectKey: string;
    try {
        const body = await request.json();
        if (typeof body?.objectKey !== 'string' || body.objectKey.endsWith('/')) throw new Error('Select a file.');
        objectKey = assertSafeR2ObjectKey(body.objectKey);
    } catch {
        return jsonResponse({ error: 'The download selection contains an invalid file key.' }, 400);
    }

    try {
        // Stream through the same origin: R2's existing CORS policy allows PUT
        // but not browser GET. Do not buffer a large file in a Vercel response.
        return new Response(await streamR2Object(objectKey), {
            headers: {
                'Content-Type': 'application/octet-stream',
                'Content-Disposition': 'attachment',
                'Cache-Control': 'no-store',
                'X-Content-Type-Options': 'nosniff',
            },
        });
    } catch (error) {
        console.error('Could not download media:', error);
        const missing = (error as { name?: string })?.name === 'NoSuchKey';
        return jsonResponse({ error: missing ? 'The selected file no longer exists.' : 'Could not download the selected file.' }, missing ? 404 : 500);
    }
};
