import { invalidateLibraryIndex } from '../../../../lib/media/libraryIndex';
export const prerender = false;
import type { APIRoute } from 'astro';
import { randomUUID } from 'node:crypto';
import { authorizeAdminRequest, jsonResponse } from '../../../../lib/admin/serverAuth';
import { assertSafeR2ObjectKey, buildR2PublicUrl, copyR2Object, getR2Basename, getR2Config, headR2Object, listR2Folder, makeAvailableR2ObjectKey, normalizeR2FolderPath } from '../../../../lib/media/r2';
import { assertVisibleLibraryFolder } from '../../../../lib/media/libraryFolders';
import { libraryFolder } from '../../../../lib/media/libraryCatalogue';

export const POST: APIRoute = async ({ request }) => {
    const authorization = await authorizeAdminRequest(request);
    if (!authorization.ok) return authorization.response;
    let keys: string[], destination: string, action: 'copy' | 'move';
    try {
        const body = await request.json();
        if (!['copy', 'move'].includes(body?.action) || !Array.isArray(body.objectKeys) || !body.objectKeys.length || body.objectKeys.length > 100 || typeof body.destinationFolder !== 'string') throw new Error();
        destination = normalizeR2FolderPath(body.destinationFolder);
        if (destination !== body.destinationFolder) throw new Error();
        keys = [...new Set<string>(body.objectKeys.map((key: unknown) => {
            if (typeof key !== 'string' || key.endsWith('/')) throw new Error();
            return assertSafeR2ObjectKey(key);
        }))];
        action = body.action;
    } catch {
        return jsonResponse({ error: 'Choose up to 100 files and a valid destination folder.' }, 400);
    }
    try {
        const config = getR2Config();
        await assertVisibleLibraryFolder(authorization.supabase, config.bucket, destination);
        if (destination) {
            const parent = destination.split('/').slice(0, -1).join('/');
            const browser = await listR2Folder(parent);
            if (!browser.folders.includes(destination)) return jsonResponse({ error: 'The destination folder no longer exists.' }, 404);
        }
        const results: any[] = [];
        // Bound concurrent storage/database work, and report partial results explicitly.
        for (let offset = 0; offset < keys.length; offset += 4) {
            results.push(...await Promise.all(keys.slice(offset, offset + 4).map(async (objectKey) => {
                try {
                    const { data: existing, error: lookupError } = await authorization.supabase.from('media_assets')
                        .select('*').eq('storage_provider', 'cloudflare_r2').eq('storage_bucket', config.bucket).eq('object_key', objectKey).maybeSingle();
                    if (lookupError) throw lookupError;
                    if (action === 'move' && libraryFolder(existing || { object_key: objectKey }) === destination) return { objectKey, unchanged: true, folderPath: destination };
                    const { object } = await headR2Object(objectKey);
                    const fallback = {
                        storage_provider: 'cloudflare_r2', storage_bucket: config.bucket, object_key: objectKey,
                        folder_path: objectKey.split('/').slice(0, -1).join('/'), public_url: buildR2PublicUrl(config, objectKey),
                        original_filename: getR2Basename(objectKey), mime_type: object.ContentType || 'application/octet-stream',
                        file_size: Number(object.ContentLength || 0), etag: object.ETag?.replace(/^"|"$/g, '') || null,
                        created_by: authorization.user.id,
                    };
                    if (action === 'move') {
                        // Ignore existing rows: moving must never replace captions, manual
                        // tags, processing metadata, variants, or project relationships.
                        if (!existing) {
                            const { error } = await authorization.supabase.from('media_assets').upsert(fallback, { onConflict: 'storage_provider,storage_bucket,object_key', ignoreDuplicates: true });
                            if (error) throw error;
                        }
                        const { data, error } = await authorization.supabase.from('media_assets').update({ library_folder_path: destination })
                            .eq('storage_provider', 'cloudflare_r2').eq('storage_bucket', config.bucket).eq('object_key', objectKey).select('object_key').single();
                        if (error || !data) throw error || new Error('Could not save the folder location.');
                        return { objectKey, newObjectKey: objectKey, folderPath: destination };
                    }
                    // Fresh storage keys avoid overwriting files, including concurrent
                    // pastes with the same displayed filename. Public display names stay intact.
                    const basename = getR2Basename(objectKey);
                    const dot = basename.lastIndexOf('.');
                    const stem = dot > 0 ? basename.slice(0, dot) : basename;
                    const extension = dot > 0 ? basename.slice(dot) : '';
                    const newKey = await makeAvailableR2ObjectKey(destination, `${stem.slice(0, 60)}-copy-${randomUUID().slice(0, 12)}${extension}`);
                    await copyR2Object(objectKey, newKey);
                    const record = { ...fallback, object_key: newKey, folder_path: destination, library_folder_path: null,
                        public_url: buildR2PublicUrl(config, newKey), original_filename: existing?.library_filename || existing?.original_filename || fallback.original_filename,
                        library_filename: existing?.library_filename || existing?.original_filename || fallback.original_filename,
                        alt_text: existing?.alt_text || '', caption: existing?.caption || '', credit: existing?.credit || '',
                        width: existing?.width || null, height: existing?.height || null,
                    };
                    const { error } = await authorization.supabase.from('media_assets').upsert(record, { onConflict: 'storage_provider,storage_bucket,object_key' });
                    if (error) throw new Error('The copy reached storage but its library record could not be saved. Refresh the destination before retrying.');
                    return { objectKey, newObjectKey: newKey, folderPath: destination };
                } catch (error) {
                    console.error(`Could not ${action} media file:`, error);
                    return { objectKey, error: (error as { message?: string })?.message || 'The file could not be organized.' };
                }
            })));
        }
        return jsonResponse({ action, results });
    } catch (error) {
        console.error('Could not organize media files:', error);
        return jsonResponse({ error: 'Could not open the destination folder. Please refresh and try again.' }, 500);
    } finally {
        invalidateLibraryIndex();
    }
};
