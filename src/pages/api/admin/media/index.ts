import type { APIRoute } from "astro";
import {
    authorizeAdminRequest,
    jsonResponse,
} from "../../../../lib/admin/serverAuth";
import {
    buildR2PublicUrl,
    getR2Basename,
    inferR2MimeType,
    listR2Folder,
} from "../../../../lib/media/r2";

const MEDIA_COLUMNS = [
    "id",
    "object_key",
    "original_filename",
    "mime_type",
    "file_size",
    "width",
    "height",
    "alt_text",
    "caption",
    "credit",
    "created_at",
    "updated_at",
    "processing_status",
    "processing_error",
    "media_variants(variant_key,target_width,actual_width,actual_height,public_url,file_size,mime_type)",
].join(",");

const mapVariants = (rows: Array<Record<string, unknown>> | null | undefined) =>
    Object.fromEntries((rows || []).map((variant) => [
        String(variant.variant_key),
        {
            key: variant.variant_key,
            url: variant.public_url,
            width: variant.actual_width,
            height: variant.actual_height,
            targetWidth: variant.target_width,
            fileSize: variant.file_size,
            mimeType: variant.mime_type,
        },
    ]));

export const GET: APIRoute = async ({ request }) => {
    const authorization = await authorizeAdminRequest(request);
    if (!authorization.ok) return authorization.response;

    try {
        const url = new URL(request.url);
        const browser = await listR2Folder(url.searchParams.get("folder") || "");

        const { data: catalogueRows, error } = await authorization.supabase
            .from("media_assets")
            .select(MEDIA_COLUMNS)
            .eq("storage_provider", "cloudflare_r2")
            .eq("storage_bucket", browser.config.bucket)
            .eq("folder_path", browser.folderPath)
            .limit(2_000);

        if (error) {
            console.error("Could not load the media catalogue:", error);
            const missingTable = ["42P01", "PGRST205"].includes(error.code || "");
            return jsonResponse(
                {
                    error: missingTable
                        ? "The media catalogue migration has not been applied yet."
                        : "Could not load the media catalogue.",
                    code: missingTable ? "MEDIA_CATALOGUE_MISSING" : "MEDIA_CATALOGUE_ERROR",
                },
                missingTable ? 503 : 500,
            );
        }

        const catalogue = new Map(
            (catalogueRows || []).map((asset) => [asset.object_key, asset]),
        );
        const files = browser.files.map((object) => {
            const asset = catalogue.get(object.objectKey);
            const mimeType = asset?.mime_type || inferR2MimeType(object.objectKey);
            return {
                id: asset?.id || object.objectKey,
                objectKey: object.objectKey,
                name: asset?.original_filename || getR2Basename(object.objectKey),
                publicUrl: buildR2PublicUrl(browser.config, object.objectKey),
                mimeType,
                fileSize: object.fileSize,
                width: asset?.width || null,
                height: asset?.height || null,
                altText: asset?.alt_text || "",
                caption: asset?.caption || "",
                credit: asset?.credit || "",
                etag: object.etag,
                createdAt: asset?.created_at || object.lastModified,
                updatedAt: asset?.updated_at || object.lastModified,
                catalogued: Boolean(asset),
                processingStatus: asset?.processing_status || (asset ? "uploaded" : "uncatalogued"),
                processingError: asset?.processing_error || null,
                variants: mapVariants(asset?.media_variants),
            };
        });
        const folders = browser.folders.map((path) => ({
            name: getR2Basename(path),
            path,
        }));

        return jsonResponse({
            folderPath: browser.folderPath,
            folders,
            files,
            truncated: browser.truncated,
        });
    } catch (error) {
        console.error("Could not browse R2 media:", error);
        const message = error instanceof Error ? error.message : "Could not browse the media library.";
        return jsonResponse({ error: message }, 500);
    }
};
