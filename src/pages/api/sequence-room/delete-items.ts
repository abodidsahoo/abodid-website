export const prerender = false;

import type { APIRoute } from 'astro';
import { deleteR2Objects } from '../../../lib/media/r2';
import {
    assertOwnedBoard,
    authorizeSequenceRoomUser,
    sequenceRoomJson,
} from '../../../lib/sequence-room/server';

export const POST: APIRoute = async ({ request }) => {
    const authorization = await authorizeSequenceRoomUser(request);
    if (!authorization.ok) return authorization.response;

    try {
        const body = await request.json();
        const boardId = typeof body?.boardId === 'string' ? body.boardId : '';
        const itemIds = Array.isArray(body?.itemIds)
            ? [...new Set(body.itemIds.filter((id: unknown) => typeof id === 'string'))].slice(0, 30)
            : [];
        if (!boardId || !itemIds.length) return sequenceRoomJson({ error: 'Choose photos to delete.' }, 400);
        if (!await assertOwnedBoard(authorization.supabase, authorization.user.id, boardId)) {
            return sequenceRoomJson({ error: 'Board not found.' }, 404);
        }

        const { data: items, error: itemError } = await authorization.supabase
            .from('sequence_room_items')
            .select('id,asset_id,user_photo_assets(id,cloudflare_key,is_library_asset)')
            .eq('board_id', boardId)
            .in('id', itemIds);
        if (itemError) throw itemError;

        const { error: deleteError } = await authorization.supabase
            .from('sequence_room_items')
            .delete()
            .eq('board_id', boardId)
            .in('id', itemIds);
        if (deleteError) throw deleteError;

        for (const item of items || []) {
            const assetId = item.asset_id;
            const { count } = await authorization.supabase
                .from('sequence_room_items')
                .select('id', { count: 'exact', head: true })
                .eq('asset_id', assetId);
            if ((count || 0) > 0) continue;

            const assetRelation = Array.isArray(item.user_photo_assets)
                ? item.user_photo_assets[0]
                : item.user_photo_assets;
            const key = assetRelation?.cloudflare_key;
            if (!key) continue;
            if (assetRelation?.is_library_asset) {
                await authorization.supabase
                    .from('user_photo_assets')
                    .delete()
                    .eq('id', assetId)
                    .eq('user_id', authorization.user.id);
                continue;
            }
            try {
                const result = await deleteR2Objects([key]);
                if (result.errors.length) throw new Error('R2_DELETE_FAILED');
                await authorization.supabase
                    .from('user_photo_assets')
                    .delete()
                    .eq('id', assetId)
                    .eq('user_id', authorization.user.id);
            } catch {
                await authorization.supabase
                    .from('user_photo_assets')
                    .update({ pending_delete: true })
                    .eq('id', assetId)
                    .eq('user_id', authorization.user.id);
            }
        }

        return sequenceRoomJson({ deleted: (items || []).map((item) => item.id) });
    } catch (error) {
        console.error('Sequence Room delete failed:', error);
        return sequenceRoomJson({ error: 'The selected photos could not be deleted.' }, 500);
    }
};
