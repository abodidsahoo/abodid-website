import type { SupabaseClient } from '@supabase/supabase-js';
import { getR2Config, listAllR2Files } from './r2';
import { MEDIA_CATALOGUE_COLUMNS, mergeLibraryFiles } from './libraryCatalogue';
import { filterLibraryFiles } from './libraryView';
import { createLibraryCache } from './libraryCache';

const snapshots = createLibraryCache<Awaited<ReturnType<typeof listAllR2Files>>>(300_000, 4);
const indexes = createLibraryCache<Awaited<ReturnType<typeof buildLibraryIndex>>>(60_000, 4);

export function invalidateLibraryIndex(storageChanged = true) {
    indexes.clear();
    if (storageChanged) snapshots.clear();
}

async function buildLibraryIndex(supabase: SupabaseClient) {
    const config = getR2Config();
    const cacheKey = `${config.endpoint}/${config.bucket}`;
    // Storage, catalogue and folder visibility are independent network reads.
    const [snapshot, assets, hidden] = await Promise.all([
        snapshots.read(cacheKey, listAllR2Files),
        readCatalogue(supabase, config.bucket),
        readHiddenFolders(supabase, config.bucket),
    ]);
    const keys = new Set(snapshot.files.map((file) => file.objectKey));
    const merged = mergeLibraryFiles(snapshot.files, assets.filter((asset) => keys.has(asset.object_key)), '', config, '', { recursive: true, limit: 25_000 });
    return {
        files: merged.files.filter((file) => !hidden.some((path) => file.folderPath === path || file.folderPath.startsWith(`${path}/`))),
        folders: snapshot.roots.filter((path) => !hidden.includes(path)).map((path) => ({ name: path, path })),
        truncated: snapshot.truncated || merged.truncated,
    };
}

async function readCatalogue(supabase: SupabaseClient, bucket: string) {
    const assets: any[] = [];
    for (let offset = 0; ; offset += 1000) {
        const { data, error } = await supabase.from('media_assets').select(MEDIA_CATALOGUE_COLUMNS)
            .eq('storage_provider', 'cloudflare_r2').eq('storage_bucket', bucket).order('object_key').range(offset, offset + 999);
        if (error) throw error;
        assets.push(...data || []);
        if ((data || []).length < 1000) break;
    }
    return assets;
}

async function readHiddenFolders(supabase: SupabaseClient, bucket: string) {
    const hidden: string[] = [];
    for (let offset = 0; ; offset += 1000) {
        const { data, error } = await supabase.from('media_library_hidden_folders').select('folder_path').eq('storage_bucket', bucket).order('folder_path').range(offset, offset + 999);
        if (error) throw error;
        hidden.push(...(data || []).map((row) => row.folder_path));
        if ((data || []).length < 1000) break;
    }
    return hidden;
}

/** Call only after admin authorization; this cache is never a public HTTP cache. */
export async function readAllLibraryFiles(supabase: SupabaseClient, params: URLSearchParams) {
    const config = getR2Config();
    if (params.get('refresh')) invalidateLibraryIndex(params.get('refresh') !== 'catalogue');
    const index = await indexes.read(`${config.endpoint}/${config.bucket}`, () => buildLibraryIndex(supabase));
    const sorted = filterLibraryFiles(index.files, { type: params.get('type') || 'all', sort: params.get('sort') || 'date-desc', query: params.get('q') || '' });
    const page = Math.max(0, Math.floor(Number(params.get('page')) || 0));
    const pageSize = 120;
    return { folderPath: '', files: sorted.slice(page * pageSize, (page + 1) * pageSize), totalCount: sorted.length,
        folders: index.folders,
        hasMore: (page + 1) * pageSize < sorted.length, page,
        truncated: index.truncated };
}
