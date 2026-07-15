import type { APIRoute } from "astro";
import {
    authorizeAdminRequest,
    jsonResponse,
} from "../../../../lib/admin/serverAuth";
import {
    buildR2PublicUrl,
    getR2Basename,
    inferR2MimeType,
    searchR2Folder,
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
        const searchTerm = (url.searchParams.get("q") || "").trim();
        if (!searchTerm || searchTerm.length > 100) {
            return jsonResponse({ error: "Enter a search term up to 100 characters." }, 400);
        }

        const search = await searchR2Folder(
            url.searchParams.get("folder") || "",
            searchTerm,
        );

        let catalogueQuery = authorization.supabase
            .from("media_assets")
            .select(MEDIA_COLUMNS)
            .eq("storage_provider", "cloudflare_r2")
            .eq("storage_bucket", search.config.bucket);

        if (search.folderPath) {
            catalogueQuery = catalogueQuery.or(
                `folder_path.eq.${search.folderPath},folder_path.like.${search.folderPath}/%`,
            );
        }

        const { data: catalogueRows, error } = await catalogueQuery.limit(5_000);
        if (error) {
            console.error("Could not load catalogue metadata for media search:", error);
            return jsonResponse({ error: "Could not search the media catalogue." }, 500);
        }

        const catalogue = new Map(
            (catalogueRows || []).map((asset) => [asset.object_key, asset]),
        );
        const files = search.files.map((object) => {
            const asset = catalogue.get(object.objectKey);
            return {
                id: asset?.id || object.objectKey,
                objectKey: object.objectKey,
                name: asset?.original_filename || getR2Basename(object.objectKey),
                publicUrl: buildR2PublicUrl(search.config, object.objectKey),
                mimeType: asset?.mime_type || inferR2MimeType(object.objectKey),
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

        return jsonResponse({
            folderPath: search.folderPath,
            files,
            folderMatches: search.folderMatches,
            scannedObjects: search.scannedObjects,
            truncated: search.truncated,
        });
    } catch (error) {
        console.error("Could not search R2 media:", error);
        const message = error instanceof Error ? error.message : "Could not search the media library.";
        return jsonResponse({ error: message }, 500);
    }
};
