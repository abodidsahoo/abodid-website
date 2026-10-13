export const prerender = false;

import type { APIRoute } from "astro";
import { jsonResponse } from "../../../../lib/admin/serverAuth";
import {
    assertSafeR2ObjectKey,
    buildR2PublicUrl,
    deleteR2Objects,
    headR2Object,
} from "../../../../lib/media/r2";
import { shouldUseVercelVariantProcessor } from "../../../../lib/media/variantProcessor";
import { isMoodboardPaletteData } from "../../../../lib/moodboard/paletteCore";
import {
    isAuthorizedMoodboardQuickActionRequest,
    MOODBOARD_QUICK_ACTION_FOLDER,
    MOODBOARD_QUICK_ACTION_MAX_BYTES,
    normalizeMoodboardArtistName,
    normalizeMoodboardSourceUrl,
    orientedImageDimensions,
    readMoodboardRequestFields,
    resolveMoodboardImageType,
    titleFromMoodboardFilename,
} from "../../../../lib/moodboard/quickAction";
import { createSupabaseServiceClient } from "../../../../lib/supabaseServer";

const cleanEtag = (value: string | undefined) =>
    value?.replace(/^"|"$/g, "") || null;

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
    let cataloguedMediaAssetId = "";
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

        const publicUrl = buildR2PublicUrl(config, uploadedObjectKey);
        const storagePath = `${config.bucket}/${uploadedObjectKey}`;
        const titleValue = fields.title;
        const requestedTitle = typeof titleValue === "string" ? titleValue.trim().slice(0, 200) : "";
        const sourceUrl = normalizeMoodboardSourceUrl(fields.sourceUrl);
        const artistName = normalizeMoodboardArtistName(fields.artistName);
        const selection = "id,image_url,storage_path,title,tags,published,image_width,image_height,aspect_ratio,source_url,artist_name,palette,created_at,updated_at";
        const { data: mediaAsset, error: mediaAssetError } = await supabase
            .from("media_assets")
            .upsert({
                storage_provider: "cloudflare_r2",
                storage_bucket: config.bucket,
                object_key: uploadedObjectKey,
                folder_path: MOODBOARD_QUICK_ACTION_FOLDER,
                public_url: publicUrl,
                original_filename: originalFilename,
                mime_type: contentType,
                file_size: fileSize,
                etag: cleanEtag(object.ETag),
            }, { onConflict: "storage_provider,storage_bucket,object_key" })
            .select("id,processing_status,width,height,metadata")
            .single();
        if (mediaAssetError || !mediaAsset) throw mediaAssetError || new Error("Could not catalogue the image.");
        cataloguedMediaAssetId = mediaAsset.id;
        const assetMetadata = mediaAsset.metadata && typeof mediaAsset.metadata === "object"
            ? mediaAsset.metadata as Record<string, unknown>
            : {};
        let palette = isMoodboardPaletteData(assetMetadata.palette) ? assetMetadata.palette : null;
        let imageWidth = Number(mediaAsset.width) || null;
        let imageHeight = Number(mediaAsset.height) || null;

        let variantsReady = mediaAsset.processing_status === "ready";
        // The R2 event normally triggers the Cloudflare worker. Keep the former
        // Vercel resize path available only when Cloudflare cannot be used.
        if (shouldUseVercelVariantProcessor()) {
            const { getR2ObjectBytes } = await import("../../../../lib/media/r2");
            const bytes = await getR2ObjectBytes(uploadedObjectKey);
            const [{ default: sharp }, { extractMoodboardPalette }] = await Promise.all([
                import("sharp"),
                import("../../../../lib/moodboard/palette"),
            ]);
            const dimensions = orientedImageDimensions(await sharp(bytes, { animated: true }).metadata());
            imageWidth = dimensions.width;
            imageHeight = dimensions.height;
            palette = await extractMoodboardPalette(bytes);
            const { catalogueR2ImageVariants } = await import("../../../../lib/media/imageVariants");
            const variantResult = await catalogueR2ImageVariants({
                supabase,
                assetId: mediaAsset.id,
                objectKey: uploadedObjectKey,
                sourceBytes: bytes,
                mimeType: contentType,
            });
            if (!variantResult.attempted || !variantResult.ready) {
                throw new Error(variantResult.error || "The required 800px and 1600px variants could not be created.");
            }
            variantsReady = true;
        }

        const { data: existingItem, error: existingItemError } = await supabase
            .from("moodboard_items")
            .select(selection)
            .eq("storage_path", storagePath)
            .maybeSingle();
        if (existingItemError) throw existingItemError;
        if (existingItem) {
            let completedItem = existingItem;
            const repair: Record<string, unknown> = {};
            if (palette && !isMoodboardPaletteData(existingItem.palette)) repair.palette = palette;
            if (imageWidth && !existingItem.image_width) repair.image_width = imageWidth;
            if (imageHeight && !existingItem.image_height) repair.image_height = imageHeight;
            if (Object.keys(repair).length > 0) {
                const { data: updatedItem, error: paletteError } = await supabase
                    .from("moodboard_items")
                    .update(repair)
                    .eq("id", existingItem.id)
                    .select(selection)
                    .single();
                if (paletteError) throw paletteError;
                completedItem = updatedItem;
            }
            return jsonResponse({
                ok: true,
                objectKey: uploadedObjectKey,
                publicUrl,
                item: completedItem,
                alreadyCompleted: true,
                variantsQueued: !variantsReady,
                variantsReady,
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
                image_width: imageWidth,
                image_height: imageHeight,
                palette,
                source_url: sourceUrl,
                artist_name: artistName,
            })
            .select(selection)
            .single();
        if (error) throw error;
        return jsonResponse({
            ok: true,
            objectKey: uploadedObjectKey,
            publicUrl,
            item,
            variantsQueued: !variantsReady,
            variantsReady,
        }, 201);
    } catch (error) {
        if (cataloguedMediaAssetId) {
            const { error: cleanupCatalogueError } = await supabase
                .from("media_assets")
                .delete()
                .eq("id", cataloguedMediaAssetId)
                .eq("object_key", uploadedObjectKey);
            if (cleanupCatalogueError) {
                console.error("Could not remove the incomplete media catalogue entry:", cleanupCatalogueError);
            }
        }

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
