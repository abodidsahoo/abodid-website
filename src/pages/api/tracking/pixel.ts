import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

export const GET: APIRoute = async ({ request }) => {
    try {
        const url = new URL(request.url);
        const broadcastId = url.searchParams.get('id');

        // Transparent 1x1 GIF
        const transparentGif = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');

        if (!broadcastId) {
            return new Response(transparentGif, {
                headers: { 'Content-Type': 'image/gif' }
            });
        }

        const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
        const supabaseKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY; // Use Service Key for writing without user session

        if (supabaseUrl && supabaseKey) {
            const supabase = createClient(supabaseUrl, supabaseKey);

            // Fire and forget insert (don't await to keep response fast)
            supabase.from('newsletter_opens').insert({
                broadcast_id: broadcastId,
                // We'll trust the DB's default for opened_at
                // IP tracking is tricky in serverless/edge, often obscured. 
                // We'll skip IP for privacy/technical simplicity for now or stick to basic logging if needed.
            }).then(({ error }) => {
                if (error) console.error('Pixel log error:', error);
            });
        }

        return new Response(transparentGif, {
            status: 200,
            headers: {
                'Content-Type': 'image/gif',
                'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0',
            }
        });

    } catch (e) {
        // Fail silently with visual response
        const transparentGif = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
        return new Response(transparentGif, { headers: { 'Content-Type': 'image/gif' } });
    }
};
