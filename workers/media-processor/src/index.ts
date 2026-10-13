import { extractMoodboardPaletteFromRgba } from "../../../src/lib/moodboard/paletteCore";

interface Env {
  MEDIA_BUCKET: R2Bucket;
  IMAGES: ImagesBinding;
  R2_BUCKET_NAME: string;
  PUBLIC_BASE_URL: string;
  TRANSFORM_VERSION: string;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
}

type R2Event = {
  action?: string;
  bucket?: string;
  object?: {
    key?: string;
    size?: number;
    eTag?: string;
  };
};

type MediaAssetRow = {
  id: string;
  object_key: string;
  processing_status: string;
};

type MediaVariantRow = {
  variant_key: "800" | "1600";
  object_key: string;
};

const MAX_IMAGE_SIZE_BYTES = 20 * 1024 * 1024;
const CACHE_CONTROL = "public, max-age=31536000, immutable";
const QUALITY = 82;
const ANIMATED_QUALITY = 76;
const LARGE_ANIMATED_QUALITY = 72;
const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
]);

const isMoodboardKey = (key: string) => key.startsWith("photos/originals/moodboard/");

export const readPngSample = async (bytes: Uint8Array) => {
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  if (!signature.every((value, index) => bytes[index] === value)) {
    throw new Error("Cloudflare palette sample was not a PNG.");
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  let interlace = 0;
  let palette = new Uint8Array();
  let transparency = new Uint8Array();
  const compressedParts: Uint8Array[] = [];
  for (let offset = 8; offset + 12 <= bytes.length;) {
    const length = view.getUint32(offset);
    const type = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8));
    const data = bytes.subarray(offset + 8, offset + 8 + length);
    if (type === "IHDR") {
      width = new DataView(data.buffer, data.byteOffset, data.byteLength).getUint32(0);
      height = new DataView(data.buffer, data.byteOffset, data.byteLength).getUint32(4);
      bitDepth = data[8];
      colorType = data[9];
      interlace = data[12];
    } else if (type === "PLTE") palette = data;
    else if (type === "tRNS") transparency = data;
    else if (type === "IDAT") compressedParts.push(data);
    else if (type === "IEND") break;
    offset += length + 12;
  }
  if (!width || !height || bitDepth !== 8 || interlace !== 0) {
    throw new Error("Cloudflare returned an unsupported palette PNG layout.");
  }

  const compressedLength = compressedParts.reduce((total, part) => total + part.length, 0);
  const compressed = new Uint8Array(compressedLength);
  let compressedOffset = 0;
  for (const part of compressedParts) {
    compressed.set(part, compressedOffset);
    compressedOffset += part.length;
  }
  const inflated = new Uint8Array(await new Response(
    new Blob([compressed]).stream().pipeThrough(new DecompressionStream("deflate")),
  ).arrayBuffer());
  const channels = ({ 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 } as Record<number, number>)[colorType];
  if (!channels) throw new Error(`Unsupported palette PNG colour type ${colorType}.`);
  const stride = width * channels;
  const scanlines = new Uint8Array(stride * height);
  const paeth = (a: number, b: number, c: number) => {
    const estimate = a + b - c;
    const distanceA = Math.abs(estimate - a);
    const distanceB = Math.abs(estimate - b);
    const distanceC = Math.abs(estimate - c);
    return distanceA <= distanceB && distanceA <= distanceC ? a : distanceB <= distanceC ? b : c;
  };
  let inputOffset = 0;
  for (let row = 0; row < height; row += 1) {
    const filter = inflated[inputOffset++];
    const rowOffset = row * stride;
    for (let column = 0; column < stride; column += 1) {
      const raw = inflated[inputOffset++];
      const left = column >= channels ? scanlines[rowOffset + column - channels] : 0;
      const above = row > 0 ? scanlines[rowOffset + column - stride] : 0;
      const upperLeft = row > 0 && column >= channels
        ? scanlines[rowOffset + column - stride - channels]
        : 0;
      const predictor = filter === 0 ? 0
        : filter === 1 ? left
          : filter === 2 ? above
            : filter === 3 ? Math.floor((left + above) / 2)
              : filter === 4 ? paeth(left, above, upperLeft)
                : Number.NaN;
      if (!Number.isFinite(predictor)) throw new Error(`Unsupported PNG filter ${filter}.`);
      scanlines[rowOffset + column] = (raw + predictor) & 255;
    }
  }

  const rgba = new Uint8Array(width * height * 4);
  for (let pixel = 0; pixel < width * height; pixel += 1) {
    const source = pixel * channels;
    const target = pixel * 4;
    if (colorType === 6) rgba.set(scanlines.subarray(source, source + 4), target);
    else if (colorType === 2) {
      rgba[target] = scanlines[source];
      rgba[target + 1] = scanlines[source + 1];
      rgba[target + 2] = scanlines[source + 2];
      rgba[target + 3] = 255;
    } else if (colorType === 3) {
      const paletteIndex = scanlines[source];
      rgba[target] = palette[paletteIndex * 3] || 0;
      rgba[target + 1] = palette[paletteIndex * 3 + 1] || 0;
      rgba[target + 2] = palette[paletteIndex * 3 + 2] || 0;
      rgba[target + 3] = transparency[paletteIndex] ?? 255;
    } else {
      const gray = scanlines[source];
      rgba[target] = gray;
      rgba[target + 1] = gray;
      rgba[target + 2] = gray;
      rgba[target + 3] = colorType === 4 ? scanlines[source + 1] : 255;
    }
  }
  return rgba;
};

