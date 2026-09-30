export const prerender = false;

import { createHash } from "node:crypto";
import type { APIRoute } from "astro";
import sharp from "sharp";
import {
    authorizeAdminRequest,
    jsonResponse,
} from "../../../../lib/admin/serverAuth";
import {
    assertR2OriginalObjectKey,
    buildR2PublicUrl,
    getR2Basename,
    getR2ObjectBytes,
    headR2Object,
    putR2Object,
} from "../../../../lib/media/r2";

const cleanEtag = (value: string | undefined) => value?.replace(/^"|"$/g, "") || null;
const JPEG_MIME_TYPES = new Set(["image/jpeg", "image/jpg"]);
const CONVERTIBLE_MIME_TYPES = new Set(["image/webp", "image/png", "image/avif"]);
const POST_FORMATS = {
    portrait: { width: 1080, height: 1350 },
    square: { width: 1080, height: 1080 },
    landscape: { width: 1080, height: 566 },
} as const;

const bounded = (value: unknown, fallback: number, minimum: number, maximum: number) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.min(maximum, Math.max(minimum, parsed)) : fallback;
};

const readLayout = (body: any) => {
    const format = typeof body?.format === "string" && body.format in POST_FORMATS
        ? body.format as keyof typeof POST_FORMATS
        : null;
    if (!format) return null;
    return {
        format,
        ...POST_FORMATS[format],
        fit: body?.crop?.fit === "contain" ? "contain" as const : "cover" as const,
        zoom: bounded(body?.crop?.zoom, 1, 1, 3),
        positionX: bounded(body?.crop?.positionX, 0.5, 0, 1),
        positionY: bounded(body?.crop?.positionY, 0.5, 0, 1),
    };
};

const mapAsset = (asset: Record<string, any>) => ({
    id: asset.id,
    objectKey: asset.object_key,
    publicUrl: asset.public_url,
    originalFilename: asset.original_filename,
    mimeType: asset.mime_type,
    fileSize: asset.file_size,
    width: asset.width,
    height: asset.height,
    catalogued: true,
    processingStatus: asset.processing_status,
    variants: {},
});

