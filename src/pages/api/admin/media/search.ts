export const prerender = false;
import type { APIRoute } from 'astro';
import { authorizeAdminRequest, jsonResponse } from '../../../../lib/admin/serverAuth';
import { assertVisibleLibraryFolder } from '../../../../lib/media/libraryFolders';
import { readAllLibraryFiles } from '../../../../lib/media/libraryIndex';
import { searchR2Folder } from '../../../../lib/media/r2';
import { loadLibraryCatalogue, mergeLibraryFiles } from '../../../../lib/media/libraryCatalogue';

export const GET: APIRoute = async ({ request }) => {
    const authorization = await authorizeAdminRequest(request);
    if (!authorization.ok) return authorization.response;
    const url = new URL(request.url);
    const term = (url.searchParams.get('q') || '').trim();
    if (!term || term.length > 100) return jsonResponse({ error: 'Enter a search term up to 100 characters.' }, 400);
    try {
        if (!url.searchParams.get('folder')) return jsonResponse(await readAllLibraryFiles(authorization.supabase, url.searchParams));
        const search = await searchR2Folder(url.searchParams.get('folder') || '', term);
        await assertVisibleLibraryFolder(authorization.supabase, search.config.bucket, search.folderPath);
        const catalogue = await loadLibraryCatalogue(authorization.supabase, search.config.bucket, search.files.map((file) => file.objectKey), search.folderPath, true);
        const merged = mergeLibraryFiles(search.files, catalogue.rows, search.folderPath, search.config, term);
        return jsonResponse({ folderPath: search.folderPath, files: merged.files, folderMatches: merged.folderMatches,
            scannedObjects: search.scannedObjects, truncated: search.truncated || catalogue.truncated || merged.truncated });
    } catch (error) {
        console.error('Could not search the media library:', error);
        return jsonResponse({ error: 'Could not search the media catalogue.' }, 500);
    }
};