const extractMoodboardPalette = async (env: Env, objectKey: string) => {
  const source = await env.MEDIA_BUCKET.get(objectKey);
  if (!source?.body) throw new Error(`Could not read ${objectKey} for palette extraction.`);
  const sample = await env.IMAGES.input(source.body)
    .transform({ width: 100, height: 100, fit: "cover" })
    .output({ format: "image/png", anim: false });
  const response = sample.response();
  if (!response.ok) throw new Error(`Cloudflare palette transform failed with ${response.status}.`);
  return extractMoodboardPaletteFromRgba(
    await readPngSample(new Uint8Array(await response.arrayBuffer())),
  );
};

const isOriginalKey = (key: string) => key.startsWith("originals/") || key.startsWith("photos/originals/");

const originalRelativePath = (key: string) => {
  if (key.startsWith("photos/originals/")) return key.slice("photos/originals/".length);
  if (key.startsWith("originals/")) return key.slice("originals/".length);
  return null;
};

export const variantFolderKeysFor = (originalFolderKey: string) => {
  const relative = originalRelativePath(originalFolderKey)?.replace(/\/+$/, "") || "";
  if (!relative) return [];
  return [800, 1600].map((width) => `photos/variants/${relative}/${width}/`);
};

const cleanBaseUrl = (value: string) => value.replace(/\/+$/, "");

const publicUrlFor = (env: Env, objectKey: string) => {
  const encoded = objectKey
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `${cleanBaseUrl(env.PUBLIC_BASE_URL)}/${encoded}`;
};

const inferMimeType = (key: string) => {
  const extension = key.split(".").pop()?.toLowerCase();
  if (extension === "jpg" || extension === "jpeg") return "image/jpeg";
  if (extension === "png") return "image/png";
  if (extension === "webp") return "image/webp";
  if (extension === "gif") return "image/gif";
  if (extension === "avif") return "image/avif";
  return "application/octet-stream";
};

const ensureVariantFolders = async (env: Env, originalKey: string) => {
  await Promise.all(variantFolderKeysFor(originalKey).map((folderKey) =>
    env.MEDIA_BUCKET.put(folderKey, "", {
      httpMetadata: { contentType: "application/x-directory" },
      customMetadata: {
        generatedBy: "personal-site-media-pipeline",
        sourceFolder: originalKey.replace(/\/+$/, ""),
      },
    })
  ));
};

const outputQualityFor = (contentType: string, sourceSize: number) => {
  if (contentType !== "image/gif") return QUALITY;
  return sourceSize >= 6 * 1024 * 1024 ? LARGE_ANIMATED_QUALITY : ANIMATED_QUALITY;
};

const originalFilenameFor = (objectKey: string) => {
  const filename = objectKey.split("/").pop() || "image";
  try {
    return decodeURIComponent(filename);
  } catch {
    return filename;
  }
};

const storageFolderFor = (objectKey: string) => {
  const prefix = objectKey.startsWith("photos/originals/")
    ? "photos/originals/"
    : "originals/";
  return objectKey.slice(prefix.length).split("/").filter(Boolean)[0] || null;
};

