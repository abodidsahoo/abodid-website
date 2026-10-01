export const prerender = false;

import type { APIRoute } from "astro";
import { jsonResponse } from "../../../../lib/admin/serverAuth";
import {
    createPresignedR2Upload,
    makeAvailableR2ObjectKey,
} from "../../../../lib/media/r2";
import {
    isAuthorizedMoodboardQuickActionRequest,
    MOODBOARD_QUICK_ACTION_FOLDER,
    MOODBOARD_QUICK_ACTION_MAX_BYTES,
    readMoodboardRequestFields,
    resolveMoodboardImageType,
} from "../../../../lib/moodboard/quickAction";

export const POST: APIRoute = async ({ request }) => {
    const authorization = isAuthorizedMoodboardQuickActionRequest(request);
    if (!authorization.configured) {
        console.error("MOODBOARD_QUICK_ACTION_TOKEN is not configured.");
        return jsonResponse({ error: "Moodboard Quick Action is not configured." }, 503);
    }
    if (!authorization.authorized) {
        return jsonResponse({ error: "Unauthorized" }, 401);
    }

    try {
        const fields = await readMoodboardRequestFields(request);
        const filename = String(fields.filename || "").trim().slice(0, 255);
        const declaredType = String(fields.contentType || "");
        const contentType = resolveMoodboardImageType(filename, declaredType);
        const size = Number(fields.size);

        if (!filename || !contentType) {
            return jsonResponse({ error: "Use a JPEG, PNG, WebP, GIF, or AVIF image." }, 400);
        }
        if (!Number.isSafeInteger(size) || size <= 0 || size > MOODBOARD_QUICK_ACTION_MAX_BYTES) {
            return jsonResponse({ error: "The image must be 20 MB or smaller." }, 400);
        }

        const objectKey = await makeAvailableR2ObjectKey(
            MOODBOARD_QUICK_ACTION_FOLDER,
            filename,
        );
        const signedUpload = await createPresignedR2Upload({ objectKey, contentType });

        return jsonResponse({
            objectKey,
            filename,
            contentType,
            size,
            ...signedUpload,
        });
    } catch (error) {
        console.error("Could not prepare the moodboard Quick Action upload:", error);
        const message = error instanceof Error ? error.message : "Could not prepare the upload.";
        return jsonResponse({ error: message }, 500);
    }
};
