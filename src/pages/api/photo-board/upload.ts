export const prerender = false;

import type { APIRoute } from 'astro';
import { randomUUID } from 'node:crypto';
import { deleteR2Objects, putR2Object } from '../../../lib/media/r2';
import {
    assertOwnedBoard,
    authorizePhotoBoardUser,
    photoBoardJson,
} from '../../../lib/photoboard/server';

const MAX_WORKING_BYTES = 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

const safeDimension = (value: FormDataEntryValue | null) => {
    const number = Number(value);
    return Number.isSafeInteger(number) && number > 0 && number <= 50_000 ? number : 0;
};

export const POST: APIRoute = async ({ request }) => {
    const authorization = await authorizePhotoBoardUser(request);
    if (!authorization.ok) return authorization.response;

    let objectKey = '';
    let assetId = '';
    try {
        const form = await request.formData();
        const boardId = String(form.get('boardId') || '');
        const file = form.get('file');
        const width = safeDimension(form.get('width'));
        const height = safeDimension(form.get('height'));
        const x = Number(form.get('x') || 0);
        const y = Number(form.get('y') || 0);
        const rotation = Number(form.get('rotation') || 0);
        const zIndex = Number(form.get('zIndex') || 1);

        if (!(file instanceof File) || !ALLOWED_TYPES.has(file.type) || file.size <= 0 || file.size > MAX_WORKING_BYTES) {
            return photoBoardJson({ error: 'Upload a JPEG, PNG or WebP working copy no larger than 1 MB.' }, 400);
        }
        if (!width || !height || !Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(rotation)) {
            return photoBoardJson({ error: 'Invalid photo metadata.' }, 400);
        }

        const board = await assertOwnedBoard(authorization.supabase, authorization.user.id, boardId);
        if (!board) return photoBoardJson({ error: 'Board not found.' }, 404);

        const { count, error: countError } = await authorization.supabase
            .from('photo_board_items')
            .select('id', { count: 'exact', head: true })
            .eq('board_id', boardId);
        if (countError) throw countError;
        if ((count || 0) >= 30) {
            return photoBoardJson({ error: 'The free plan allows 30 photos per board.', code: 'FREE_PHOTO_LIMIT' }, 409);
        }

        const extension = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
        objectKey = `photo-board/${authorization.user.id}/${randomUUID()}.${extension}`;
        const bytes = new Uint8Array(await file.arrayBuffer());
        const uploaded = await putR2Object({ objectKey, body: bytes, contentType: file.type });

        const { data: asset, error: assetError } = await authorization.supabase
            .from('user_photo_assets')
            .insert({
                user_id: authorization.user.id,
                cloudflare_key: uploaded.objectKey,
                working_url: uploaded.publicUrl,
                stored_bytes: file.size,
                width,
                height,
                mime_type: file.type,
            })
            .select('*')
            .single();
        if (assetError) throw assetError;
        assetId = asset.id;

        const itemId = randomUUID();
        const { data: item, error: itemError } = await authorization.supabase
            .from('photo_board_items')
            .insert({
                id: itemId,
                board_id: boardId,
                asset_id: asset.id,
                x,
                y,
                rotation,
                scale: 1,
                z_index: Number.isSafeInteger(zIndex) ? zIndex : 1,
            })
            .select('*')
            .single();
        if (itemError) throw itemError;

        return photoBoardJson({
            item: {
                id: item.id,
                assetId: asset.id,
                image: asset.working_url,
                width: asset.width,
                height: asset.height,
                x: item.x,
                y: item.y,
                rotation: item.rotation,
                scale: item.scale,
                zIndex: item.z_index,
            },
        });
    } catch (error) {
        if (objectKey) await deleteR2Objects([objectKey]).catch(() => undefined);
        if (assetId) {
            await authorization.supabase.from('user_photo_assets').delete().eq('id', assetId).catch(() => undefined);
        }
        console.error('Photo Board upload failed:', error);
        const message = error instanceof Error ? error.message : 'Upload failed.';
        const quota = message.includes('FREE_PHOTO_LIMIT');
        return photoBoardJson({ error: quota ? 'The free plan allows 30 photos per board.' : 'The photo could not be uploaded.', code: quota ? 'FREE_PHOTO_LIMIT' : 'UPLOAD_FAILED' }, quota ? 409 : 500);
    }
};