const variantObjectKey = (
  originalKey: string,
  variantKey: "800" | "1600",
  sourceEtag: string,
) => {
  const isPhotosPrefix = originalKey.startsWith("photos/originals/");
  const prefixLength = isPhotosPrefix ? "photos/originals/".length : "originals/".length;
  const relative = originalKey.slice(prefixLength);

  const slashIndex = relative.lastIndexOf("/");
  const directory = slashIndex >= 0 ? relative.slice(0, slashIndex) : "";
  const filename = slashIndex >= 0 ? relative.slice(slashIndex + 1) : relative;
  const dotIndex = filename.lastIndexOf(".");
  const stem = dotIndex > 0 ? filename.slice(0, dotIndex) : filename;
  const fingerprint = sourceEtag.replace(/[^a-zA-Z0-9]/g, "").slice(0, 10) || "source";
  const outputName = `${stem}-${fingerprint}.webp`;

  return ["photos/variants", directory, variantKey, outputName].filter(Boolean).join("/");
};

const supabaseHeaders = (env: Env, prefer?: string) => ({
  apikey: env.SUPABASE_SERVICE_ROLE_KEY,
  Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
  "Content-Type": "application/json",
  ...(prefer ? { Prefer: prefer } : {}),
});

const supabaseRequest = async <T>(
  env: Env,
  path: string,
  init: RequestInit = {},
): Promise<T> => {
  const response = await fetch(`${cleanBaseUrl(env.SUPABASE_URL)}/rest/v1/${path}`, {
    ...init,
    headers: {
      ...supabaseHeaders(env),
      ...(init.headers || {}),
    },
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Supabase ${response.status}: ${detail.slice(0, 500)}`);
  }
  if (response.status === 204) return undefined as T;
  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
};

const resolveProjectId = async (env: Env, storageFolder: string | null) => {
  if (!storageFolder) return null;
  const params = new URLSearchParams({
    select: "id",
    storage_folder: `eq.${storageFolder}`,
    limit: "1",
  });
  const rows = await supabaseRequest<Array<{ id: string }>>(
    env,
    `portfolio_projects?${params.toString()}`,
  );
  return rows[0]?.id || null;
};

const upsertAsset = async (
  env: Env,
  record: Record<string, unknown>,
): Promise<MediaAssetRow> => {
  const params = new URLSearchParams({
    on_conflict: "storage_provider,storage_bucket,object_key",
  });
  const rows = await supabaseRequest<MediaAssetRow[]>(
    env,
    `media_assets?${params.toString()}`,
    {
      method: "POST",
      headers: supabaseHeaders(env, "resolution=merge-duplicates,return=representation"),
      body: JSON.stringify(record),
    },
  );
  if (!rows[0]) throw new Error("Supabase did not return the upserted media asset.");
  return rows[0];
};

const updateAsset = async (
  env: Env,
  assetId: string,
  patch: Record<string, unknown>,
) => {
  const params = new URLSearchParams({ id: `eq.${assetId}` });
  await supabaseRequest<void>(env, `media_assets?${params.toString()}`, {
    method: "PATCH",
    headers: supabaseHeaders(env, "return=minimal"),
    body: JSON.stringify(patch),
  });
};

const updateMoodboardItem = async (
  env: Env,
  objectKey: string,
  patch: Record<string, unknown>,
) => {
  const params = new URLSearchParams({
    storage_path: `eq.${env.R2_BUCKET_NAME}/${objectKey}`,
  });
  await supabaseRequest<void>(env, `moodboard_items?${params.toString()}`, {
    method: "PATCH",
    headers: supabaseHeaders(env, "return=minimal"),
    body: JSON.stringify(patch),
  });
};

const listExistingVariants = async (env: Env, assetId: string) => {
  const params = new URLSearchParams({
    select: "variant_key,object_key",
    asset_id: `eq.${assetId}`,
  });
  return supabaseRequest<MediaVariantRow[]>(
    env,
    `media_variants?${params.toString()}`,
  );
};

const upsertVariant = async (
  env: Env,
  record: Record<string, unknown>,
) => {
  const params = new URLSearchParams({ on_conflict: "asset_id,variant_key" });
  await supabaseRequest<void>(env, `media_variants?${params.toString()}`, {
    method: "POST",
    headers: supabaseHeaders(env, "resolution=merge-duplicates,return=minimal"),
    body: JSON.stringify(record),
  });
};

const markIgnored = async (
  env: Env,
  object: R2Object,
  contentType: string,
  reason: string,
) => {
  await upsertAsset(env, {
    storage_provider: "cloudflare_r2",
    storage_bucket: env.R2_BUCKET_NAME,
    object_key: object.key,
    folder_path: object.key.includes("/") ? object.key.slice(0, object.key.lastIndexOf("/")) : "",
    public_url: publicUrlFor(env, object.key),
    original_filename: originalFilenameFor(object.key),
    mime_type: contentType,
    file_size: object.size,
    etag: object.etag,
    processing_status: "ignored",
    processing_error: reason,
    last_processed_at: new Date().toISOString(),
  });
};

const processEvent = async (event: R2Event, env: Env) => {
  const objectKey = event.object?.key || "";
  if (!isOriginalKey(objectKey)) return;
  if (objectKey.endsWith("/")) {
    await ensureVariantFolders(env, objectKey);
    return;
  }

  await ensureVariantFolders(env, objectKey.slice(0, objectKey.lastIndexOf("/") + 1));

  const sourceHead = await env.MEDIA_BUCKET.head(objectKey);
  if (!sourceHead) return;

  const contentType = sourceHead.httpMetadata?.contentType || inferMimeType(objectKey);
  if (!ALLOWED_MIME_TYPES.has(contentType)) {
    await markIgnored(env, sourceHead, contentType, "Unsupported image type.");
    return;
  }
  if (sourceHead.size <= 0 || sourceHead.size > MAX_IMAGE_SIZE_BYTES) {
    await markIgnored(env, sourceHead, contentType, "Image is empty or exceeds the 20 MB limit.");
    return;
  }

  const sourceForInfo = await env.MEDIA_BUCKET.get(objectKey);
  if (!sourceForInfo?.body) throw new Error(`Could not read ${objectKey} from R2.`);
  const info = await env.IMAGES.info(sourceForInfo.body);
  if (!("width" in info) || !("height" in info)) {
    throw new Error(`Cloudflare returned unsupported image metadata for ${objectKey}.`);
  }
  const width = Number(info.width || 0);
  const height = Number(info.height || 0);
  if (!width || !height) throw new Error(`Cloudflare could not read dimensions for ${objectKey}.`);

  const storageFolder = storageFolderFor(objectKey);
  const originProjectId = await resolveProjectId(env, storageFolder);
  const transformVersion = Number(env.TRANSFORM_VERSION || 1);
  const palette = isMoodboardKey(objectKey)
    ? await extractMoodboardPalette(env, objectKey)
    : null;
  const asset = await upsertAsset(env, {
    storage_provider: "cloudflare_r2",
    storage_bucket: env.R2_BUCKET_NAME,
    object_key: objectKey,
    folder_path: objectKey.slice(0, objectKey.lastIndexOf("/")),
    public_url: publicUrlFor(env, objectKey),
    original_filename: originalFilenameFor(objectKey),
    mime_type: contentType,
    file_size: sourceHead.size,
    width,
    height,
    etag: sourceHead.etag,
    origin_project_id: originProjectId,
    processing_status: "processing",
    processing_error: null,
    transform_version: transformVersion,
    metadata: {
      cacheControl: sourceHead.httpMetadata?.cacheControl || null,
      source: "r2-event",
      storageFolder,
      ...(palette ? { palette } : {}),
    },
  });

  const existingVariants = await listExistingVariants(env, asset.id);
  const existingByKey = new Map(existingVariants.map((variant) => [variant.variant_key, variant]));
  const targets: Array<{ key: "800" | "1600"; width: 800 | 1600 }> = [
    { key: "800", width: 800 },
    { key: "1600", width: 1600 },
  ];

  for (const target of targets) {
    const source = await env.MEDIA_BUCKET.get(objectKey);
    if (!source?.body) throw new Error(`Could not reread ${objectKey} for ${target.key}.`);
    const shouldSharpen = width > target.width;
    let transform = env.IMAGES.input(source.body).transform({
      width: target.width,
      fit: "scale-down",
      ...(shouldSharpen ? { sharpen: 1 } : {}),
    });
    const animated = contentType === "image/gif";
    const outputQuality = outputQualityFor(contentType, sourceHead.size);
    const transformed = await transform.output({
      format: "image/webp",
      quality: outputQuality,
      anim: animated,
    });
    const response = transformed.response();
    if (!response.ok) {
      throw new Error(`Cloudflare transform ${target.key} failed with ${response.status}.`);
    }
    const output = await response.arrayBuffer();
    if (!output.byteLength) throw new Error(`Cloudflare transform ${target.key} was empty.`);

    const actualWidth = Math.min(width, target.width);
    const actualHeight = Math.max(1, Math.round((height * actualWidth) / width));
    const outputKey = variantObjectKey(objectKey, target.key, sourceHead.etag);
    const stored = await env.MEDIA_BUCKET.put(outputKey, output, {
      httpMetadata: {
        contentType: "image/webp",
        cacheControl: CACHE_CONTROL,
      },
      customMetadata: {
        generatedBy: "personal-site-media-pipeline",
        sourceKey: objectKey,
        sourceEtag: sourceHead.etag,
        transformVersion: String(transformVersion),
        variantKey: target.key,
        targetWidth: String(target.width),
        actualWidth: String(actualWidth),
        actualHeight: String(actualHeight),
      },
    });
    if (!stored) throw new Error(`Could not store ${outputKey}.`);

    await upsertVariant(env, {
      asset_id: asset.id,
      variant_key: target.key,
      target_width: target.width,
      actual_width: actualWidth,
      actual_height: actualHeight,
      object_key: outputKey,
      public_url: publicUrlFor(env, outputKey),
      mime_type: "image/webp",
      file_size: output.byteLength,
      etag: stored.etag,
      quality: outputQuality,
      animated,
      source_etag: sourceHead.etag,
      transform_version: transformVersion,
      metadata: {
        generatedBy: "personal-site-media-pipeline",
        sourceMimeType: contentType,
        animationPreserved: animated,
      },
    });

    const previous = existingByKey.get(target.key);
    if (previous?.object_key && previous.object_key !== outputKey) {
      await env.MEDIA_BUCKET.delete(previous.object_key);
    }
  }

  const targetKeys = new Set(targets.map((target) => target.key));
  for (const previous of existingVariants) {
    if (!targetKeys.has(previous.variant_key)) {
      await env.MEDIA_BUCKET.delete(previous.object_key);
      const params = new URLSearchParams({
        asset_id: `eq.${asset.id}`,
        variant_key: `eq.${previous.variant_key}`,
      });
      await supabaseRequest<void>(env, `media_variants?${params.toString()}`, {
        method: "DELETE",
        headers: supabaseHeaders(env, "return=minimal"),
      });
    }
  }

  await updateAsset(env, asset.id, {
    processing_status: "ready",
    processing_error: null,
    ready_at: new Date().toISOString(),
    last_processed_at: new Date().toISOString(),
  });
  if (palette) {
    await updateMoodboardItem(env, objectKey, {
      image_width: width,
      image_height: height,
      palette,
    });
  }
};

export default {
  async queue(batch: MessageBatch<R2Event>, env: Env): Promise<void> {
    for (const message of batch.messages) {
      let assetId: string | null = null;
      try {
        await processEvent(message.body, env);
        message.ack();
      } catch (error) {
        const objectKey = message.body.object?.key || "unknown";
        console.error("Media processing failed", objectKey, error);
        try {
          const params = new URLSearchParams({
            select: "id",
            storage_provider: "eq.cloudflare_r2",
            storage_bucket: `eq.${env.R2_BUCKET_NAME}`,
            object_key: `eq.${objectKey}`,
            limit: "1",
          });
          const rows = await supabaseRequest<Array<{ id: string }>>(
            env,
            `media_assets?${params.toString()}`,
          );
          assetId = rows[0]?.id || null;
          if (assetId) {
            await updateAsset(env, assetId, {
              processing_status: "failed",
              processing_error: error instanceof Error ? error.message.slice(0, 1000) : "Unknown processing error",
              last_processed_at: new Date().toISOString(),
            });
          }
        } catch (statusError) {
          console.error("Could not record media failure", statusError);
        }
        message.retry({ delaySeconds: 20 });
      }
    }
  },
} satisfies ExportedHandler<Env, R2Event>;
