export const prerender = false;

import type { APIRoute } from "astro";
import {
    authorizeAdminRequest,
    jsonResponse,
} from "../../../../lib/admin/serverAuth";
import {
    buildR2PublicUrl,
    getR2Config,
    isAllowedImageMimeType,
    makeAvailableR2ObjectKey,
    MAX_IMAGE_SIZE_BYTES,
    MAX_MEDIA_SIZE_BYTES,
    normalizeR2FolderPath,
    putR2Object,
} from "../../../../lib/media/r2";

const optionalDimension = (value: unknown) => {
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) && parsed > 0 && parsed <= 100_000 ? parsed : null;
};

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
        const formData = await request.formData();
        const file = formData.get("file");
        if (!(file instanceof File)) {
            return jsonResponse({ error: "Choose a valid file to upload." }, 400);
        }

        const rawFolder = String(formData.get("folder") || "");
        const folder = normalizeR2FolderPath(rawFolder);
        const filename = file.name.trim().slice(0, 255);
        const contentType = file.type?.trim().toLowerCase() || "application/octet-stream";
        const fileSize = file.size;
        const width = optionalDimension(formData.get("width"));
        const height = optionalDimension(formData.get("height"));
        const rawProjectId = formData.get("projectId");
        const projectId = typeof rawProjectId === "string" && UUID_PATTERN.test(rawProjectId)
            ? rawProjectId
            : null;

        if (!filename) {
            return jsonResponse({ error: "The file must have a valid filename." }, 400);
        }
        if (!isAllowedImageMimeType(contentType)) {
            return jsonResponse({ error: "Unsupported file type. Use images, videos, audio or documents." }, 400);
        }
        const isLargeMediaOrDoc = contentType.startsWith("video/") || contentType === "application/pdf";
        const maxAllowedSize = isLargeMediaOrDoc ? MAX_MEDIA_SIZE_BYTES : MAX_IMAGE_SIZE_BYTES;
        if (fileSize <= 0 || fileSize > maxAllowedSize) {
            return jsonResponse({ error: `File must be ${isLargeMediaOrDoc ? "100 MB" : "20 MB"} or smaller.` }, 400);
        }

        const config = getR2Config();
        const objectKey = await makeAvailableR2ObjectKey(folder, filename);
        const bytes = new Uint8Array(await file.arrayBuffer());
        const uploaded = await putR2Object({
            objectKey,
            body: bytes,
            contentType,
        });

        const slashIndex = objectKey.lastIndexOf("/");
        const folderPath = slashIndex > -1 ? objectKey.slice(0, slashIndex) : "";
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
            originProjectId = project.id;
        }

        const record = {
            storage_provider: "cloudflare_r2",
            storage_bucket: config.bucket,
            object_key: objectKey,
            folder_path: folderPath,
            public_url: uploaded.publicUrl,
            original_filename: filename,
            mime_type: contentType,
            file_size: fileSize,
            width,
            height,
            etag: null,
            created_by: authorization.user.id,
            ...(originProjectId ? { origin_project_id: originProjectId } : {}),
            metadata: {
                lastModified: new Date().toISOString(),
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
            console.error("Could not catalogue the uploaded asset:", error);
            // Even if Supabase catalogue insert fails, return successful upload info
            return jsonResponse({
                asset: {
                    id: objectKey,
                    storageProvider: "cloudflare_r2",
                    storageBucket: config.bucket,
                    objectKey,
                    folderPath,
                    publicUrl: uploaded.publicUrl,
                    originalFilename: filename,
                    mimeType: contentType,
                    fileSize,
                    width,
                    height,
                    catalogued: false,
                    processingStatus: "uploaded",
                    processingError: null,
                    variants: {},
                    createdAt: new Date().toISOString(),
                },
            });
        }

        return jsonResponse({
            asset: {
                id: data.id,
                storageProvider: data.storage_provider,
                storageBucket: data.storage_bucket,
                objectKey: data.object_key,
                folderPath: data.folder_path,
                publicUrl: data.public_url,
                originalFilename: data.original_filename,
                mimeType: data.mime_type,
                fileSize: data.file_size,
                width: data.width,
                height: data.height,
                etag: data.etag,
                catalogued: true,
                processingStatus: data.processing_status,
                processingError: data.processing_error,
                variants: mapVariants(data.media_variants, config),
                createdAt: data.created_at,
            },
        });
    } catch (error) {
        console.error("Could not complete the R2 upload:", error);
        const message = error instanceof Error ? error.message : "Could not upload the file.";
        return jsonResponse({ error: message }, 500);
    }
};
