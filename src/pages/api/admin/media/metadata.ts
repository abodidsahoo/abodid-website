import { invalidateLibraryIndex } from '../../../../lib/media/libraryIndex';
export const prerender = false;
import type { APIRoute } from 'astro';
import { authorizeAdminRequest, jsonResponse } from '../../../../lib/admin/serverAuth';
import { assertSafeR2ObjectKey, buildR2PublicUrl, getR2Config, getR2Basename, headR2Object } from '../../../../lib/media/r2';

export const POST: APIRoute = async ({ request }) => {
    const authorization = await authorizeAdminRequest(request);
    if (!authorization.ok) return authorization.response;
    let key: string, name: string | undefined, altText: string | undefined;
    try {
        const body = await request.json();
        if (typeof body.objectKey !== 'string' || body.objectKey.endsWith('/')) throw new Error();
        key = assertSafeR2ObjectKey(body.objectKey);
        if (body.name !== undefined) {
            if (typeof body.name !== 'string') throw new Error();
            name = body.name.trim();
            if (!name || name.length > 255 || /[\\/\x00-\x1f\x7f]/.test(name) || /^\.+$/.test(name)) throw new Error();
        }
        if (body.altText !== undefined) {
            if (typeof body.altText !== 'string' || body.altText.length > 2000) throw new Error();
            altText = body.altText;
        }
        if (name === undefined && altText === undefined) throw new Error();
    } catch {
        return jsonResponse({ error: 'Enter a valid filename (up to 255 characters) or image description (up to 2,000 characters).' }, 400);
    }
    try {
        const config = getR2Config();
        const { object } = await headR2Object(key);
        if (altText !== undefined && !object.ContentType?.startsWith('image/')) return jsonResponse({ error: 'Image descriptions are available for image files.' }, 400);
        const { error: registerError } = await authorization.supabase.from('media_assets').upsert({
            storage_provider: 'cloudflare_r2', storage_bucket: config.bucket, object_key: key,
            folder_path: key.split('/').slice(0, -1).join('/'), public_url: buildR2PublicUrl(config, key),
            original_filename: getR2Basename(key), mime_type: object.ContentType || 'application/octet-stream',
            file_size: Number(object.ContentLength || 0), created_by: authorization.user.id,
        }, { onConflict: 'storage_provider,storage_bucket,object_key', ignoreDuplicates: true });
        if (registerError) throw registerError;
        const { data, error } = await authorization.supabase.from('media_assets')
            .update({ ...(name === undefined ? {} : { library_filename: name }), ...(altText === undefined ? {} : { alt_text: altText }) })
            .eq('storage_provider', 'cloudflare_r2').eq('storage_bucket', config.bucket).eq('object_key', key)
            .select('object_key,original_filename,library_filename,alt_text').single();
        if (error) throw error;
        return jsonResponse({ objectKey: key, name: data.library_filename || data.original_filename, altText: data.alt_text });
    } catch (error) {
        console.error('Could not update media details:', error);
        return jsonResponse({ error: 'Could not save the file details. Your changes have been kept so you can retry.' }, 500);
    } finally {
        invalidateLibraryIndex(false);
    }
};
