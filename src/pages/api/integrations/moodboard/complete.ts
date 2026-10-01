export const prerender = false;

import type { APIRoute } from "astro";
import sharp from "sharp";
import { jsonResponse } from "../../../../lib/admin/serverAuth";
import {
    assertSafeR2ObjectKey,
    buildR2PublicUrl,
    deleteR2Objects,
    getR2ObjectBytes,
    headR2Object,
} from "../../../../lib/media/r2";
import {
    isAuthorizedMoodboardQuickActionRequest,
    MOODBOARD_QUICK_ACTION_FOLDER,
    MOODBOARD_QUICK_ACTION_MAX_BYTES,
    orientedImageDimensions,
    readMoodboardRequestFields,
    resolveMoodboardImageType,
    titleFromMoodboardFilename,
} from "../../../../lib/moodboard/quickAction";
import { createSupabaseServiceClient } from "../../../../lib/supabaseServer";

export const POST: APIRoute = async ({ request }) => {
    const authorization = isAuthorizedMoodboardQuickActionRequest(request);
    if (!authorization.configured) {
        console.error("MOODBOARD_QUICK_ACTION_TOKEN is not configured.");
        return jsonResponse({ error: "Moodboard Quick Action is not configured." }, 503);
    }
    if (!authorization.authorized) {
        return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const supabase = createSupabaseServiceClient();
    if (!supabase) {
        return jsonResponse({ error: "Server configuration is incomplete." }, 500);
    }

    let uploadedObjectKey = "";
    try {
        const fields = await readMoodboardRequestFields(request);
        uploadedObjectKey = assertSafeR2ObjectKey(fields.objectKey);
        if (!uploadedObjectKey.startsWith(`${MOODBOARD_QUICK_ACTION_FOLDER}/`)) {
            return jsonResponse({ error: "The upload is outside the moodboard folder." }, 400);
        }

        const originalFilename = String(fields.originalFilename || "").trim().slice(0, 255);
        const expectedSize = Number(fields.expectedSize);
        if (!originalFilename || !Number.isSafeInteger(expectedSize) || expectedSize <= 0) {
            return jsonResponse({ error: "The completed upload metadata is invalid." }, 400);
        }

        const { config, object } = await headR2Object(uploadedObjectKey);
        const fileSize = Number(object.ContentLength || 0);
        const contentType = resolveMoodboardImageType(
            originalFilename,
            String(object.ContentType || ""),
        );
        if (!contentType) {
            throw new Error("R2 returned an unsupported image type.");
        }
        if (
            fileSize <= 0 ||
            fileSize > MOODBOARD_QUICK_ACTION_MAX_BYTES ||
            fileSize !== expectedSize
        ) {
            throw new Error("The uploaded image size did not match the selected file.");
        }

        const bytes = await getR2ObjectBytes(uploadedObjectKey);
        const metadata = await sharp(bytes, { animated: true }).metadata();
        const dimensions = orientedImageDimensions(metadata);
        if (!dimensions.width || !dimensions.height) {
            throw new Error("The image dimensions could not be read.");
        }

        const publicUrl = buildR2PublicUrl(config, uploadedObjectKey);
        const storagePath = `${config.bucket}/${uploadedObjectKey}`;
        const titleValue = fields.title;
        const requestedTitle = typeof titleValue === "string" ? titleValue.trim().slice(0, 200) : "";
        const selection = "id,image_url,storage_path,title,tags,published,image_width,image_height,aspect_ratio,created_at,updated_at";
        const { data: existingItem, error: existingItemError } = await supabase
            .from("moodboard_items")
            .select(selection)
            .eq("storage_path", storagePath)
            .maybeSingle();
        if (existingItemError) throw existingItemError;
        if (existingItem) {
            return jsonResponse({
                ok: true,
                objectKey: uploadedObjectKey,
                publicUrl,
                item: existingItem,
                alreadyCompleted: true,
            });
        }

        const { data: item, error } = await supabase
            .from("moodboard_items")
            .insert({
                image_url: publicUrl,
                storage_path: storagePath,
                title: requestedTitle || titleFromMoodboardFilename(originalFilename),
                tags: [],
                published: true,
                image_width: dimensions.width,
                image_height: dimensions.height,
            })
            .select(selection)
            .single();
        if (error) throw error;

        return jsonResponse({
            ok: true,
            objectKey: uploadedObjectKey,
            publicUrl,
            item,
        }, 201);
    } catch (error) {
        if (uploadedObjectKey.startsWith(`${MOODBOARD_QUICK_ACTION_FOLDER}/`)) {
            try {
                await deleteR2Objects([uploadedObjectKey]);
            } catch (cleanupError) {
                console.error("Could not remove the incomplete moodboard upload:", cleanupError);
            }
        }

        console.error("Could not complete the moodboard Quick Action upload:", error);
        const message = error instanceof Error ? error.message : "Could not complete the upload.";
        return jsonResponse({ error: message }, 500);
    }
};
