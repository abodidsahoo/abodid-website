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
    "image/avif",
]);

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
        const { data, info } = await sharp(sourceBytes)
            .rotate()
            .resize({ width, withoutEnlargement: true })
            .webp({ quality: 82, effort: 4, smartSubsample: true })
            .toBuffer({ resolveWithObject: true });
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
            actual_width: info.width,
            actual_height: info.height,
            object_key: uploaded.objectKey,
            public_url: buildR2PublicUrl(config, uploaded.objectKey),
            mime_type: "image/webp",
            file_size: data.byteLength,
            quality: 82,
            animated: false,
            source_etag: fingerprint,
            transform_version: 1,
            metadata: { generatedAutomatically: true },
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
