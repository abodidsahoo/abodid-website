#!/usr/bin/env node

import dotenv from "dotenv";
import {
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

dotenv.config({ path: ".env", quiet: true });
dotenv.config({ path: ".env.local", override: true, quiet: true });

const APPLY = process.argv.includes("--apply");
const CONCURRENCY = Math.max(1, Math.min(10, Number(process.argv.find((arg) => arg.startsWith("--concurrency="))?.split("=")[1] || 4)));
const ORIGINAL_PREFIX = "originals/";
const CACHE_CONTROL = "public, max-age=31536000, immutable";
const QUALITY = 82;
const TRANSFORM_VERSION = 1;
const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

const required = (name) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing ${name}.`);
  return value;
};

const supabase = createClient(
  required("PUBLIC_SUPABASE_URL"),
  required("SUPABASE_SERVICE_ROLE_KEY"),
  { auth: { persistSession: false, autoRefreshToken: false } },
);
const accountId = required("R2_ACCOUNT_ID");
const r2 = new S3Client({
  region: "auto",
  endpoint: (process.env.R2_ENDPOINT || `https://${accountId}.r2.cloudflarestorage.com`).replace(/\/$/, ""),
  credentials: {
    accessKeyId: required("R2_ACCESS_KEY_ID"),
    secretAccessKey: required("R2_SECRET_ACCESS_KEY"),
  },
});
const bucket = required("R2_BUCKET_NAME");
const publicBase = required("R2_PUBLIC_BASE_URL").replace(/\/+$/, "");

const publicUrlFor = (key) => `${publicBase}/${key.split("/").map(encodeURIComponent).join("/")}`;
const cleanEtag = (value) => String(value || "").replace(/^"|"$/g, "");
const filenameFor = (key) => key.split("/").pop() || "image";
const mimeFor = (key, fallback = "") => {
  if (ALLOWED_MIME_TYPES.has(fallback)) return fallback;
  const extension = filenameFor(key).split(".").pop()?.toLowerCase();
  if (["jpg", "jpeg"].includes(extension)) return "image/jpeg";
  if (extension === "png") return "image/png";
  if (extension === "webp") return "image/webp";
  if (extension === "gif") return "image/gif";
  return "application/octet-stream";
};

const variantKeyFor = (sourceKey, variantKey, sourceEtag) => {
  const relative = sourceKey.slice(ORIGINAL_PREFIX.length);
  const slashIndex = relative.lastIndexOf("/");
  const directory = slashIndex >= 0 ? relative.slice(0, slashIndex) : "";
  const filename = slashIndex >= 0 ? relative.slice(slashIndex + 1) : relative;
  const dotIndex = filename.lastIndexOf(".");
  const stem = dotIndex > 0 ? filename.slice(0, dotIndex) : filename;
  const fingerprint = cleanEtag(sourceEtag).replace(/[^a-zA-Z0-9]/g, "").slice(0, 10) || "source";
  return ["variants", directory, variantKey, `${stem}-${fingerprint}.webp`].filter(Boolean).join("/");
};

const listOriginals = async () => {
  const objects = [];
  let ContinuationToken;
  do {
    const page = await r2.send(new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: ORIGINAL_PREFIX,
      ContinuationToken,
      MaxKeys: 1000,
    }));
    for (const object of page.Contents || []) {
      if (!object.Key || object.Key.endsWith("/") || !Number(object.Size || 0)) continue;
      if (!ALLOWED_MIME_TYPES.has(mimeFor(object.Key))) continue;
      objects.push({
        key: object.Key,
        size: Number(object.Size || 0),
        etag: cleanEtag(object.ETag),
        lastModified: object.LastModified?.toISOString() || null,
      });
    }
    ContinuationToken = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (ContinuationToken);
  return objects;
};

const mapLimit = async (items, limit, task) => {
  const results = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await task(items[index], index);
    }
  });
  await Promise.all(workers);
  return results;
};

