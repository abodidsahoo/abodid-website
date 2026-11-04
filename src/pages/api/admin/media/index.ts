export const prerender = false;
import type { APIRoute } from 'astro';
import { authorizeAdminRequest, jsonResponse } from '../../../../lib/admin/serverAuth';
import { invalidateLibraryIndex, readAllLibraryFiles } from '../../../../lib/media/libraryIndex';
import { readLibraryFolder, readLibraryFolderNames } from '../../../../lib/media/libraryFolders';

export const GET: APIRoute = async ({ request }) => {
    const authorization = await authorizeAdminRequest(request);
    if (!authorization.ok) return authorization.response;
    try {
        const params = new URL(request.url).searchParams;
        if (params.get('refresh') === '1' && params.get('view') !== 'all') invalidateLibraryIndex();
        if (params.get('foldersOnly') === '1') return jsonResponse(await readLibraryFolderNames(authorization.supabase, params.get('folder') || ''));
        if (params.get('view') === 'all') return jsonResponse(await readAllLibraryFiles(authorization.supabase, params));
        return jsonResponse(await readLibraryFolder(authorization.supabase, params.get('folder') || ''));
    } catch (error) {
        console.error('Could not browse the media library:', error);
        return jsonResponse({ error: 'Could not open this folder. Refresh the library or check that the media folder migrations have been applied.' }, 500);
    }
};
