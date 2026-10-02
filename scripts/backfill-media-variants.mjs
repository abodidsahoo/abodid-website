import { spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { createClient } from '@supabase/supabase-js';
import ffmpegPath from 'ffmpeg-static';
import sharp from 'sharp';

const ORIGINALS_PREFIX = 'photos/originals/';
const VARIANTS_PREFIX = 'photos/variants/';
const VARIANT_WIDTHS = [800, 1600];
const TRANSFORM_VERSION = 2;
const PAGE_SIZE = 500;
const CACHE_CONTROL = 'public, max-age=31536000, immutable';
const dryRun = process.argv.includes('--dry-run');
const onlyGifs = process.argv.includes('--only-gifs');
const prefixArgument = process.argv.find((argument) => argument.startsWith('--prefix='));
const requestedPrefix = prefixArgument?.slice('--prefix='.length).replace(/^\/+|\/+$/g, '');
const scanPrefix = requestedPrefix ? `${requestedPrefix}/` : ORIGINALS_PREFIX;
if (!scanPrefix.startsWith(ORIGINALS_PREFIX) || scanPrefix.includes('..')) {
  throw new Error(`--prefix must stay inside ${ORIGINALS_PREFIX}`);
}
const relativeScanPrefix = scanPrefix.slice(ORIGINALS_PREFIX.length);
const variantsScanPrefix = `${VARIANTS_PREFIX}${relativeScanPrefix}`;
const concurrencyArgument = process.argv.find((argument) => argument.startsWith('--concurrency='));
const requestedConcurrency = Number(concurrencyArgument?.slice('--concurrency='.length) || 3);
const concurrency = Number.isSafeInteger(requestedConcurrency) && requestedConcurrency >= 1 && requestedConcurrency <= 8
  ? requestedConcurrency
  : 3;

const MIME_TYPES = new Map([
  ['avif', 'image/avif'],
  ['gif', 'image/gif'],
  ['jpeg', 'image/jpeg'],
  ['jpg', 'image/jpeg'],
  ['png', 'image/png'],
  ['webp', 'image/webp'],
]);

const required = (name) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing ${name}.`);
  return value;
};

const accountId = process.env.R2_ACCOUNT_ID?.trim() || '';
const endpoint = (process.env.R2_ENDPOINT?.trim()
  || (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : '')).replace(/\/+$/, '');
if (!endpoint) throw new Error('Missing R2_ENDPOINT or R2_ACCOUNT_ID.');

const bucket = process.env.R2_BUCKET_NAME?.trim() || 'assets';
const configuredPublicBaseUrl = (process.env.R2_PUBLIC_BASE_URL?.trim()
  || 'https://assets.abodid.com').replace(/\/+$/, '');
const publicBaseUrl = (() => {
  try {
    const host = new URL(configuredPublicBaseUrl).hostname;
    if (host === 'photos.abodid.com' || host === 'assets.abodid.com') return 'https://assets.abodid.com';
  } catch {
    throw new Error('R2_PUBLIC_BASE_URL is not a valid URL.');
  }
  return configuredPublicBaseUrl;
})();

const r2 = new S3Client({
  region: 'auto',
  endpoint,
  credentials: {
    accessKeyId: required('R2_ACCESS_KEY_ID'),
    secretAccessKey: required('R2_SECRET_ACCESS_KEY'),
  },
});
const database = createClient(
  required('PUBLIC_SUPABASE_URL'),
  required('SUPABASE_SERVICE_ROLE_KEY'),
  { auth: { persistSession: false, autoRefreshToken: false } },
);

const publicUrlFor = (objectKey) => `${publicBaseUrl}/${objectKey
  .split('/')
  .map(encodeURIComponent)
  .join('/')}`;
const cleanEtag = (value) => value?.replace(/^"|"$/g, '') || null;
const mimeTypeFor = (objectKey) => MIME_TYPES.get(objectKey.split('.').pop()?.toLowerCase() || '') || null;
const errorMessage = (error) => {
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object') {
    return [error.message, error.details, error.hint, error.code].filter(Boolean).join(' · ')
      || JSON.stringify(error);
  }
  return String(error);
};

const animatedWebpQuality = (sourceSize, frameCount) => {
  if (sourceSize >= 12 * 1024 * 1024 || frameCount >= 120) return 68;
  if (sourceSize >= 6 * 1024 * 1024 || frameCount >= 60) return 72;
  return 76;
};

const listObjects = async (prefix) => {
  const objects = [];
  let continuationToken;
  do {
    const page = await r2.send(new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: prefix,
      ContinuationToken: continuationToken,
    }));
    objects.push(...(page.Contents || []).flatMap((item) => item.Key && !item.Key.endsWith('/')
      ? [{
          objectKey: item.Key,
          fileSize: Number(item.Size || 0),
          etag: cleanEtag(item.ETag),
          lastModified: item.LastModified?.toISOString() || null,
        }]
      : []));
    continuationToken = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (continuationToken);
  return objects;
};

const loadRows = async (queryPage) => {
  const rows = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await queryPage(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < PAGE_SIZE) return rows;
  }
};

const getObjectBytes = async (objectKey) => {
  const response = await r2.send(new GetObjectCommand({ Bucket: bucket, Key: objectKey }));
  if (!response.Body) throw new Error(`R2 returned an empty body for ${objectKey}.`);
  return new Uint8Array(await response.Body.transformToByteArray());
};

const runFfmpeg = (args) => new Promise((resolve, reject) => {
  if (!ffmpegPath) return reject(new Error('FFmpeg is unavailable for fallback image decoding.'));
  const process = spawn(ffmpegPath, args, { stdio: ['ignore', 'ignore', 'pipe'] });
  let diagnostics = '';
  process.stderr.on('data', (chunk) => { diagnostics = `${diagnostics}${chunk}`.slice(-8_000); });
  process.once('error', reject);
  process.once('close', (code) => code === 0
    ? resolve()
    : reject(new Error(diagnostics.trim() || `FFmpeg image decoding failed (${code}).`)));
});

const decodeSource = async (sourceBytes, objectKey) => {
  const isGif = /\.gif$/i.test(objectKey);
  try {
    const imageInfo = await sharp(sourceBytes, isGif ? { animated: true } : undefined).metadata();
    if (!/\.avif$/i.test(objectKey)) return { processingBytes: sourceBytes, imageInfo };
    const processingBytes = new Uint8Array(await sharp(sourceBytes).rotate().png().toBuffer());
    return { processingBytes, imageInfo };
  } catch (sharpError) {
    if (isGif) {
      throw new Error(`Sharp could not decode this GIF without losing animation (${errorMessage(sharpError)}).`);
    }
    const workDirectory = join(tmpdir(), `media-variant-${randomUUID()}`);
    await mkdir(workDirectory, { recursive: true });
    const extension = objectKey.match(/\.[a-z0-9]+$/i)?.[0] || '.image';
    const inputPath = join(workDirectory, `source${extension}`);
    const outputPath = join(workDirectory, 'decoded.png');
    try {
      await writeFile(inputPath, sourceBytes);
      await runFfmpeg(['-y', '-i', inputPath, '-frames:v', '1', outputPath]);
      const processingBytes = new Uint8Array(await readFile(outputPath));
      return { processingBytes, imageInfo: await sharp(processingBytes).metadata() };
    } catch (fallbackError) {
      throw new Error(`Sharp could not decode this image (${errorMessage(sharpError)}); FFmpeg fallback also failed (${errorMessage(fallbackError)}).`);
    } finally {
      await rm(workDirectory, { recursive: true, force: true }).catch(() => undefined);
    }
  }
};

const variantKeyFor = (originalKey, width, fingerprint) => {
  const relativePath = originalKey.slice(ORIGINALS_PREFIX.length);
  const slash = relativePath.lastIndexOf('/');
  const directory = slash >= 0 ? relativePath.slice(0, slash) : '';
  const filename = slash >= 0 ? relativePath.slice(slash + 1) : relativePath;
  const stem = filename.replace(/\.[^.]+$/, '');
  return `${VARIANTS_PREFIX}${directory ? `${directory}/` : ''}${width}/${stem}-${fingerprint}.webp`;
};

const reusableVariantFor = (original, width, variantsByObjectKey) => {
  if (/\.gif$/i.test(original.objectKey)) return null;
  const relativePath = original.objectKey.slice(ORIGINALS_PREFIX.length);
  const slash = relativePath.lastIndexOf('/');
  const directory = slash >= 0 ? relativePath.slice(0, slash) : '';
  const filename = slash >= 0 ? relativePath.slice(slash + 1) : relativePath;
  const stem = filename.replace(/\.[^.]+$/, '');
  const prefix = `${VARIANTS_PREFIX}${directory ? `${directory}/` : ''}${width}/${stem}`;
  const legacyFingerprint = (original.etag || '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 10);
  const candidates = [
    ...(legacyFingerprint ? [`${prefix}-${legacyFingerprint}.webp`] : []),
    `${prefix}.webp`,
  ];
  return candidates.map((key) => variantsByObjectKey.get(key)).find(Boolean) || null;
};

const catalogueOriginal = async ({ object, mimeType, imageInfo = null }) => {
  const slash = object.objectKey.lastIndexOf('/');
  const folderPath = object.objectKey.slice(0, slash);
  const originalFilename = object.objectKey.slice(slash + 1);
  const { data, error } = await database
    .from('media_assets')
    .upsert({
      storage_provider: 'cloudflare_r2',
      storage_bucket: bucket,
      object_key: object.objectKey,
      folder_path: folderPath,
      public_url: publicUrlFor(object.objectKey),
      original_filename: originalFilename,
      mime_type: mimeType,
      file_size: object.fileSize,
      width: imageInfo?.width || null,
      height: imageInfo?.pageHeight || imageInfo?.height || null,
      etag: object.etag,
      metadata: {
        lastModified: object.lastModified,
        cataloguedBy: 'variant-backfill',
      },
    }, { onConflict: 'storage_provider,storage_bucket,object_key' })
    .select('id,object_key,mime_type,width,height,media_variants(variant_key,object_key)')
    .single();
  if (error) throw error;
  return data;
};

const [originalObjects, variantObjects, catalogueRows] = await Promise.all([
  listObjects(scanPrefix),
  listObjects(variantsScanPrefix),
  loadRows((from, to) => database
    .from('media_assets')
    .select('id,object_key,mime_type,width,height,media_variants(variant_key,object_key,animated,transform_version,mime_type)')
    .eq('storage_provider', 'cloudflare_r2')
    .eq('storage_bucket', bucket)
    .like('object_key', `${scanPrefix}%`)
    .order('id')
    .range(from, to)),
]);

const variantsInR2 = new Set(variantObjects.map((item) => item.objectKey));
const variantsByObjectKey = new Map(variantObjects.map((item) => [item.objectKey, item]));
const catalogueByObjectKey = new Map(catalogueRows.map((row) => [row.object_key, row]));
const processableOriginals = originalObjects.filter((object) => {
  const mimeType = mimeTypeFor(object.objectKey);
  return mimeType && (!onlyGifs || mimeType === 'image/gif');
});
const work = processableOriginals.flatMap((object) => {
  const asset = catalogueByObjectKey.get(object.objectKey);
  const sourceMimeType = mimeTypeFor(object.objectKey);
  const requiresAnimation = sourceMimeType === 'image/gif';
  const variantRows = new Map((asset?.media_variants || []).map((variant) => [Number(variant.variant_key), variant]));
  const reusableVariants = new Map();
  const incompleteWidths = VARIANT_WIDTHS.filter((width) => {
    const variant = variantRows.get(width);
    const isCurrent = variant
      && variantsInR2.has(variant.object_key)
      && (!requiresAnimation || (
        variant.animated === true
        && Number(variant.transform_version || 0) >= TRANSFORM_VERSION
        && variant.mime_type === 'image/webp'
      ));
    if (isCurrent) return false;
    const reusable = reusableVariantFor(object, width, variantsByObjectKey);
    if (reusable) reusableVariants.set(width, reusable);
    return true;
  });
  const missingWidths = incompleteWidths.filter((width) => !reusableVariants.has(width));
  return !asset || incompleteWidths.length
    ? [{ object, asset, incompleteWidths, missingWidths, reusableVariants }]
    : [];
});

console.log(JSON.stringify({
  mode: dryRun ? 'dry-run' : 'backfill',
  prefix: scanPrefix,
  onlyGifs,
  concurrency,
  processableOriginals: processableOriginals.length,
  cataloguedOriginals: catalogueRows.length,
  completeOriginals: processableOriginals.length - work.length,
  originalsNeedingWork: work.length,
  uncataloguedOriginals: work.filter((item) => !item.asset).length,
  existingVariantObjectsNeedingCatalogue: work.reduce((count, item) => count + item.reusableVariants.size, 0),
  missing800pxVariantObjects: work.filter((item) => item.missingWidths.includes(800)).length,
  missing1600pxVariantObjects: work.filter((item) => item.missingWidths.includes(1600)).length,
}, null, 2));

if (dryRun) process.exit(0);

const failures = [];
let catalogued = 0;
let generated = 0;
let linked = 0;
let completed = 0;
let cursor = 0;

const processItem = async (item) => {
  const { object } = item;
  let asset = item.asset;
  let sourceBytes = null;
  let processingBytes = null;
  let imageInfo = null;
  try {
    if (item.missingWidths.length) {
      sourceBytes = await getObjectBytes(object.objectKey);
      ({ processingBytes, imageInfo } = await decodeSource(sourceBytes, object.objectKey));
    }
    asset = asset || await catalogueOriginal({
      object,
      mimeType: mimeTypeFor(object.objectKey),
      imageInfo,
    });
    if (!item.asset) catalogued += 1;

    const variantRows = [];
    for (const width of item.incompleteWidths) {
      const reusable = item.reusableVariants.get(width);
      if (reusable) {
        const bytes = await getObjectBytes(reusable.objectKey);
        const info = await sharp(bytes, { animated: true }).metadata();
        variantRows.push({
          asset_id: asset.id,
          variant_key: String(width),
          target_width: width,
          actual_width: info.width,
          actual_height: info.pageHeight || info.height,
          object_key: reusable.objectKey,
          public_url: publicUrlFor(reusable.objectKey),
          mime_type: 'image/webp',
          file_size: reusable.fileSize,
          etag: reusable.etag,
          quality: 82,
          animated: Number(info.pages || 1) > 1,
          source_etag: object.etag,
          transform_version: TRANSFORM_VERSION,
          metadata: { generatedAutomatically: true, linkedBy: 'variant-backfill' },
        });
        linked += 1;
        continue;
      }

      if (!sourceBytes) {
        sourceBytes = await getObjectBytes(object.objectKey);
        ({ processingBytes, imageInfo } = await decodeSource(sourceBytes, object.objectKey));
      }
      const fingerprint = createHash('sha256').update(sourceBytes).digest('hex').slice(0, 10);
      const frameCount = Math.max(1, Number(imageInfo?.pages || 1));
      const animated = frameCount > 1;
      const quality = animated ? animatedWebpQuality(sourceBytes.byteLength, frameCount) : 82;
      const data = await sharp(processingBytes, animated ? { animated: true } : undefined)
        .rotate()
        .resize({ width, withoutEnlargement: true })
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
      const outputInfo = await sharp(data, { animated: true }).metadata();
      const outputFrameCount = Math.max(1, Number(outputInfo.pages || 1));
      if (animated && outputFrameCount <= 1) {
        throw new Error(`Generated ${width}px variant lost its animation frames.`);
      }
      const variantObjectKey = variantKeyFor(object.objectKey, width, fingerprint);
      const uploaded = await r2.send(new PutObjectCommand({
        Bucket: bucket,
        Key: variantObjectKey,
        Body: data,
        ContentType: 'image/webp',
        CacheControl: CACHE_CONTROL,
      }));
      variantRows.push({
        asset_id: asset.id,
        variant_key: String(width),
        target_width: width,
        actual_width: outputInfo.width,
        actual_height: outputInfo.pageHeight || outputInfo.height,
        object_key: variantObjectKey,
        public_url: publicUrlFor(variantObjectKey),
        mime_type: 'image/webp',
        file_size: data.byteLength,
        etag: cleanEtag(uploaded.ETag),
        quality,
        animated,
        source_etag: fingerprint,
        transform_version: TRANSFORM_VERSION,
        metadata: {
          generatedAutomatically: true,
          generatedBy: 'variant-backfill',
          sourceMimeType: mimeTypeFor(object.objectKey),
          frameCount: outputFrameCount,
        },
      });
      generated += 1;
    }

    if (variantRows.length) {
      const { error } = await database
        .from('media_variants')
        .upsert(variantRows, { onConflict: 'asset_id,variant_key' });
      if (error) throw error;
    }

    const processedAt = new Date().toISOString();
    const { error: assetError } = await database
      .from('media_assets')
      .update({
        width: asset.width || imageInfo?.width || null,
        height: asset.height || imageInfo?.pageHeight || imageInfo?.height || null,
        processing_status: 'ready',
        processing_error: null,
        ready_at: processedAt,
        last_processed_at: processedAt,
      })
      .eq('id', asset.id);
    if (assetError) throw assetError;
  } catch (error) {
    const message = errorMessage(error);
    failures.push({ objectKey: object.objectKey, error: message });
    if (asset?.id) {
      await database
        .from('media_assets')
        .update({
          processing_status: 'failed',
          processing_error: message.slice(0, 1_000),
          last_processed_at: new Date().toISOString(),
        })
        .eq('id', asset.id);
    }
    console.error(`Failed: ${object.objectKey}: ${message}`);
  } finally {
    completed += 1;
    if (completed % 25 === 0 || completed === work.length) {
      console.log(`Progress: ${completed}/${work.length}`);
    }
  }
};

const worker = async () => {
  while (cursor < work.length) {
    const item = work[cursor];
    cursor += 1;
    await processItem(item);
  }
};

await Promise.all(Array.from({ length: concurrency }, () => worker()));

console.log(JSON.stringify({
  checked: processableOriginals.length,
  repairedOriginals: work.length - failures.length,
  cataloguedOriginals: catalogued,
  linkedExistingVariants: linked,
  generatedVariants: generated,
  failures,
}, null, 2));

if (failures.length) process.exitCode = 1;