const cloudflareInfo = async (key) => {
  const encodedKey = key.split("/").map(encodeURIComponent).join("/");
  const response = await fetch(`${publicBase}/cdn-cgi/image/format=json,anim=false/${encodedKey}`, {
    headers: { Accept: "application/json" },
  });
  const contentType = response.headers.get("content-type") || "";
  if (response.ok && contentType.includes("application/json")) {
    const info = await response.json();
    if (Number(info.width) && Number(info.height)) {
      return { width: Number(info.width), height: Number(info.height) };
    }
  }

  // A small number of valid JPEGs can bypass Cloudflare's JSON metadata
  // response. Read only those originals from R2 and inspect them locally.
  const original = await r2.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  if (!original.Body) throw new Error(`Could not read metadata fallback for ${key}.`);
  const body = Buffer.from(await original.Body.transformToByteArray());
  const metadata = await sharp(body, { animated: false }).metadata();
  if (!Number(metadata.width) || !Number(metadata.height)) {
    throw new Error(`Missing dimensions for ${key}.`);
  }
  console.warn(`Metadata fallback used for ${key}.`);
  return { width: Number(metadata.width), height: Number(metadata.height) };
};

const cloudflareVariant = async (key, sourceWidth, targetWidth) => {
  const encodedKey = key.split("/").map(encodeURIComponent).join("/");
  const options = [
    `width=${targetWidth}`,
    `quality=${QUALITY}`,
    "format=webp",
    "fit=scale-down",
    "anim=true",
    ...(sourceWidth > targetWidth ? ["sharpen=1"] : []),
  ].join(",");
  const response = await fetch(`${publicBase}/cdn-cgi/image/${options}/${encodedKey}`, {
    headers: { Accept: "image/webp" },
  });
  const contentType = response.headers.get("content-type") || "";
  if (!response.ok || !contentType.startsWith("image/webp")) {
    const detail = await response.text().catch(() => "");
    throw new Error(`WebP ${targetWidth} transform failed for ${key}: ${response.status} ${contentType} ${detail.slice(0, 120)}`);
  }
  const body = Buffer.from(await response.arrayBuffer());
  if (body.length < 12 || body.toString("ascii", 0, 4) !== "RIFF" || body.toString("ascii", 8, 12) !== "WEBP") {
    throw new Error(`Transformation for ${key} did not return a valid WebP binary.`);
  }
  return body;
};

const loadProjects = async () => {
  const { data, error } = await supabase.from("portfolio_projects").select("id,slug,storage_folder");
  if (error) throw error;
  return new Map((data || []).map((project) => [String(project.storage_folder).toLowerCase(), project]));
};

const migrateReferencedSupabaseImages = async (projectsByFolder) => {
  const projectsById = new Map([...projectsByFolder.values()].map((project) => [project.id, project]));
  const { data: revisions, error } = await supabase
    .from("portfolio_project_revisions")
    .select("project_id,cover_url,social_image_url");
  if (error) throw error;

  const candidates = new Map();
  for (const revision of revisions || []) {
    const project = projectsById.get(revision.project_id);
    if (!project) continue;
    for (const [kind, url] of [["covers", revision.cover_url], ["social", revision.social_image_url]]) {
      if (!url || url.startsWith(`${publicBase}/`)) continue;
      if (!url.includes(".supabase.co/storage/v1/object/public/")) continue;
      if (!candidates.has(url)) candidates.set(url, { project, kind, oldUrl: url });
    }
  }
  if (!APPLY) return { count: candidates.size, mappings: new Map() };

  const mappings = new Map();
  for (const candidate of candidates.values()) {
    const sourceUrl = new URL(candidate.oldUrl);
    const sourceFilename = decodeURIComponent(sourceUrl.pathname.split("/").pop() || `${candidate.kind}.jpg`);
    const targetKey = `${ORIGINAL_PREFIX}${candidate.project.storage_folder}/${candidate.kind}/${sourceFilename}`;
    const publicUrl = publicUrlFor(targetKey);
    let exists = false;
    try {
      await r2.send(new HeadObjectCommand({ Bucket: bucket, Key: targetKey }));
      exists = true;
    } catch (headError) {
      const status = headError?.$metadata?.httpStatusCode;
      if (status !== 404 && headError?.name !== "NotFound" && headError?.name !== "NoSuchKey") throw headError;
    }
    if (!exists) {
      const response = await fetch(candidate.oldUrl);
      if (!response.ok) throw new Error(`Could not copy referenced image ${candidate.oldUrl}: ${response.status}`);
      const body = Buffer.from(await response.arrayBuffer());
      const contentType = mimeFor(sourceFilename, response.headers.get("content-type")?.split(";")[0] || "");
      if (!ALLOWED_MIME_TYPES.has(contentType)) throw new Error(`Unsupported referenced image ${candidate.oldUrl}.`);
      await r2.send(new PutObjectCommand({
        Bucket: bucket,
        Key: targetKey,
        Body: body,
        ContentType: contentType,
        CacheControl: CACHE_CONTROL,
        Metadata: { "migration-source": "supabase-public-reference" },
      }));
    }
    mappings.set(candidate.oldUrl, { targetKey, publicUrl });
  }
  return { count: candidates.size, mappings };
};

