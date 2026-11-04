import { invalidateLibraryIndex } from '../../../../lib/media/libraryIndex';
export const prerender = false;
import type { APIRoute } from 'astro';
import { authorizeAdminRequest, jsonResponse } from '../../../../lib/admin/serverAuth';
import { createR2Folder, getR2Config, listR2Folder, normalizeR2FolderPath } from '../../../../lib/media/r2';
import { allocateFolderDestination, assertVisibleLibraryFolder, collectLibraryTree, readLibraryFolder, validateFolderTransfer } from '../../../../lib/media/libraryFolders';

export const POST: APIRoute = async ({ request }) => {
    const authorization = await authorizeAdminRequest(request);
    if (!authorization.ok) return authorization.response;
    let body: any, source: string, destination: string;
    try {
        body = await request.json();
        ({ source, destination } = validateFolderTransfer(body?.sourceFolder, body?.destinationFolder));
        if (body.destinationName !== undefined && (typeof body.destinationName !== 'string' || !body.destinationName.trim() || body.destinationName.length > 100 || /[\\/]/.test(body.destinationName))) throw new Error('Enter a valid folder name up to 100 characters.');
        if (!['copy', 'move'].includes(body.action) || !['plan', 'finish'].includes(body.phase)) throw new Error('Choose Copy or Cut and a destination folder.');
    } catch (error) {
        return jsonResponse({ error: (error as Error).message || 'Invalid folder operation.' }, 400);
    }
    try {
        const config = getR2Config();
        await assertVisibleLibraryFolder(authorization.supabase, config.bucket, source);
        await assertVisibleLibraryFolder(authorization.supabase, config.bucket, destination);
        const sourceParent = source.split('/').slice(0, -1).join('/');
        const sourceListing = await readLibraryFolder(authorization.supabase, sourceParent);
        if (!sourceListing.folders.some((folder) => folder.path === source)) return jsonResponse({ error: 'The source folder no longer exists.' }, 404);
        if (body.phase === 'finish') {
            if (body.action !== 'move') return jsonResponse({ error: 'Only folder moves need finalizing.' }, 400);
            const parentListing = await readLibraryFolder(authorization.supabase, destination.split('/').slice(0, -1).join('/'));
            if (!parentListing.folders.some((folder) => folder.path === destination)) return jsonResponse({ error: 'The destination folder no longer exists.' }, 404);
            const remaining = await collectLibraryTree(authorization.supabase, source);
            if (remaining.fileCount) return jsonResponse({ error: 'The source still contains files, so it remains visible. Some files may already have moved; refresh before retrying.' }, 409);
            const { error } = await authorization.supabase.from('media_library_hidden_folders').upsert(remaining.groups.map((group) => ({ storage_bucket: config.bucket, folder_path: group.folder, hidden_by: authorization.user.id })), { onConflict: 'storage_bucket,folder_path' });
            if (error) throw error;
            return jsonResponse({ sourceFolder: source, destinationFolder: destination, completed: true });
        }
        if (destination) {
            const parentListing = await readLibraryFolder(authorization.supabase, destination.split('/').slice(0, -1).join('/'));
            if (!parentListing.folders.some((folder) => folder.path === destination)) return jsonResponse({ error: 'The destination folder no longer exists.' }, 404);
        }
        if (body.action === 'move' && destination === sourceParent && !body.destinationName) return jsonResponse({ unchanged: true, destinationFolder: source, groups: [], fileCount: 0 });
        const tree = await collectLibraryTree(authorization.supabase, source);
        const rawDestination = await listR2Folder(destination);
        if (rawDestination.truncated) throw new Error('There are too many destination folders to choose a safe name. Choose a different destination.');
        const requested = body.destinationName ? normalizeR2FolderPath(body.destinationName) : '';
        if (body.destinationName && !requested) throw new Error('Enter a folder name containing letters or numbers.');
        const target = requested ? `${destination ? `${destination}/` : ''}${requested}` : allocateFolderDestination(source, destination, rawDestination.folders);
        if (target === source) return jsonResponse({ unchanged: true, destinationFolder: source, groups: [], fileCount: 0 });
        if (requested && rawDestination.folders.includes(target)) return jsonResponse({ error: 'A folder with that name already exists. Choose another name.' }, 409);
        const groups = tree.groups.map((group) => ({ ...group, destinationFolder: `${target}${group.folder.slice(source.length)}` }));
        if (groups.some((group) => normalizeR2FolderPath(group.destinationFolder) !== group.destinationFolder)) throw new Error('The copied folder tree would exceed the supported folder depth. Choose a higher-level destination.');
        const plan = { sourceFolder: source, destinationFolder: target, groups, fileCount: tree.fileCount };
        if (new TextEncoder().encode(JSON.stringify(plan)).byteLength > 4 * 1024 * 1024) throw new Error('This folder tree is too large for one operation. Process smaller subfolders separately.');
        // Markers preserve empty subfolders. Transfers then run in bounded file
        // batches in the client; a failed batch never hides the source folder.
        for (let offset = 0; offset < groups.length; offset += 4) await Promise.all(groups.slice(offset, offset + 4).map((group) => createR2Folder(group.destinationFolder)));
        return jsonResponse(plan);
    } catch (error) {
        console.error('Could not organize the media folder:', error);
        return jsonResponse({ error: (error as Error).message || 'The folder could not be organized.' }, 500);
    } finally {
        invalidateLibraryIndex();
    }
};
