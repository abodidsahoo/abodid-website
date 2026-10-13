export type MediaVariantProcessor = "cloudflare" | "vercel";

/**
 * Cloudflare's R2 notification queue is the normal image-variant processor.
 * Set MEDIA_VARIANT_PROCESSOR=vercel only as an operational fallback when the
 * Cloudflare queue or Images binding cannot be used.
 */
export const resolveMediaVariantProcessor = (
    value = process.env.MEDIA_VARIANT_PROCESSOR,
): MediaVariantProcessor =>
    value?.trim().toLowerCase() === "vercel" ? "vercel" : "cloudflare";

export const shouldUseVercelVariantProcessor = () =>
    resolveMediaVariantProcessor() === "vercel";