const migrateLegacyPortfolioOriginals = async (projectsByFolder) => {
  const { data: legacyAssets, error } = await supabase.from("portfolio_media_assets").select("*").order("created_at");
  if (error) throw error;
  if (!APPLY) return { count: legacyAssets.length, mappings: new Map() };

  const mappings = new Map();
  for (const [index, legacy] of legacyAssets.entries()) {
    const project = [...projectsByFolder.values()].find((item) => item.id === legacy.project_id);
    const storageFolder = project?.storage_folder || legacy.storage_path.split("/")[0] || "legacy";
    const sourceFilename = legacy.storage_path.split("/").pop() || legacy.original_filename;
    const targetKey = `${ORIGINAL_PREFIX}${storageFolder}/${sourceFilename}`;
    const publicUrl = publicUrlFor(targetKey);

    const { data: existing, error: existingError } = await supabase
      .from("media_assets")
      .select("id,object_key,processing_status")
      .eq("id", legacy.id)
      .maybeSingle();
    if (existingError) throw existingError;
    if (existing?.object_key === targetKey && existing.processing_status === "ready") {
      mappings.set(legacy.id, { legacy, targetKey, publicUrl });
      process.stdout.write(`\rVerified portfolio originals ${index + 1}/${legacyAssets.length}`);
      continue;
    }

    const { error: seedError } = await supabase.from("media_assets").upsert({
      id: legacy.id,
      storage_provider: "cloudflare_r2",
      storage_bucket: bucket,
      object_key: targetKey,
      folder_path: targetKey.slice(0, targetKey.lastIndexOf("/")),
      public_url: publicUrl,
      original_filename: legacy.original_filename,
      mime_type: legacy.mime_type,
      file_size: legacy.file_size,
      width: legacy.width,
      height: legacy.height,
      alt_text: legacy.alt_text || "",
      caption: legacy.caption || "",
      credit: legacy.credit || "",
      created_by: legacy.created_by,
      origin_project_id: legacy.project_id,
      processing_status: "uploaded",
      transform_version: TRANSFORM_VERSION,
      metadata: {
        migratedFrom: "supabase:portfolio-media",
        legacyStoragePath: legacy.storage_path,
        legacyPublicUrl: legacy.public_url,
        decorative: legacy.decorative,
        focalX: legacy.focal_x,
        focalY: legacy.focal_y,
      },
      created_at: legacy.created_at,
    }, { onConflict: "id" });
    if (seedError) throw seedError;

    const { data: file, error: downloadError } = await supabase.storage.from("portfolio-media").download(legacy.storage_path);
    if (downloadError || !file) throw downloadError || new Error(`Could not download ${legacy.storage_path}.`);
    const body = Buffer.from(await file.arrayBuffer());
    const stored = await r2.send(new PutObjectCommand({
      Bucket: bucket,
      Key: targetKey,
      Body: body,
      ContentType: legacy.mime_type,
      CacheControl: CACHE_CONTROL,
      Metadata: {
        "migration-source": "supabase-portfolio-media",
        "legacy-asset-id": legacy.id,
      },
    }));
    const etag = cleanEtag(stored.ETag);
    const { error: updateError } = await supabase.from("media_assets").update({
      file_size: body.length,
      etag,
      metadata: {
        migratedFrom: "supabase:portfolio-media",
        legacyStoragePath: legacy.storage_path,
        legacyPublicUrl: legacy.public_url,
        decorative: legacy.decorative,
        focalX: legacy.focal_x,
        focalY: legacy.focal_y,
      },
    }).eq("id", legacy.id);
    if (updateError) throw updateError;
    mappings.set(legacy.id, { legacy, targetKey, publicUrl });
    process.stdout.write(`\rCopied portfolio originals ${index + 1}/${legacyAssets.length}`);
  }
  if (legacyAssets.length) process.stdout.write("\n");
  return { count: legacyAssets.length, mappings };
};

