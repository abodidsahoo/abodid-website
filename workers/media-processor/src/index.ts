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

const ORIGINAL_PREFIX = "originals/";
const MAX_IMAGE_SIZE_BYTES = 20 * 1024 * 1024;
const CACHE_CONTROL = "public, max-age=31536000, immutable";
const QUALITY = 82;
const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

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
  return "application/octet-stream";
};

const originalFilenameFor = (objectKey: string) => {
  const filename = objectKey.split("/").pop() || "image";
  try {
    return decodeURIComponent(filename);
  } catch {
    return filename;
  }
};

const storageFolderFor = (objectKey: string) =>
  objectKey.slice(ORIGINAL_PREFIX.length).split("/").filter(Boolean)[0] || null;

const variantObjectKey = (
  originalKey: string,
  variantKey: "800" | "1600",
  sourceEtag: string,
) => {
  const relative = originalKey.slice(ORIGINAL_PREFIX.length);
  const slashIndex = relative.lastIndexOf("/");
  const directory = slashIndex >= 0 ? relative.slice(0, slashIndex) : "";
  const filename = slashIndex >= 0 ? relative.slice(slashIndex + 1) : relative;
  const dotIndex = filename.lastIndexOf(".");
  const stem = dotIndex > 0 ? filename.slice(0, dotIndex) : filename;
  const fingerprint = sourceEtag.replace(/[^a-zA-Z0-9]/g, "").slice(0, 10) || "source";
  const outputName = `${stem}-${fingerprint}.webp`;
  return ["variants", directory, variantKey, outputName].filter(Boolean).join("/");
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
  if (!objectKey.startsWith(ORIGINAL_PREFIX) || objectKey.endsWith("/")) return;

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
    },
  });

  const existingVariants = await listExistingVariants(env, asset.id);
  const existingByKey = new Map(existingVariants.map((variant) => [variant.variant_key, variant]));
  const targets: Array<{ key: "800" | "1600"; width: 800 | 1600 }> =
    width <= 800
      ? [{ key: "800", width: 800 }]
      : [
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
    const transformed = await transform.output({ format: "image/webp", quality: QUALITY, anim: true });
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
      quality: QUALITY,
      animated: contentType === "image/gif",
      source_etag: sourceHead.etag,
      transform_version: transformVersion,
      metadata: { generatedBy: "personal-site-media-pipeline" },
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
