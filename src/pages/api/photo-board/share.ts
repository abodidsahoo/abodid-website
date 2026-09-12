export const prerender = false;

import type { APIRoute } from 'astro';
import { randomBytes } from 'node:crypto';
import { createSupabaseServiceClient } from '../../../lib/supabaseServer';
import {
    assertOwnedBoard,
    authorizePhotoBoardUser,
    photoBoardJson,
} from '../../../lib/photoboard/server';

const serializeBoard = (board: Record<string, any>, items: Array<Record<string, any>>) => ({
    id: board.id,
    name: board.name,
    logicalWidth: board.logical_width,
    logicalHeight: board.logical_height,
    items: items.map((item) => {
        const asset = Array.isArray(item.user_photo_assets)
            ? item.user_photo_assets[0]
            : item.user_photo_assets;
        return {
            id: item.id,
            assetId: item.asset_id,
            image: asset?.working_url,
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
    if (!/^[A-Za-z0-9_-]{32,128}$/.test(token)) return photoBoardJson({ error: 'Shared board not found.' }, 404);
    const supabase = createSupabaseServiceClient();
    if (!supabase) return photoBoardJson({ error: 'Shared board is unavailable.' }, 503);

    const { data: board, error } = await supabase
        .from('photo_boards')
        .select('id,name,logical_width,logical_height')
        .eq('share_token', token)
        .eq('sharing_enabled', true)
        .maybeSingle();
    if (error || !board) return photoBoardJson({ error: 'Shared board not found.' }, 404);

    const { data: items, error: itemError } = await supabase
        .from('photo_board_items')
        .select('id,asset_id,x,y,rotation,scale,z_index,user_photo_assets(working_url)')
        .eq('board_id', board.id)
        .order('z_index');
    if (itemError) return photoBoardJson({ error: 'Shared board is unavailable.' }, 500);
    return photoBoardJson({ board: serializeBoard(board, items || []) });
};

export const POST: APIRoute = async ({ request }) => {
    const authorization = await authorizePhotoBoardUser(request);
    if (!authorization.ok) return authorization.response;

    try {
        const body = await request.json();
        const boardId = typeof body?.boardId === 'string' ? body.boardId : '';
        const enabled = body?.enabled !== false;
        const board = await assertOwnedBoard(authorization.supabase, authorization.user.id, boardId);
        if (!board) return photoBoardJson({ error: 'Board not found.' }, 404);

        const shareToken = enabled ? randomBytes(32).toString('base64url') : null;
        const { error } = await authorization.supabase
            .from('photo_boards')
            .update({ sharing_enabled: enabled, share_token: shareToken })
            .eq('id', boardId)
            .eq('user_id', authorization.user.id);
        if (error) throw error;

        return photoBoardJson({
            enabled,
            shareUrl: enabled ? `${new URL(request.url).origin}/lab/photo-board/share/${shareToken}` : null,
        });
    } catch (error) {
        console.error('Photo Board sharing failed:', error);
        return photoBoardJson({ error: 'Sharing could not be updated.' }, 500);
    }
};
