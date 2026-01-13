
import { getFileRaw } from '../../../../lib/github';

export const prerender = false;

export async function GET({ params, request, cookies }) {
    const { path } = params;

    // 1. Security Check
    const cookieName = "obsidian_vault_access";
    if (!cookies.has(cookieName) || cookies.get(cookieName)?.value !== "granted") {
        return new Response("Unauthorized", { status: 401 });
    }

    if (!path) {
        return new Response("Not found", { status: 404 });
    }

    // 2. Fetch from GitHub
    // User's structure is "7 - Assets/filename.png"
    // We decode the path param in case it comes in encoded, but we need to ensure the folder part is correct.
    // The 'path' param matches what comes after /assets/ in the URL.
    const folder = "7 - Assets";
    const githubPath = `${folder}/${path}`;
    const fileBuffer = await getFileRaw(githubPath);

    if (!fileBuffer) {
        return new Response("Not found", { status: 404 });
    }

    // 3. Determine MIME type
    const ext = path.split('.').pop().toLowerCase();
    const mimeTypes = {
        'png': 'image/png',
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'gif': 'image/gif',
        'svg': 'image/svg+xml',
        'pdf': 'application/pdf',
        'webp': 'image/webp'
    };
    const contentType = mimeTypes[ext] || 'application/octet-stream';

    // 4. Return Image
    return new Response(fileBuffer, {
        headers: {
            'Content-Type': contentType,
            'Cache-Control': 'public, max-age=3600' // Cache for 1 hour
        }
    });
}
