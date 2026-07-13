import type { APIRoute } from "astro";
import sharp from "sharp";
import { OPTIMIZABLE_IMAGE_HOSTS } from "../../lib/imageOptimization.js";

export const prerender = false;

const WIDTHS = [320, 480, 640, 800, 960, 1200, 1600, 2000];
const QUALITIES = [68, 74, 80, 84];
const MAX_SOURCE_BYTES = 25 * 1024 * 1024;

const closestAllowedValue = (requested: number, allowed: number[]) =>
  allowed.reduce((closest, value) =>
    Math.abs(value - requested) < Math.abs(closest - requested) ? value : closest,
  );

const parseSourceUrl = (value: string | null) => {
  if (!value || value.length > 2048) return null;

  try {
    const source = new URL(value);
    if (
      source.protocol !== "https:" ||
      !OPTIMIZABLE_IMAGE_HOSTS.has(source.hostname)
    ) {
      return null;
    }
    return source;
  } catch {
    return null;
  }
};

const fetchAllowedImage = async (initialUrl: URL) => {
  let currentUrl = initialUrl;

  for (let redirectCount = 0; redirectCount <= 3; redirectCount += 1) {
    const response = await fetch(currentUrl, {
      headers: {
        Accept: "image/avif,image/webp,image/*,*/*;q=0.8",
        "User-Agent": "AbodidImageOptimizer/1.0",
      },
      redirect: "manual",
      signal: AbortSignal.timeout(15_000),
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) throw new Error("Image redirect did not include a location");

      const redirectedUrl = new URL(location, currentUrl);
      if (
        redirectedUrl.protocol !== "https:" ||
        !OPTIMIZABLE_IMAGE_HOSTS.has(redirectedUrl.hostname)
      ) {
        throw new Error("Image redirected to a host that is not allowed");
      }

      currentUrl = redirectedUrl;
      continue;
    }

    if (!response.ok) {
      throw new Error(`Image source returned ${response.status}`);
    }

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.startsWith("image/")) {
      throw new Error("Source did not return an image");
    }

    const contentLength = Number(response.headers.get("content-length") || 0);
    if (contentLength > MAX_SOURCE_BYTES) {
      throw new Error("Source image is too large to optimize safely");
    }

    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > MAX_SOURCE_BYTES) {
      throw new Error("Source image is too large to optimize safely");
    }

    return bytes;
  }

  throw new Error("Image source redirected too many times");
};

export const GET: APIRoute = async ({ url }) => {
  const source = parseSourceUrl(url.searchParams.get("src"));
  if (!source) {
    return new Response("Unsupported image source", {
      status: 400,
      headers: { "Cache-Control": "no-store" },
    });
  }

  const requestedWidth = Number(url.searchParams.get("w") || 1200);
  const requestedQuality = Number(url.searchParams.get("q") || 76);
  const width = closestAllowedValue(
    Number.isFinite(requestedWidth) ? requestedWidth : 1200,
    WIDTHS,
  );
  const quality = closestAllowedValue(
    Number.isFinite(requestedQuality) ? requestedQuality : 76,
    QUALITIES,
  );

  try {
    const sourceBytes = await fetchAllowedImage(source);
    const optimizedBytes = await sharp(sourceBytes, {
      limitInputPixels: 50_000_000,
    })
      .rotate()
      .resize({ width, withoutEnlargement: true })
      .webp({ quality, effort: 4, smartSubsample: true })
      .toBuffer();

    return new Response(new Uint8Array(optimizedBytes), {
      headers: {
        "Cache-Control": "public, max-age=604800, stale-while-revalidate=86400",
        "Vercel-CDN-Cache-Control":
          "s-maxage=2592000, stale-while-revalidate=86400",
        "Content-Type": "image/webp",
        "Content-Length": String(optimizedBytes.byteLength),
        "Cross-Origin-Resource-Policy": "same-origin",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Image optimization failed", {
      source: source.hostname,
      message: error instanceof Error ? error.message : String(error),
    });

    return new Response("Unable to optimize image", {
      status: 502,
      headers: { "Cache-Control": "no-store" },
    });
  }
};
