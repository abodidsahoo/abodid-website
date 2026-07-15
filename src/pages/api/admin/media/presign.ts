import type { APIRoute } from "astro";
import {
    authorizeAdminRequest,
    jsonResponse,
} from "../../../../lib/admin/serverAuth";
import {
    createPresignedR2Upload,
    isR2OriginalFolder,
    isAllowedImageMimeType,
    makeAvailableR2ObjectKey,
    MAX_IMAGE_SIZE_BYTES,
    normalizeR2FolderPath,
} from "../../../../lib/media/r2";

export const POST: APIRoute = async ({ request }) => {
    const authorization = await authorizeAdminRequest(request);
    if (!authorization.ok) return authorization.response;

    try {
        const body = await request.json();
        const filename = typeof body?.filename === "string" ? body.filename.trim() : "";
        const contentType =
            typeof body?.contentType === "string" ? body.contentType.trim().toLowerCase() : "";
        const size = Number(body?.size);
        const folder = normalizeR2FolderPath(body?.folder);

        if (!filename || filename.length > 255) {
            return jsonResponse({ error: "Choose an image with a valid filename." }, 400);
        }
        if (!isAllowedImageMimeType(contentType)) {
            return jsonResponse({ error: "Use a JPEG, PNG, WebP or GIF image." }, 400);
        }
        if (!Number.isSafeInteger(size) || size <= 0 || size > MAX_IMAGE_SIZE_BYTES) {
            return jsonResponse({ error: "Images must be 20 MB or smaller." }, 400);
        }
        if (!isR2OriginalFolder(folder)) {
            return jsonResponse(
                { error: "Choose a project or collection folder inside Originals before uploading." },
                400,
            );
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
