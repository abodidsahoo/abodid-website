import { createHash } from "node:crypto";
import sharp from "sharp";
import {
    buildR2PublicUrl,
    getR2Config,
    putR2Object,
    R2_VARIANTS_PREFIX,
    R2_VARIANT_WIDTHS,
} from "./r2";

const PROCESSABLE_IMAGE_TYPES = new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "image/avif",
]);

export const MEDIA_VARIANT_TRANSFORM_VERSION = 2;
export const STILL_WEBP_QUALITY = 82;

export const animatedWebpQuality = (sourceSize: number, frameCount: number) => {
    if (sourceSize >= 12 * 1024 * 1024 || frameCount >= 120) return 68;
    if (sourceSize >= 6 * 1024 * 1024 || frameCount >= 60) return 72;
    return 76;
};

export const encodeR2ImageVariant = async ({
    sourceBytes,
    width,
}: {
    sourceBytes: Uint8Array;
    width: number;
}) => {
    const metadata = await sharp(sourceBytes, { animated: true }).metadata();
    const frameCount = Math.max(1, Number(metadata.pages || 1));
    const animated = frameCount > 1;
    const quality = animated
        ? animatedWebpQuality(sourceBytes.byteLength, frameCount)
        : STILL_WEBP_QUALITY;
    const input = sharp(sourceBytes, animated ? { animated: true } : undefined)
        .rotate()
        .resize({ width, withoutEnlargement: true });

    const data = await input
        .webp(animated
            ? {
                quality,
                alphaQuality: 90,
                effort: 6,
                minSize: true,
                mixed: true,
                smartSubsample: true,
              }
            : { quality, effort: 4, smartSubsample: true })
        .toBuffer();
    const outputMetadata = await sharp(data, { animated: true }).metadata();
    const outputFrameCount = Math.max(1, Number(outputMetadata.pages || 1));

    if (animated && outputFrameCount <= 1) {
        throw new Error("Animated image variant lost its animation frames.");
    }

    return {
        data,
        width: Number(outputMetadata.width || 0),
        height: Number(outputMetadata.pageHeight || outputMetadata.height || 0),
        animated,
        frameCount: outputFrameCount,
        quality,
    };
};

const originalRelativePath = (objectKey: string) => {
    for (const prefix of ["photos/originals/", "originals/"]) {
        if (objectKey.startsWith(prefix)) return objectKey.slice(prefix.length);
    }
    return null;
};

export const canGenerateR2ImageVariants = (objectKey: string, mimeType: string) =>
    PROCESSABLE_IMAGE_TYPES.has(mimeType) && Boolean(originalRelativePath(objectKey));

export const generateR2ImageVariants = async ({
    objectKey,
    sourceBytes,
    mimeType,
}: {
    objectKey: string;
    sourceBytes: Uint8Array;
    mimeType: string;
}) => {
    const relativePath = originalRelativePath(objectKey);
    if (!relativePath || !PROCESSABLE_IMAGE_TYPES.has(mimeType)) return [];

    const slashIndex = relativePath.lastIndexOf("/");
    const directory = slashIndex >= 0 ? relativePath.slice(0, slashIndex) : "";
    const filename = slashIndex >= 0 ? relativePath.slice(slashIndex + 1) : relativePath;
    const stem = filename.replace(/\.[^.]+$/, "");
    const fingerprint = createHash("sha256").update(sourceBytes).digest("hex").slice(0, 10);
    const config = getR2Config();

    const variants = [];
    for (const width of R2_VARIANT_WIDTHS) {
        const encoded = await encodeR2ImageVariant({ sourceBytes, width });
        const { data } = encoded;
        const objectKeyPrefix = directory ? `${R2_VARIANTS_PREFIX}/${directory}` : R2_VARIANTS_PREFIX;
        const variantObjectKey = `${objectKeyPrefix}/${width}/${stem}-${fingerprint}.webp`;
        const uploaded = await putR2Object({
            objectKey: variantObjectKey,
            body: new Uint8Array(data),
            contentType: "image/webp",
        });

        variants.push({
            variant_key: String(width),
            target_width: width,
            actual_width: encoded.width,
            actual_height: encoded.height,
            object_key: uploaded.objectKey,
            public_url: buildR2PublicUrl(config, uploaded.objectKey),
            mime_type: "image/webp",
            file_size: data.byteLength,
            quality: encoded.quality,
            animated: encoded.animated,
            source_etag: fingerprint,
            transform_version: MEDIA_VARIANT_TRANSFORM_VERSION,
            metadata: {
                generatedAutomatically: true,
                frameCount: encoded.frameCount,
                sourceMimeType: mimeType,
            },
        });
    }
    return variants;
};

export const catalogueR2ImageVariants = async ({
    supabase,
    assetId,
    objectKey,
    sourceBytes,
    mimeType,
}: {
    supabase: any;
    assetId: string;
    objectKey: string;
    sourceBytes: Uint8Array;
    mimeType: string;
}) => {
    if (!canGenerateR2ImageVariants(objectKey, mimeType)) return { attempted: false };

    await supabase
        .from("media_assets")
        .update({ processing_status: "processing", processing_error: null })
        .eq("id", assetId);

    try {
        const variants = await generateR2ImageVariants({ objectKey, sourceBytes, mimeType });
        const { error: variantsError } = await supabase
            .from("media_variants")
            .upsert(
                variants.map((variant) => ({ ...variant, asset_id: assetId })),
                { onConflict: "asset_id,variant_key" },
            );
        if (variantsError) throw variantsError;

        const processedAt = new Date().toISOString();
        const { error: assetError } = await supabase
            .from("media_assets")
            .update({
                processing_status: "ready",
                processing_error: null,
                ready_at: processedAt,
                last_processed_at: processedAt,
            })
            .eq("id", assetId);
        if (assetError) throw assetError;
        return { attempted: true, ready: true, variants };
    } catch (error) {
        const message = error instanceof Error ? error.message : "Image optimization failed.";
        await supabase
            .from("media_assets")
            .update({
                processing_status: "failed",
                processing_error: message.slice(0, 1_000),
                last_processed_at: new Date().toISOString(),
            })
            .eq("id", assetId);
        console.error("Could not generate R2 image variants:", { objectKey, error });
        return { attempted: true, ready: false, error: message };
    }
};
