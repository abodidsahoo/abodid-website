export const prerender = false;

import type { APIRoute } from 'astro';
import { getR2ObjectBytes } from '../../../../lib/media/r2';
import { createSupabaseServiceClient } from '../../../../lib/supabaseServer';
import {
    authorizeSequenceRoomUser,
    sequenceRoomJson,
} from '../../../../lib/sequence-room/server';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHARE_TOKEN = /^[A-Za-z0-9_-]{32,128}$/;

export const GET: APIRoute = async ({ params, request }) => {
    const assetId = String(params.assetId || '');
    if (!UUID.test(assetId)) return sequenceRoomJson({ error: 'Photograph not found.' }, 404);

    const shareToken = new URL(request.url).searchParams.get('share') || '';
    const service = createSupabaseServiceClient();
    if (!service) return sequenceRoomJson({ error: 'Photograph storage is unavailable.' }, 503);

    let userId = '';
    if (shareToken) {
        if (!SHARE_TOKEN.test(shareToken)) return sequenceRoomJson({ error: 'Photograph not found.' }, 404);
        const { data: sharedItem, error } = await service
            .from('sequence_room_items')
            .select('id,sequence_room_boards!inner(user_id,sharing_enabled,share_token)')
            .eq('asset_id', assetId)
            .eq('sequence_room_boards.sharing_enabled', true)
            .eq('sequence_room_boards.share_token', shareToken)
            .limit(1)
            .maybeSingle();
        if (error || !sharedItem) return sequenceRoomJson({ error: 'Photograph not found.' }, 404);
        const board = Array.isArray(sharedItem.sequence_room_boards)
            ? sharedItem.sequence_room_boards[0]
            : sharedItem.sequence_room_boards;
        userId = board?.user_id || '';
    } else {
        const authorization = await authorizeSequenceRoomUser(request);
        if (!authorization.ok) return authorization.response;
        userId = authorization.user.id;
    }

    const { data: asset, error } = await service
        .from('user_photo_assets')
        .select('id,user_id,cloudflare_key,working_url,mime_type,is_library_asset')
        .eq('id', assetId)
        .eq('user_id', userId)
        .maybeSingle();
    if (error || !asset) return sequenceRoomJson({ error: 'Photograph not found.' }, 404);

    if (asset.is_library_asset) {
        return Response.redirect(asset.working_url, 302);
    }

    try {
        const bytes = await getR2ObjectBytes(asset.cloudflare_key);
        return new Response(bytes, {
            headers: {
                'Content-Type': asset.mime_type || 'image/jpeg',
                'Cache-Control': 'private, max-age=300',
                'X-Content-Type-Options': 'nosniff',
            },
        });
    } catch (error) {
        console.error('Sequence Room photo delivery failed:', error);
        return sequenceRoomJson({ error: 'Photograph could not be loaded.' }, 500);
    }
};
