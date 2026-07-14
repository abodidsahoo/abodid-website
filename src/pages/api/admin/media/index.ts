import type { APIRoute } from "astro";
import {
    authorizeAdminRequest,
    jsonResponse,
} from "../../../../lib/admin/serverAuth";

const MEDIA_COLUMNS = [
    "id",
    "storage_provider",
    "storage_bucket",
    "object_key",
    "folder_path",
    "public_url",
    "original_filename",
    "mime_type",
    "file_size",
    "width",
    "height",
    "etag",
    "created_at",
].join(",");

const mapAsset = (asset: Record<string, unknown>) => ({
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
    createdAt: asset.created_at,
});

export const GET: APIRoute = async ({ request }) => {
    const authorization = await authorizeAdminRequest(request);
    if (!authorization.ok) return authorization.response;

    const { data, error } = await authorization.supabase
        .from("media_assets")
        .select(MEDIA_COLUMNS)
        .order("created_at", { ascending: false })
        .limit(48);

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

    return jsonResponse({ assets: (data || []).map(mapAsset) });
};
