import type { APIRoute } from "astro";

export const prerender = false;

const ALLOWED_HOSTS = new Set([
  "assets.abodid.com",
  "images.unsplash.com",
]);

function isHostAllowed(hostname: string): boolean {
  if (ALLOWED_HOSTS.has(hostname)) return true;
  if (hostname.endsWith(".supabase.co")) return true;
  return false;
}

export const GET: APIRoute = async ({ request }) => {
  const requestUrl = new URL(request.url);
  const rawUrl = requestUrl.searchParams.get("url");

  if (!rawUrl) {
    return new Response("Missing image URL", { status: 400 });
  }

  let imageUrl: URL;
  try {
    imageUrl = new URL(rawUrl);
  } catch {
    return new Response("Invalid image URL", { status: 400 });
  }

  if (imageUrl.protocol !== "https:" || !isHostAllowed(imageUrl.hostname)) {
    return new Response("Image host not allowed", { status: 403 });
  }

  try {
    const upstream = await fetch(imageUrl, {
      headers: { Accept: "image/avif,image/webp,image/*,*/*;q=0.8" },
    });

    if (!upstream.ok || !upstream.body) {
      return new Response("Image unavailable", { status: upstream.status || 502 });
    }

    const contentType = upstream.headers.get("content-type") || "image/webp";
    if (!contentType.startsWith("image/")) {
      return new Response("Upstream response is not an image", { status: 502 });
    }

    return new Response(upstream.body, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400, s-maxage=604800, stale-while-revalidate=2592000",
        "X-Content-Type-Options": "nosniff",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch {
    return new Response("Image unavailable", { status: 502 });
  }
};
