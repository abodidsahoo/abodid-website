import {
  CopyObjectCommand,
  DeleteObjectsCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  S3Client,
} from '@aws-sdk/client-s3';
import { createClient } from '@supabase/supabase-js';

const OLD_PREFIX = 'photos/instagram/';
const NEW_PREFIX = 'instagram/';
const PAGE_SIZE = 500;
const dryRun = process.argv.includes('--dry-run');

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
const publicBaseUrl = (process.env.R2_PUBLIC_BASE_URL?.trim() || 'https://assets.abodid.com').replace(/\/+$/, '');
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

const newKeyFor = (oldKey) => `${NEW_PREFIX}${oldKey.slice(OLD_PREFIX.length)}`;
const publicUrlFor = (objectKey) => `${publicBaseUrl}/${objectKey
  .split('/')
  .map(encodeURIComponent)
  .join('/')}`;
const copySourceFor = (objectKey) => `${encodeURIComponent(bucket)}/${objectKey
  .split('/')
  .map(encodeURIComponent)
  .join('/')}`;

const listObjects = async (prefix) => {
  const objects = [];
  let continuationToken;
  do {
    const page = await r2.send(new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: prefix,
      ContinuationToken: continuationToken,
    }));
    objects.push(...(page.Contents || []).flatMap((item) => item.Key ? [item.Key] : []));
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

const copyObject = async (oldKey) => {
  const newKey = newKeyFor(oldKey);
  await r2.send(new CopyObjectCommand({
    Bucket: bucket,
    Key: newKey,
    CopySource: copySourceFor(oldKey),
    MetadataDirective: 'COPY',
  }));
  await r2.send(new HeadObjectCommand({ Bucket: bucket, Key: newKey }));
  return newKey;
};

const deleteOldObjects = async (keys) => {
  for (let index = 0; index < keys.length; index += 1_000) {
    const batch = keys.slice(index, index + 1_000);
    const response = await r2.send(new DeleteObjectsCommand({
      Bucket: bucket,
      Delete: { Quiet: false, Objects: batch.map((Key) => ({ Key })) },
    }));
    if (response.Errors?.length) {
      throw new Error(`Could not remove old R2 objects: ${JSON.stringify(response.Errors)}`);
    }
  }
};

const [oldObjects, newObjects] = await Promise.all([
  listObjects(OLD_PREFIX),
  listObjects(NEW_PREFIX),
]);
const oldAssetRows = await loadRows((from, to) => database
  .from('media_assets')
  .select('id,object_key,folder_path,public_url')
  .eq('storage_provider', 'cloudflare_r2')
  .eq('storage_bucket', bucket)
  .like('object_key', `${OLD_PREFIX}%`)
  .order('id')
  .range(from, to));
const newAssetRows = await loadRows((from, to) => database
  .from('media_assets')
  .select('id')
  .eq('storage_provider', 'cloudflare_r2')
  .eq('storage_bucket', bucket)
  .like('object_key', `${NEW_PREFIX}%`)
  .order('id')
  .range(from, to));
const cachedSourceRows = await loadRows((from, to) => database
  .from('media_assets')
  .select('id,metadata')
  .not('metadata->instagramAsset', 'is', null)
  .order('id')
  .range(from, to));
const affectedCachedRows = cachedSourceRows.filter((row) =>
  row.metadata?.instagramAsset?.objectKey?.startsWith(OLD_PREFIX));

console.log(JSON.stringify({
  mode: dryRun ? 'dry-run' : 'migrate',
  oldPrefix: OLD_PREFIX,
  newPrefix: NEW_PREFIX,
  r2Objects: oldObjects.length,
  catalogueRows: oldAssetRows.length,
  cachedSourceRows: affectedCachedRows.length,
  destinationR2Objects: newObjects.length,
  destinationCatalogueRows: newAssetRows.length,
}, null, 2));

if (dryRun) process.exit(0);

const fileObjects = oldObjects.filter((key) => key !== OLD_PREFIX);
for (const oldKey of fileObjects) {
  const newKey = await copyObject(oldKey);
  console.log(`Copied ${oldKey} -> ${newKey}`);
}

for (const row of oldAssetRows) {
  const newKey = newKeyFor(row.object_key);
  const slash = newKey.lastIndexOf('/');
  const { error } = await database
    .from('media_assets')
    .update({
      object_key: newKey,
      folder_path: slash >= 0 ? newKey.slice(0, slash) : '',
      public_url: publicUrlFor(newKey),
    })
    .eq('id', row.id)
    .eq('object_key', row.object_key);
  if (error) throw error;
}

for (const row of affectedCachedRows) {
  const instagramAsset = row.metadata.instagramAsset;
  const newKey = newKeyFor(instagramAsset.objectKey);
  const { error } = await database
    .from('media_assets')
    .update({
      metadata: {
        ...row.metadata,
        instagramAsset: {
          ...instagramAsset,
          objectKey: newKey,
          publicUrl: publicUrlFor(newKey),
        },
      },
    })
    .eq('id', row.id);
  if (error) throw error;
}

await deleteOldObjects(oldObjects);
console.log(`Migration complete. Moved ${fileObjects.length} object(s), updated ${oldAssetRows.length} catalogue row(s), and removed ${OLD_PREFIX}.`);
