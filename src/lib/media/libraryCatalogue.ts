import type { SupabaseClient } from '@supabase/supabase-js';
import { buildR2PublicUrl, getR2Basename, inferR2MimeType, R2_BROWSER_MAX_ITEMS, type R2Config } from './r2';

export const MEDIA_CATALOGUE_COLUMNS = 'id,object_key,folder_path,library_folder_path,original_filename,library_filename,mime_type,file_size,width,height,alt_text,caption,credit,created_at,updated_at,processing_status,processing_error,metadata,etag,media_variants(variant_key,target_width,actual_width,actual_height,object_key,public_url,file_size,mime_type)';
export const libraryFolder = (asset: any) => asset.library_folder_path ?? asset.folder_path ?? asset.object_key.split('/').slice(0, -1).join('/');
export const withinLibraryFolder = (path: string, folder: string, recursive: boolean) =>
    path === folder || (recursive && (!folder || path.startsWith(`${folder}/`)));
const searchable = (value: string) => value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

export function mergeLibraryFiles(physical: any[], assets: any[], folder: string, config: R2Config, search = '', options: { recursive?: boolean; limit?: number } = {}) {
    const recursive = options.recursive ?? Boolean(search);
    const limit = options.limit ?? R2_BROWSER_MAX_ITEMS;
    const catalogue = new Map(assets.map((asset) => [asset.object_key, asset]));
    const candidates = new Map(physical.map((object) => [object.objectKey, object]));
    for (const asset of assets) {
        if (asset.library_folder_path != null && withinLibraryFolder(libraryFolder(asset), folder, recursive) && !candidates.has(asset.object_key)) {
            candidates.set(asset.object_key, { objectKey: asset.object_key, fileSize: asset.file_size, etag: asset.etag, lastModified: asset.updated_at });
        }
    }
    const tokens = searchable(search).split(/\s+/).filter(Boolean);
    const matches = new Map<string, number>();
    const files = [...candidates.values()].flatMap((object) => {
        const asset = catalogue.get(object.objectKey);
        const location = asset ? libraryFolder(asset) : object.objectKey.split('/').slice(0, -1).join('/');
        if (!withinLibraryFolder(location, folder, recursive)) return [];
        const name = asset?.library_filename || asset?.original_filename || getR2Basename(object.objectKey);
        const searchText = searchable(`${location}/${name}/${getR2Basename(object.objectKey)} ${asset?.alt_text || ''} ${asset?.public_url || ''}`);
        if (tokens.length && !tokens.every((token) => searchText.includes(token))) return [];
        if (search && location !== folder) {
            const relative = folder ? location.slice(folder.length + 1) : location;
            const first = relative.split('/')[0];
            const path = folder ? `${folder}/${first}` : first;
            matches.set(path, (matches.get(path) || 0) + 1);
        }
        return [{
            id: asset?.id || object.objectKey, objectKey: object.objectKey, folderPath: location,
            name, publicUrl: buildR2PublicUrl(config, object.objectKey),
            mimeType: asset?.mime_type || inferR2MimeType(object.objectKey), fileSize: object.fileSize,
            width: asset?.width || null, height: asset?.height || null,
            altText: asset?.alt_text || '', caption: asset?.caption || '', credit: asset?.credit || '',
            etag: object.etag, createdAt: asset?.created_at || object.lastModified,
            updatedAt: asset?.updated_at || object.lastModified, catalogued: Boolean(asset),
            processingStatus: asset?.processing_status || (asset ? 'uploaded' : 'uncatalogued'),
            processingError: asset?.processing_error || null, instagramAsset: asset?.metadata?.instagramAsset || null,
            variants: Object.fromEntries((asset?.media_variants || []).map((variant: any) => [String(variant.variant_key), {
                key: variant.variant_key, url: variant.object_key ? buildR2PublicUrl(config, variant.object_key) : variant.public_url,
                width: variant.actual_width, height: variant.actual_height, targetWidth: variant.target_width,
                fileSize: variant.file_size, mimeType: variant.mime_type,
            }])),
        }];
    });
    return { files: files.slice(0, limit), folderMatches: [...matches].map(([path, count]) => ({ path, count })), truncated: files.length > limit };
}

export async function loadLibraryCatalogue(supabase: SupabaseClient, bucket: string, objectKeys: string[], folder: string, recursive = false) {
    const base = () => supabase.from('media_assets').select(MEDIA_CATALOGUE_COLUMNS).eq('storage_provider', 'cloudflare_r2').eq('storage_bucket', bucket);
    const rows = new Map<string, any>();
    const readObjects = async () => {
        for (let offset = 0; offset < objectKeys.length; offset += 400) {
            await Promise.all(Array.from({ length: Math.min(4, Math.ceil((objectKeys.length - offset) / 100)) }, async (_, batch) => {
                const start = offset + batch * 100;
                const { data, error } = await base().in('object_key', objectKeys.slice(start, start + 100));
                if (error) throw error;
                for (const row of data || []) rows.set(row.object_key, row);
            }));
        }
    };
    let truncated = false;
    const readRelocated = async () => {
        for (let offset = 0; offset <= R2_BROWSER_MAX_ITEMS; offset += 1000) {
            let query = base();
            if (recursive && !folder) query = query.not('library_folder_path', 'is', null);
            else if (recursive) {
                // Normalized folder paths contain no PostgREST filter punctuation.
                const escaped = folder.replace(/[_%]/g, '\\$&');
                query = query.or(`library_folder_path.eq.${folder},library_folder_path.like.${escaped}/%`);
            } else query = query.eq('library_folder_path', folder);
            const { data, error } = await query.order('object_key').range(offset, offset + 999);
            if (error) throw error;
            for (const row of data || []) rows.set(row.object_key, row);
            if ((data || []).length < 1000) break;
            if (offset === R2_BROWSER_MAX_ITEMS) truncated = true;
        }
    };
    await Promise.all([readObjects(), readRelocated()]);
    return { rows: [...rows.values()], truncated };
}