const processOriginal = async (object, index, total, projectsByFolder) => {
  const head = await r2.send(new HeadObjectCommand({ Bucket: bucket, Key: object.key }));
  const contentType = mimeFor(object.key, head.ContentType || "");
  const sourceEtag = cleanEtag(head.ETag || object.etag);
  const { data: existing, error: existingError } = await supabase
    .from("media_assets")
    .select("id,width,etag,processing_status,transform_version,media_variants(variant_key,source_etag,transform_version)")
    .eq("storage_provider", "cloudflare_r2")
    .eq("storage_bucket", bucket)
    .eq("object_key", object.key)
    .maybeSingle();
  if (existingError) throw existingError;
  const expectedVariantKeys = Number(existing?.width) > 800 ? ["800", "1600"] : ["800"];
  const existingVariants = existing?.media_variants || [];
  const canResume = existing?.processing_status === "ready"
    && cleanEtag(existing.etag) === sourceEtag
    && Number(existing.transform_version) === TRANSFORM_VERSION
    && expectedVariantKeys.every((variantKey) => existingVariants.some((variant) => (
      variant.variant_key === variantKey
      && cleanEtag(variant.source_etag) === sourceEtag
      && Number(variant.transform_version) === TRANSFORM_VERSION
    )));
  if (canResume) {
    if ((index + 1) % 5 === 0 || index + 1 === total) {
      process.stdout.write(`\rVerified variants ${index + 1}/${total}`);
    }
    return existing.id;
  }

  const info = await cloudflareInfo(object.key);
  const storageFolder = object.key.slice(ORIGINAL_PREFIX.length).split("/")[0]?.toLowerCase() || "";
  const project = projectsByFolder.get(storageFolder) || null;
  const { data: asset, error: assetError } = await supabase.from("media_assets").upsert({
    storage_provider: "cloudflare_r2",
    storage_bucket: bucket,
    object_key: object.key,
    folder_path: object.key.slice(0, object.key.lastIndexOf("/")),
    public_url: publicUrlFor(object.key),
    original_filename: filenameFor(object.key),
    mime_type: contentType,
    file_size: object.size,
    width: info.width,
    height: info.height,
    etag: sourceEtag,
    ...(project ? { origin_project_id: project.id } : {}),
    processing_status: "processing",
    processing_error: null,
    transform_version: TRANSFORM_VERSION,
    metadata: {
      cacheControl: head.CacheControl || null,
      lastModified: head.LastModified?.toISOString() || object.lastModified,
      storageFolder,
      source: "unified-media-backfill",
    },
  }, {
    onConflict: "storage_provider,storage_bucket,object_key",
  }).select("id").single();
  if (assetError) throw assetError;

  const { data: previousVariants, error: previousError } = await supabase
    .from("media_variants")
    .select("variant_key,object_key")
    .eq("asset_id", asset.id);
  if (previousError) throw previousError;
  const targets = info.width <= 800
    ? [{ key: "800", width: 800 }]
    : [{ key: "800", width: 800 }, { key: "1600", width: 1600 }];
  const activeKeys = new Set();
  for (const target of targets) {
    const body = await cloudflareVariant(object.key, info.width, target.width);
    const outputKey = variantKeyFor(object.key, target.key, sourceEtag);
    const stored = await r2.send(new PutObjectCommand({
      Bucket: bucket,
      Key: outputKey,
      Body: body,
      ContentType: "image/webp",
      CacheControl: CACHE_CONTROL,
      Metadata: {
        "generated-by": "personal-site-media-pipeline",
        "source-key": object.key,
        "source-etag": sourceEtag,
        "transform-version": String(TRANSFORM_VERSION),
        "variant-key": target.key,
      },
    }));
    const actualWidth = Math.min(info.width, target.width);
    const actualHeight = Math.max(1, Math.round((info.height * actualWidth) / info.width));
    const { error: variantError } = await supabase.from("media_variants").upsert({
      asset_id: asset.id,
      variant_key: target.key,
      target_width: target.width,
      actual_width: actualWidth,
      actual_height: actualHeight,
      object_key: outputKey,
      public_url: publicUrlFor(outputKey),
      mime_type: "image/webp",
      file_size: body.length,
      etag: cleanEtag(stored.ETag),
      quality: QUALITY,
      animated: contentType === "image/gif",
      source_etag: sourceEtag,
      transform_version: TRANSFORM_VERSION,
      metadata: { generatedBy: "personal-site-media-pipeline" },
    }, { onConflict: "asset_id,variant_key" });
    if (variantError) throw variantError;
    activeKeys.add(target.key);
  }

  const stale = (previousVariants || []).filter((variant) => !activeKeys.has(variant.variant_key));
  if (stale.length) {
    await r2.send(new DeleteObjectsCommand({
      Bucket: bucket,
      Delete: { Objects: stale.map((variant) => ({ Key: variant.object_key })) },
    }));
    const { error: staleError } = await supabase.from("media_variants").delete().eq("asset_id", asset.id).in("variant_key", stale.map((variant) => variant.variant_key));
    if (staleError) throw staleError;
  }
  const { error: readyError } = await supabase.from("media_assets").update({
    processing_status: "ready",
    processing_error: null,
    ready_at: new Date().toISOString(),
    last_processed_at: new Date().toISOString(),
  }).eq("id", asset.id);
  if (readyError) throw readyError;

  if ((index + 1) % 5 === 0 || index + 1 === total) {
    process.stdout.write(`\rGenerated variants ${index + 1}/${total}`);
  }
  return asset.id;
};

