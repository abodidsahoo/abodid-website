
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
    // User's structure is "07-assets/filename.png" (legacy: "7 - Assets/filename.png")
    let fileBuffer = await getFileRaw(`07-assets/${path}`);
    if (!fileBuffer) {
        fileBuffer = await getFileRaw(`7 - Assets/${path}`);
    }

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