export const POST: APIRoute = async ({ request }) => {
    const authorization = await authorizeAdminRequest(request);
    if (!authorization.ok) return authorization.response;

    try {
        const body = await request.json();
        const objectKey = assertR2OriginalObjectKey(body?.objectKey);
        const suppliedName = typeof body?.originalFilename === "string"
            ? body.originalFilename.trim().slice(0, 255)
            : "";
        const catalogueOnly = body?.catalogueOnly === true;
        const layout = catalogueOnly ? null : readLayout(body);
        const originalFilename = suppliedName || getR2Basename(objectKey);
        const { config, object } = await headR2Object(objectKey);
        const reportedMimeType = String(object.ContentType || "").toLowerCase();
        const fileSize = Number(object.ContentLength || 0);
        const etag = cleanEtag(object.ETag);
        const slashIndex = objectKey.lastIndexOf("/");
        const folderPath = slashIndex >= 0 ? objectKey.slice(0, slashIndex) : "";

        const { data: existingSource } = await authorization.supabase
            .from("media_assets")
            .select("id,width,height,metadata")
            .eq("storage_provider", "cloudflare_r2")
            .eq("storage_bucket", config.bucket)
            .eq("object_key", objectKey)
            .maybeSingle();
        const existingMetadata = existingSource?.metadata && typeof existingSource.metadata === "object"
            ? existingSource.metadata
            : {};
        const cachedInstagramAsset = existingMetadata.instagramAsset;

        if (
            !catalogueOnly
            && !layout
            && cachedInstagramAsset?.id
            && cachedInstagramAsset?.sourceEtag === etag
        ) {
            const { data: readyAsset } = await authorization.supabase
                .from("media_assets")
                .select("id,object_key,public_url,original_filename,mime_type,file_size,width,height,processing_status")
                .eq("id", cachedInstagramAsset.id)
                .maybeSingle();
            if (readyAsset && JPEG_MIME_TYPES.has(String(readyAsset.mime_type).toLowerCase())) {
                return jsonResponse({ asset: mapAsset(readyAsset), converted: true, cached: true });
            }
        }

        let actualMimeType = reportedMimeType;
        let width = existingSource?.width || null;
        let height = existingSource?.height || null;
        let sourceBytes: Uint8Array | null = null;

        // A genuine JPEG is catalogued as-is. It is never decoded, resized or recompressed.
        if (!catalogueOnly && (layout || !JPEG_MIME_TYPES.has(actualMimeType))) {
            sourceBytes = await getR2ObjectBytes(objectKey);
            const sourceInfo = await sharp(sourceBytes).metadata();
            actualMimeType = sourceInfo.format === "jpeg" ? "image/jpeg" : `image/${sourceInfo.format || "unknown"}`;
            width = sourceInfo.width || width;
            height = sourceInfo.height || height;
        }

        const sourceRecord = {
            storage_provider: "cloudflare_r2",
            storage_bucket: config.bucket,
            object_key: objectKey,
            folder_path: folderPath,
            public_url: buildR2PublicUrl(config, objectKey),
            original_filename: originalFilename,
            mime_type: actualMimeType,
            file_size: fileSize,
            width,
            height,
            etag,
            created_by: authorization.user.id,
            metadata: {
                ...existingMetadata,
                cacheControl: object.CacheControl || null,
                lastModified: object.LastModified?.toISOString() || null,
            },
        };
        const { data: sourceAsset, error: sourceError } = await authorization.supabase
            .from("media_assets")
            .upsert(sourceRecord, { onConflict: "storage_provider,storage_bucket,object_key" })
            .select("id,object_key,public_url,original_filename,mime_type,file_size,width,height,processing_status,metadata")
            .single();
        if (sourceError) throw sourceError;

        if (JPEG_MIME_TYPES.has(actualMimeType) && !layout) {
            return jsonResponse({ asset: mapAsset(sourceAsset), converted: false });
        }
        if (catalogueOnly) {
            return jsonResponse({
                asset: mapAsset(sourceAsset),
                converted: false,
                readyForInstagram: false,
            });
        }
        if (!JPEG_MIME_TYPES.has(actualMimeType) && !CONVERTIBLE_MIME_TYPES.has(actualMimeType) || !sourceBytes) {
            return jsonResponse({ error: "This original image format cannot be prepared for Instagram." }, 400);
        }

        // The source really is WebP/PNG/AVIF. Preserve it and create one immutable
        // JPEG specifically for Meta, keyed by the source bytes for idempotency.
        const sourceFingerprint = createHash("sha256").update(sourceBytes).digest("hex").slice(0, 12);
        const layoutFingerprint = layout
            ? createHash("sha256").update(JSON.stringify(layout)).digest("hex").slice(0, 8)
            : "";
        const fingerprint = layout ? `${sourceFingerprint}-${layoutFingerprint}` : sourceFingerprint;
        const relativePath = objectKey.replace(/^photos\/originals\//, "").replace(/^originals\//, "");
        const relativeSlash = relativePath.lastIndexOf("/");
        const directory = relativeSlash >= 0 ? relativePath.slice(0, relativeSlash) : "";
        const sourceName = relativeSlash >= 0 ? relativePath.slice(relativeSlash + 1) : relativePath;
        const stem = sourceName.replace(/\.[^.]+$/, "");
        const instagramObjectKey = `photos/instagram/${directory ? `${directory}/` : ""}${stem}-${fingerprint}.jpg`;
        let output = sharp(sourceBytes).rotate();
        if (layout) {
            const { data: oriented, info: orientedInfo } = await output
                .toBuffer({ resolveWithObject: true });
            const baseScale = layout.fit === "cover"
                ? Math.max(layout.width / orientedInfo.width, layout.height / orientedInfo.height)
                : Math.min(layout.width / orientedInfo.width, layout.height / orientedInfo.height);
            const scale = baseScale * layout.zoom;
            const resizedWidth = Math.max(1, Math.round(orientedInfo.width * scale));
            const resizedHeight = Math.max(1, Math.round(orientedInfo.height * scale));
            const resized = sharp(oriented).resize(resizedWidth, resizedHeight, { fit: "fill" });
            const overflowX = Math.max(0, resizedWidth - layout.width);
            const overflowY = Math.max(0, resizedHeight - layout.height);
            const visibleWidth = Math.min(resizedWidth, layout.width);
            const visibleHeight = Math.min(resizedHeight, layout.height);
            const cropped = await resized.extract({
                left: Math.round(overflowX * layout.positionX),
                top: Math.round(overflowY * layout.positionY),
                width: visibleWidth,
                height: visibleHeight,
            }).toBuffer();
            const left = Math.round(Math.max(0, layout.width - visibleWidth) * layout.positionX);
            const top = Math.round(Math.max(0, layout.height - visibleHeight) * layout.positionY);
            output = sharp({
                create: { width: layout.width, height: layout.height, channels: 3, background: "#000000" },
            }).composite([{ input: cropped, left, top }]);
        }
        const { data: jpegBytes, info } = await output
            .jpeg({ quality: 95, chromaSubsampling: "4:4:4", mozjpeg: true })
            .toBuffer({ resolveWithObject: true });
        const uploaded = await putR2Object({
            objectKey: instagramObjectKey,
            body: new Uint8Array(jpegBytes),
            contentType: "image/jpeg",
        });
        const instagramFolderSlash = instagramObjectKey.lastIndexOf("/");
        const instagramRecord = {
            storage_provider: "cloudflare_r2",
            storage_bucket: config.bucket,
            object_key: instagramObjectKey,
            folder_path: instagramObjectKey.slice(0, instagramFolderSlash),
            public_url: uploaded.publicUrl,
            original_filename: `${stem}.jpg`,
            mime_type: "image/jpeg",
            file_size: jpegBytes.byteLength,
            width: info.width,
            height: info.height,
            created_by: authorization.user.id,
            processing_status: "ready",
            ready_at: new Date().toISOString(),
            metadata: {
                generatedFor: "instagram",
                sourceAssetId: sourceAsset.id,
                sourceObjectKey: objectKey,
                sourceEtag: etag,
                ...(layout ? { postFormat: layout.format, crop: layout } : {}),
            },
        };
        const { data: instagramAsset, error: instagramError } = await authorization.supabase
            .from("media_assets")
            .upsert(instagramRecord, { onConflict: "storage_provider,storage_bucket,object_key" })
            .select("id,object_key,public_url,original_filename,mime_type,file_size,width,height,processing_status")
            .single();
        if (instagramError) throw instagramError;

        const instagramMetadata = {
            id: instagramAsset.id,
            objectKey: instagramAsset.object_key,
            publicUrl: instagramAsset.public_url,
            originalFilename: instagramAsset.original_filename,
            mimeType: instagramAsset.mime_type,
            fileSize: instagramAsset.file_size,
            width: instagramAsset.width,
            height: instagramAsset.height,
            sourceEtag: etag,
        };
        if (!layout) {
            await authorization.supabase
                .from("media_assets")
                .update({ metadata: { ...sourceAsset.metadata, instagramAsset: instagramMetadata } })
                .eq("id", sourceAsset.id);
        }

        return jsonResponse({ asset: mapAsset(instagramAsset), converted: true });
    } catch (error) {
        console.error("Could not prepare Instagram media:", error);
        const message = error instanceof Error ? error.message : "Could not prepare this photograph.";
        return jsonResponse({ error: message }, 500);
    }
};
