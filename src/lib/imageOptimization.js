const OPTIMIZABLE_IMAGE_HOSTS = new Set([
  "jwipqbjxpmgyevfzpjjx.supabase.co",
  "img.youtube.com",
  "i.ytimg.com",
  "i.vimeocdn.com",
]);

const DEFAULT_WIDTHS = [480, 800, 1200, 1600];

export function canOptimizeImageUrl(source) {
  if (typeof source !== "string" || !source.trim()) return false;

  try {
    const url = new URL(source);
    return url.protocol === "https:" && OPTIMIZABLE_IMAGE_HOSTS.has(url.hostname);
  } catch {
    return false;
  }
}

export function getOptimizedImageUrl(source, { width = 1200, quality = 76 } = {}) {
  if (!canOptimizeImageUrl(source)) return source;

  const params = new URLSearchParams({
    src: source,
    w: String(width),
    q: String(quality),
  });

  return `/api/image?${params.toString()}`;
}

export function getOptimizedImageSrcSet(
  source,
  { widths = DEFAULT_WIDTHS, quality = 76 } = {},
) {
  if (!canOptimizeImageUrl(source)) return undefined;

  return [...new Set(widths)]
    .sort((a, b) => a - b)
    .map(
      (width) =>
        `${getOptimizedImageUrl(source, { width, quality })} ${width}w`,
    )
    .join(", ");
}

export { OPTIMIZABLE_IMAGE_HOSTS };
