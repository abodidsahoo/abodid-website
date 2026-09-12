export const prerender = false;

import type { APIRoute } from 'astro';
import { deleteR2Objects } from '../../../lib/media/r2';
import {
    assertOwnedBoard,
    authorizePhotoBoardUser,
    photoBoardJson,
} from '../../../lib/photoboard/server';

export const POST: APIRoute = async ({ request }) => {
    const authorization = await authorizePhotoBoardUser(request);
    if (!authorization.ok) return authorization.response;

    try {
        const body = await request.json();
        const boardId = typeof body?.boardId === 'string' ? body.boardId : '';
        if (!boardId || !await assertOwnedBoard(authorization.supabase, authorization.user.id, boardId)) {
            return photoBoardJson({ error: 'Board not found.' }, 404);
        }

        const { data: items, error: itemError } = await authorization.supabase
            .from('photo_board_items')
            .select('asset_id,user_photo_assets(id,cloudflare_key)')
            .eq('board_id', boardId);
        if (itemError) throw itemError;

        const { error: boardError } = await authorization.supabase
            .from('photo_boards')
            .delete()
            .eq('id', boardId)
            .eq('user_id', authorization.user.id);
        if (boardError) throw boardError;

        const assetIds = [...new Set((items || []).map((item) => item.asset_id))];
        for (const assetId of assetIds) {
            const { count } = await authorization.supabase
                .from('photo_board_items')
                .select('id', { count: 'exact', head: true })
                .eq('asset_id', assetId);
            if ((count || 0) > 0) continue;
            const source = (items || []).find((item) => item.asset_id === assetId);
            const relation = Array.isArray(source?.user_photo_assets)
                ? source.user_photo_assets[0]
                : source?.user_photo_assets;
            if (!relation?.cloudflare_key) continue;
            try {
                const result = await deleteR2Objects([relation.cloudflare_key]);
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

        return photoBoardJson({ deleted: true });
    } catch (error) {
        console.error('Photo Board deletion failed:', error);
        return photoBoardJson({ error: 'The board could not be deleted.' }, 500);
    }
};