const rewritePortfolioReferences = async (legacyMappings, referencedMappings = new Map()) => {
  if (!legacyMappings.size && !referencedMappings.size) return;
  const ids = [...legacyMappings.keys()];
  const { data: variants, error: variantError } = await supabase
    .from("media_variants")
    .select("asset_id,variant_key,target_width,actual_width,actual_height,public_url,file_size,mime_type")
    .in("asset_id", ids);
  if (variantError) throw variantError;
  const variantsByAsset = new Map();
  for (const variant of variants || []) {
    if (!variantsByAsset.has(variant.asset_id)) variantsByAsset.set(variant.asset_id, {});
    variantsByAsset.get(variant.asset_id)[variant.variant_key] = {
      key: variant.variant_key,
      url: variant.public_url,
      width: variant.actual_width,
      height: variant.actual_height,
      targetWidth: variant.target_width,
      fileSize: variant.file_size,
      mimeType: variant.mime_type,
    };
  }

  const { data: revisions, error: revisionError } = await supabase
    .from("portfolio_project_revisions")
    .select("id,cover_url,social_image_url");
  if (revisionError) throw revisionError;
  const referencedKeys = [...referencedMappings.values()].map((mapping) => mapping.targetKey);
  let referencedAssets = [];
  if (referencedKeys.length) {
    const { data, error } = await supabase.from("media_assets").select("id,object_key").in("object_key", referencedKeys);
    if (error) throw error;
    referencedAssets = data || [];
  }
  const referencedIds = new Map(referencedAssets.map((asset) => [asset.object_key, asset.id]));
  const mappingByOldUrl = new Map([
    ...[...legacyMappings.entries()].map(([id, value]) => [value.legacy.public_url, { id, ...value }]),
    ...[...referencedMappings.entries()].map(([oldUrl, value]) => [oldUrl, { id: referencedIds.get(value.targetKey), ...value }]),
  ]);
  for (const revision of revisions || []) {
    const cover = mappingByOldUrl.get(revision.cover_url);
    const social = mappingByOldUrl.get(revision.social_image_url);
    if (!cover && !social) continue;
    const patch = {};
    if (cover) {
      patch.cover_url = cover.publicUrl;
      patch.cover_media_id = cover.id;
    }
    if (social) {
      patch.social_image_url = social.publicUrl;
      patch.social_image_media_id = social.id;
    }
    const { error } = await supabase.from("portfolio_project_revisions").update(patch).eq("id", revision.id);
    if (error) throw error;
  }

  const { data: blocks, error: blockError } = await supabase
    .from("portfolio_project_blocks")
    .select("id,content_jsonb");
  if (blockError) throw blockError;
  for (const block of blocks || []) {
    const media = block.content_jsonb?.media;
    if (!media) continue;
    let changed = false;
    const rewrite = (item) => {
      if (!item?.id || !legacyMappings.has(item.id)) return item;
      const mapping = legacyMappings.get(item.id);
      changed = true;
      return {
        ...item,
        url: mapping.publicUrl,
        originalUrl: mapping.publicUrl,
        storagePath: mapping.targetKey,
        variants: variantsByAsset.get(item.id) || {},
        processingStatus: "ready",
      };
    };
    const nextMedia = Array.isArray(media) ? media.map(rewrite) : rewrite(media);
    if (!changed) continue;
    const { error } = await supabase.from("portfolio_project_blocks").update({
      content_jsonb: { ...block.content_jsonb, media: nextMedia },
    }).eq("id", block.id);
    if (error) throw error;
  }

  const { error: rebuildError } = await supabase.rpc("media_rebuild_portfolio_usages");
  if (rebuildError) throw rebuildError;
};

