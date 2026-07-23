import { createClient } from "@supabase/supabase-js";
import { measureXRImageQuality } from "../src/lib/xr-showcase/image-quality.js";

const IMAGE_LIMIT_BYTES = 8 * 1024 * 1024;
const url = process.env.PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  throw new Error("PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data: items, error } = await supabase
  .from("xr_showcase_items")
  .select("id,title,effective_image_url,metadata")
  .eq("status", "published");

if (error) throw error;

let measured = 0;
let unavailable = 0;

for (const item of items || []) {
  const imageUrl = item.effective_image_url;
  if (!imageUrl) {
    unavailable += 1;
    continue;
  }

  try {
    const response = await fetch(imageUrl, {
      headers: {
        Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        "User-Agent":
          "Mozilla/5.0 (compatible; XRShowcaseMetadataBot/2.0; +https://abodid.com/xr-showcase)",
      },
      signal: AbortSignal.timeout(12_000),
    });
    const contentType = response.headers.get("content-type") || "";
    const declaredSize = Number(response.headers.get("content-length") || 0);
    if (
      !response.ok ||
      !contentType.startsWith("image/") ||
      declaredSize > IMAGE_LIMIT_BYTES
    ) {
      throw new Error(`Image response was not usable (${response.status}).`);
    }

    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > IMAGE_LIMIT_BYTES) throw new Error("Image exceeded the size limit.");
    const imageQuality = await measureXRImageQuality(bytes, imageUrl);
    const { error: updateError } = await supabase
      .from("xr_showcase_items")
      .update({
        metadata: {
          ...(item.metadata || {}),
          image_quality: imageQuality,
        },
      })
      .eq("id", item.id);
    if (updateError) throw updateError;
    measured += 1;
    console.log(
      `${String(imageQuality.score).padStart(3)}  ${imageQuality.width}×${imageQuality.height}  ${item.title}`,
    );
  } catch (imageError) {
    unavailable += 1;
    console.warn(`---  ${item.title}: ${imageError.message}`);
  }
}

console.log(`Measured ${measured}; unavailable or missing ${unavailable}.`);
