
import { getFileRaw } from '../../../lib/github';

export const prerender = false;

export async function GET({ params }) {
    const { path } = params;

    if (!path) {
        return new Response("Not found", { status: 404 });
    }

    const decodedPath = decodeURIComponent(path);

    const candidatePaths = [
        `07-assets/images/${decodedPath}`,
        `07-assets/${decodedPath}`,
        `07-assets/misc/${decodedPath}`,
        `7 - Assets/images/${decodedPath}`,
        `7 - Assets/${decodedPath}`,
        `7 - Assets/misc/${decodedPath}`,
        decodedPath
    ];

    let fileBuffer = null;
    for (const candidate of candidatePaths) {
        fileBuffer = await getFileRaw(candidate);
        if (fileBuffer) break;
    }

    if (!fileBuffer && decodedPath !== path) {
        const rawCandidates = [
            `07-assets/images/${path}`,
            `07-assets/${path}`,
            `7 - Assets/images/${path}`,
            `7 - Assets/${path}`,
            path
        ];
        for (const candidate of rawCandidates) {
            fileBuffer = await getFileRaw(candidate);
            if (fileBuffer) break;
        }
    }

    if (!fileBuffer) {
        return new Response("Not found", { status: 404 });
    }

    // Determine MIME type
    const ext = decodedPath.split('.').pop().toLowerCase();
    const mimeTypes = {
        'png': 'image/png',
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'gif': 'image/gif',
        'svg': 'image/svg+xml',
        'pdf': 'application/pdf',
        'webp': 'image/webp',
        'avif': 'image/avif'
    };
    const contentType = mimeTypes[ext] || 'application/octet-stream';

    return new Response(fileBuffer, {
        headers: {
            'Content-Type': contentType,
            'Cache-Control': 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400'
        }
    });
}