const verify = async (expectedOriginals) => {
  const [{ count: assetCount, error: assetError }, { count: readyCount, error: readyError }, { count: variantCount, error: variantError }] = await Promise.all([
    supabase.from("media_assets").select("id", { count: "exact", head: true }).eq("storage_provider", "cloudflare_r2").eq("storage_bucket", bucket).like("object_key", "originals/%"),
    supabase.from("media_assets").select("id", { count: "exact", head: true }).eq("storage_provider", "cloudflare_r2").eq("storage_bucket", bucket).like("object_key", "originals/%").eq("processing_status", "ready"),
    supabase.from("media_variants").select("id", { count: "exact", head: true }),
  ]);
  if (assetError || readyError || variantError) throw assetError || readyError || variantError;
  if (assetCount !== expectedOriginals || readyCount !== expectedOriginals) {
    throw new Error(`Verification failed: expected ${expectedOriginals} ready originals, found ${assetCount} catalogued and ${readyCount} ready.`);
  }
  return { assetCount, readyCount, variantCount };
};

const main = async () => {
  const projectsByFolder = await loadProjects();
  const initialOriginals = await listOriginals();
  const portfolioMigration = await migrateLegacyPortfolioOriginals(projectsByFolder);
  const referencedMigration = await migrateReferencedSupabaseImages(projectsByFolder);
  const { count: legacyCount } = portfolioMigration;
  console.log(`${APPLY ? "Migration" : "Dry run"}: ${initialOriginals.length} R2 originals + ${legacyCount} legacy portfolio originals + ${referencedMigration.count} referenced Supabase images.`);
  if (!APPLY) {
    console.log(`Run with --apply --concurrency=${CONCURRENCY} after the Supabase migration is deployed.`);
    return;
  }

  const { mappings } = portfolioMigration;
  const originals = await listOriginals();
  const failures = [];
  await mapLimit(originals, CONCURRENCY, async (object, index) => {
    try {
      return await processOriginal(object, index, originals.length, projectsByFolder);
    } catch (error) {
      failures.push({ key: object.key, error: error.message || String(error) });
      console.error(`\nFailed ${object.key}:`, error.message || error);
      return null;
    }
  });
  process.stdout.write("\n");
  if (failures.length) {
    console.error(JSON.stringify({ failures }, null, 2));
    throw new Error(`${failures.length} originals failed; legacy references and cleanup were not changed.`);
  }

  await rewritePortfolioReferences(mappings, referencedMigration.mappings);
  const verified = await verify(originals.length);
  console.log(JSON.stringify({
    migratedLegacyOriginals: mappings.size,
    ...verified,
    retainedLegacyBucket: true,
  }, null, 2));
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
