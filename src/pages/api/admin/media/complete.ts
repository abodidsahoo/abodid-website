export const prerender = false;

import type { APIRoute } from "astro";
import {
    authorizeAdminRequest,
    jsonResponse,
} from "../../../../lib/admin/serverAuth";
import {
    assertSafeR2ObjectKey,
    buildR2PublicUrl,
    headR2Object,
    isAllowedImageMimeType,
    MAX_IMAGE_SIZE_BYTES,
    MAX_MEDIA_SIZE_BYTES,
    getR2ObjectBytes,
} from "../../../../lib/media/r2";
import {
    canGenerateR2ImageVariants,
    catalogueR2ImageVariants,
} from "../../../../lib/media/imageVariants";

const optionalDimension = (value: unknown) => {
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) && parsed > 0 && parsed <= 100_000 ? parsed : null;
};

const cleanEtag = (value: string | undefined) =>
    value?.replace(/^"|"$/g, "") || null;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const mapVariants = (
    rows: Array<Record<string, unknown>> | null | undefined,
    config: Parameters<typeof buildR2PublicUrl>[0],
) =>
    Object.fromEntries((rows || []).map((variant) => [
        String(variant.variant_key),
        {
            key: variant.variant_key,
            url: variant.object_key
                ? buildR2PublicUrl(config, String(variant.object_key))
                : variant.public_url,
            width: variant.actual_width,
            height: variant.actual_height,
            targetWidth: variant.target_width,
            fileSize: variant.file_size,
            mimeType: variant.mime_type,
        },
    ]));

export const POST: APIRoute = async ({ request }) => {
    const authorization = await authorizeAdminRequest(request);
    if (!authorization.ok) return authorization.response;

    try {
        const body = await request.json();
        const objectKey = assertSafeR2ObjectKey(body?.objectKey);
        const originalFilename =
            typeof body?.originalFilename === "string"
                ? body.originalFilename.trim().slice(0, 255)
                : "";
        const expectedSize = Number(body?.expectedSize);
        const width = optionalDimension(body?.width);
        const height = optionalDimension(body?.height);
        const projectId = typeof body?.projectId === "string" && UUID_PATTERN.test(body.projectId)
            ? body.projectId
            : null;

        if (!originalFilename) {
            return jsonResponse({ error: "The original filename is required." }, 400);
        }

        const { config, object } = await headR2Object(objectKey);
        const contentType = (object.ContentType || "").toLowerCase();
        const fileSize = Number(object.ContentLength || 0);

        if (!isAllowedImageMimeType(contentType)) {
            return jsonResponse({ error: "R2 returned an unsupported file type." }, 400);
        }
        const isLargeMediaOrDoc = contentType.startsWith("video/") || contentType === "application/pdf";
        const maxAllowedSize = isLargeMediaOrDoc ? MAX_MEDIA_SIZE_BYTES : MAX_IMAGE_SIZE_BYTES;
        if (fileSize <= 0 || fileSize > maxAllowedSize) {
            return jsonResponse({ error: "The uploaded file has an invalid size." }, 400);
        }
        if (Number.isSafeInteger(expectedSize) && expectedSize > 0 && expectedSize !== fileSize) {
            return jsonResponse({ error: "The uploaded file size did not match the selected file." }, 409);
        }

        const slashIndex = objectKey.lastIndexOf("/");
        const folderPath = slashIndex > -1 ? objectKey.slice(0, slashIndex) : "";
        const publicUrl = buildR2PublicUrl(config, objectKey);
        let originProjectId: string | null = null;
        if (projectId) {
            const { data: project, error: projectError } = await authorization.supabase
                .from("portfolio_projects")
                .select("id,storage_folder")
                .eq("id", projectId)
                .maybeSingle();
            if (projectError || !project) {
                return jsonResponse({ error: "The target portfolio project no longer exists." }, 409);
            }
            const expectedPrefix = `originals/${project.storage_folder}/`;
            if (!objectKey.startsWith(expectedPrefix)) {
                return jsonResponse({ error: "The upload folder does not match this project's permanent storage folder." }, 409);
            }
            originProjectId = project.id;
        }
        const record = {
            storage_provider: "cloudflare_r2",
            storage_bucket: config.bucket,
            object_key: objectKey,
            folder_path: folderPath,
            public_url: publicUrl,
            original_filename: originalFilename,
            mime_type: contentType,
            file_size: fileSize,
            width,
            height,
            etag: cleanEtag(object.ETag),
            created_by: authorization.user.id,
            ...(originProjectId ? { origin_project_id: originProjectId } : {}),
            metadata: {
                cacheControl: object.CacheControl || null,
                lastModified: object.LastModified?.toISOString() || null,
            },
        };

        const { data, error } = await authorization.supabase
            .from("media_assets")
            .upsert(record, {
                onConflict: "storage_provider,storage_bucket,object_key",
            })
            .select("*,media_variants(variant_key,target_width,actual_width,actual_height,object_key,public_url,file_size,mime_type)")
            .single();

        if (error) {
            console.error("Could not catalogue the R2 upload:", error);
            const missingTable = ["42P01", "PGRST205"].includes(error.code || "");
            return jsonResponse(
                {
                    error: missingTable
                        ? "The image reached R2, but the media catalogue migration has not been applied yet."
                        : "The image reached R2, but its Supabase record could not be saved.",
                    code: missingTable ? "MEDIA_CATALOGUE_MISSING" : "MEDIA_CATALOGUE_ERROR",
                    publicUrl,
                    objectKey,
                },
                500,
            );
        }

        if (canGenerateR2ImageVariants(data.object_key, data.mime_type)) {
            const sourceBytes = await getR2ObjectBytes(data.object_key);
            await catalogueR2ImageVariants({
                supabase: authorization.supabase,
                assetId: data.id,
                objectKey: data.object_key,
                sourceBytes,
                mimeType: data.mime_type,
            });
        }
        const { data: processedData } = await authorization.supabase
            .from("media_assets")
            .select("*,media_variants(variant_key,target_width,actual_width,actual_height,object_key,public_url,file_size,mime_type)")
            .eq("id", data.id)
            .single();
        const asset = processedData || data;

        return jsonResponse({
            asset: {
                id: asset.id,
                storageProvider: asset.storage_provider,
                storageBucket: asset.storage_bucket,
                objectKey: asset.object_key,
                folderPath: asset.folder_path,
                publicUrl: asset.public_url,
                originalFilename: asset.original_filename,
                mimeType: asset.mime_type,
                fileSize: asset.file_size,
                width: asset.width,
                height: asset.height,
                etag: asset.etag,
                processingStatus: asset.processing_status,
                processingError: asset.processing_error,
                variants: mapVariants(asset.media_variants, config),
                createdAt: asset.created_at,
            },
        });
    } catch (error) {
        console.error("Could not verify the completed R2 upload:", error);
        const message = error instanceof Error ? error.message : "Could not verify the upload.";
        return jsonResponse({ error: message }, 500);
    }
};
