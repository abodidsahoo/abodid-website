export const prerender = false;

import type { APIRoute } from "astro";
import { maxUploadBytes, normalizeUploadContentType } from "../../../../lib/media/uploadPolicy";
import {
    authorizeAdminRequest,
    jsonResponse,
} from "../../../../lib/admin/serverAuth";
import {
    createPresignedR2Upload,
    makeAvailableR2ObjectKey,
    normalizeR2FolderPath,
} from "../../../../lib/media/r2";

export const POST: APIRoute = async ({ request }) => {
    const authorization = await authorizeAdminRequest(request);
    if (!authorization.ok) return authorization.response;

    try {
        const body = await request.json();
        const filename = typeof body?.filename === "string" ? body.filename.trim() : "";
        const contentType =
            normalizeUploadContentType(body?.contentType);
        const size = Number(body?.size);
        const folder = normalizeR2FolderPath(body?.folder);

        if (!filename || filename.length > 255) {
            return jsonResponse({ error: "Choose a media file with a valid filename." }, 400);
        }
        const maxSize = maxUploadBytes(contentType);
        if (!Number.isSafeInteger(size) || size <= 0 || size > maxSize) {
            return jsonResponse({ error: `File must be ${maxSize / (1024 * 1024)} MB or smaller.` }, 400);
        }

        const objectKey = await makeAvailableR2ObjectKey(folder, filename);
        const signedUpload = await createPresignedR2Upload({ objectKey, contentType });

        return jsonResponse({
            objectKey,
            filename,
            contentType,
            size,
            ...signedUpload,
        });
    } catch (error) {
        console.error("Could not create an R2 upload URL:", error);
        const message = error instanceof Error ? error.message : "Could not prepare the upload.";
        return jsonResponse({ error: message }, 500);
    }
};
