import type { SupabaseClient } from '@supabase/supabase-js';
import { getR2Basename, getR2Config, listR2Folder, normalizeR2FolderPath } from './r2';
import { loadLibraryCatalogue, mergeLibraryFiles } from './libraryCatalogue';

export const folderAncestors = (path: string) => path.split('/').filter(Boolean).map((_, index, parts) => parts.slice(0, index + 1).join('/'));
export async function hiddenLibraryFolders(supabase: SupabaseClient, bucket: string, paths: string[]) {
    const hidden = new Set<string>();
    for (let offset = 0; offset < paths.length; offset += 100) {
        const { data, error } = await supabase.from('media_library_hidden_folders').select('folder_path').eq('storage_bucket', bucket).in('folder_path', paths.slice(offset, offset + 100));
        if (error) throw error;
        for (const row of data || []) hidden.add(row.folder_path);
    }
    return hidden;
}
export async function assertVisibleLibraryFolder(supabase: SupabaseClient, bucket: string, path: string) {
    if ((await hiddenLibraryFolders(supabase, bucket, folderAncestors(path))).size) throw new Error('This folder has moved. Refresh the library to find its new location.');
}
export async function readLibraryFolderNames(supabase: SupabaseClient, folder: string) {
    const [browser] = await Promise.all([listR2Folder(folder), assertVisibleLibraryFolder(supabase, getR2Config().bucket, normalizeR2FolderPath(folder))]);
    const hidden = await hiddenLibraryFolders(supabase, browser.config.bucket, browser.folders);
    return { folderPath: browser.folderPath, folders: browser.folders.filter((path) => !hidden.has(path)).map((path) => ({ name: getR2Basename(path), path })), truncated: browser.truncated };
}
export async function readLibraryFolder(supabase: SupabaseClient, folder: string) {
    const [browser] = await Promise.all([listR2Folder(folder), assertVisibleLibraryFolder(supabase, getR2Config().bucket, normalizeR2FolderPath(folder))]);
    const [catalogue, hidden] = await Promise.all([
        loadLibraryCatalogue(supabase, browser.config.bucket, browser.files.map((file) => file.objectKey), browser.folderPath),
        hiddenLibraryFolders(supabase, browser.config.bucket, browser.folders),
    ]);
    const merged = mergeLibraryFiles(browser.files, catalogue.rows, browser.folderPath, browser.config);
    return { folderPath: browser.folderPath, files: merged.files,
        folders: browser.folders.filter((path) => !hidden.has(path)).map((path) => ({ name: getR2Basename(path), path })),
        truncated: browser.truncated || catalogue.truncated || merged.truncated };
}

export function validateFolderTransfer(source: unknown, destination: unknown) {
    if (typeof source !== 'string' || !source || normalizeR2FolderPath(source) !== source || typeof destination !== 'string' || normalizeR2FolderPath(destination) !== destination) throw new Error('Choose a valid source and destination folder.');
    if (destination === source || destination.startsWith(`${source}/`)) throw new Error('A folder cannot be pasted into itself or one of its subfolders.');
    return { source, destination };
}
export async function collectLibraryTree(supabase: SupabaseClient, source: string) {
    const queue = [source];
    const groups: Array<{ folder: string; files: Array<{ objectKey: string; name: string }> }> = [];
    let fileCount = 0;
    for (let index = 0; index < queue.length; index += 1) {
        const listing = await readLibraryFolder(supabase, queue[index]);
        if (listing.truncated) throw new Error('This folder has too many items to process safely in one operation. Move smaller subfolders separately.');
        fileCount += listing.files.length;
        queue.push(...listing.folders.map((folder) => folder.path));
        if (queue.length > 500 || fileCount > 5000) throw new Error('This folder tree is too large for one operation. Move smaller subfolders separately.');
        groups.push({ folder: queue[index], files: listing.files.map((file) => ({ objectKey: file.objectKey, name: file.name })) });
    }
    return { groups, fileCount };
}
export function allocateFolderDestination(source: string, parent: string, existing: string[]) {
    const name = getR2Basename(source);
    for (let copy = 1; copy <= 1000; copy += 1) {
        const suffix = copy === 1 ? '' : `-${copy}`;
        const leaf = `${name.slice(0, 100 - suffix.length)}${suffix}`;
        const candidate = parent ? `${parent}/${leaf}` : leaf;
        if (normalizeR2FolderPath(candidate) !== candidate) throw new Error('The destination folder path is too deep or too long. Choose a higher-level folder.');
        if (!existing.includes(candidate)) return candidate;
    }
    throw new Error('Could not find an available folder name.');
}
