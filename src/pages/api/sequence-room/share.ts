export const prerender = false;

import type { APIRoute } from 'astro';
import { randomBytes } from 'node:crypto';
import { createSupabaseServiceClient } from '../../../lib/supabaseServer';
import {
    assertOwnedBoard,
    authorizeSequenceRoomUser,
    sequenceRoomJson,
} from '../../../lib/sequence-room/server';

const serializeBoard = (board: Record<string, any>, items: Array<Record<string, any>>, shareToken: string) => ({
    id: board.id,
    name: board.name,
    logicalWidth: board.logical_width,
    logicalHeight: board.logical_height,
    backgroundColor: board.background_color || '#fff8e8',
    items: items.map((item) => {
        const asset = Array.isArray(item.user_photo_assets)
            ? item.user_photo_assets[0]
            : item.user_photo_assets;
        return {
            id: item.id,
            assetId: item.asset_id,
            image: asset?.is_library_asset
                ? asset.working_url
                : `/api/sequence-room/photo/${item.asset_id}?share=${encodeURIComponent(shareToken)}`,
            title: 'Photograph',
            x: item.x,
            y: item.y,
            rotation: item.rotation,
            scale: item.scale,
            zIndex: item.z_index,
        };
    }).filter((item) => item.image),
});

export const GET: APIRoute = async ({ request }) => {
    const token = new URL(request.url).searchParams.get('token') || '';
    if (!/^[A-Za-z0-9_-]{32,128}$/.test(token)) return sequenceRoomJson({ error: 'Shared board not found.' }, 404);
    const supabase = createSupabaseServiceClient();
    if (!supabase) return sequenceRoomJson({ error: 'Shared board is unavailable.' }, 503);

    const { data: board, error } = await supabase
        .from('sequence_room_boards')
        .select('id,name,logical_width,logical_height,background_color')
        .eq('share_token', token)
        .eq('sharing_enabled', true)
        .maybeSingle();
    if (error || !board) return sequenceRoomJson({ error: 'Shared board not found.' }, 404);

    const { data: items, error: itemError } = await supabase
        .from('sequence_room_items')
        .select('id,asset_id,x,y,rotation,scale,z_index,user_photo_assets(working_url,is_library_asset)')
        .eq('board_id', board.id)
        .eq('is_rejected', false)
        .order('z_index');
    if (itemError) return sequenceRoomJson({ error: 'Shared board is unavailable.' }, 500);
    return sequenceRoomJson({ board: serializeBoard(board, items || [], token) });
};

export const POST: APIRoute = async ({ request }) => {
    const authorization = await authorizeSequenceRoomUser(request);
    if (!authorization.ok) return authorization.response;

    try {
        const body = await request.json();
        const boardId = typeof body?.boardId === 'string' ? body.boardId : '';
        const enabled = body?.enabled !== false;
        const board = await assertOwnedBoard(authorization.supabase, authorization.user.id, boardId);
        if (!board) return sequenceRoomJson({ error: 'Board not found.' }, 404);

        const shareToken = enabled ? randomBytes(32).toString('base64url') : null;
        const { error } = await authorization.supabase
            .from('sequence_room_boards')
            .update({ sharing_enabled: enabled, share_token: shareToken })
            .eq('id', boardId)
            .eq('user_id', authorization.user.id);
        if (error) throw error;

        return sequenceRoomJson({
            enabled,
            shareUrl: enabled ? `${new URL(request.url).origin}/lab/sequence-room/share/${shareToken}` : null,
        });
    } catch (error) {
        console.error('Sequence Room sharing failed:', error);
        return sequenceRoomJson({ error: 'Sharing could not be updated.' }, 500);
    }
};
