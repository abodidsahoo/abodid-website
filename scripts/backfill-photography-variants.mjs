import fs from 'node:fs';
import dotenv from 'dotenv';
import sharp from 'sharp';
import { S3Client, PutObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { buildCatalog, isPortfolioKey } from '../src/lib/photography/catalog.mjs';

const env = {
  ...process.env,
  ...(fs.existsSync('.env') ? dotenv.parse(fs.readFileSync('.env')) : {}),
  ...(fs.existsSync('.env.local') ? dotenv.parse(fs.readFileSync('.env.local')) : {}),
};

const accountId = env.R2_ACCOUNT_ID?.match(/[a-f0-9]{32}/i)?.[0];
if (!accountId || !env.R2_ACCESS_KEY_ID || !env.R2_SECRET_ACCESS_KEY) {
  console.error('Missing R2 credentials in environment.');
  process.exit(1);
}

const bucket = env.PHOTOGRAPHY_R2_BUCKET || 'assets';
const client = new S3Client({
  region: 'auto',
  forcePathStyle: true,
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
  },
});

let inventory = [];
if (fs.existsSync('/tmp/photography-audit/inventory.json')) {
  inventory = JSON.parse(fs.readFileSync('/tmp/photography-audit/inventory.json', 'utf8'));
} else if (fs.existsSync('src/data/photographyR2.generated.json')) {
  inventory = JSON.parse(fs.readFileSync('src/data/photographyR2.generated.json', 'utf8'));
}

const originalsMap = new Map(inventory.map(x => [x.key, x]));
const photos = buildCatalog(inventory);

const jobs = photos
  .map(photo => {
    const original = originalsMap.get(photo.key);
    const sizes = [];
    if (photo.small === photo.original || !photo.small.includes('/800/')) sizes.push(800);
    if (photo.large === photo.original || !photo.large.includes('/1600/')) sizes.push(1600);
    return { photo, original, sizes };
  })
  .filter(x => x.sizes.length > 0);

console.log(JSON.stringify({
  totalPhotos: photos.length,
  originalsToBackfill: jobs.length,
  variantsToGenerate: jobs.reduce((sum, j) => sum + j.sizes.length, 0),
  upload: process.argv.includes('--upload')
}, null, 2));

if (!process.argv.includes('--upload')) {
  console.log('\nDry run complete. Pass --upload to execute the backfill.');
  client.destroy();
  process.exit(0);
}

console.log(`\nStarting backfill for ${jobs.length} photos...`);

let cursor = 0;
let completedCount = 0;
const failed = [];
const concurrency = 6;

async function worker(workerId) {
  while (cursor < jobs.length) {
    const jobIndex = cursor++;
    const { photo, original, sizes } = jobs[jobIndex];
    if (!photo || !original) continue;

    const relative = photo.key.slice('photos/originals/'.length);
    const slash = relative.lastIndexOf('/');
    const directory = relative.slice(0, slash);
    const filename = relative.slice(slash + 1);
    const stem = filename.replace(/\.[^.]+$/, '');
    const fingerprint = (original.etag || '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 10);

    let sourceBuffer;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const response = await fetch(photo.original, { signal: AbortSignal.timeout(45000) });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        sourceBuffer = Buffer.from(await response.arrayBuffer());
        break;
      } catch (err) {
        if (attempt === 3) {
          failed.push({ key: photo.key, error: `Fetch failed: ${err.message}` });
        } else {
          await new Promise(r => setTimeout(r, 1000 * attempt));
        }
      }
    }

    if (!sourceBuffer) continue;

    for (const size of sizes) {
      try {
        const key = `photos/variants/${directory}/${size}/${stem}-${fingerprint}.webp`;
        const webpBuffer = await sharp(sourceBuffer)
          .rotate()
          .resize({ width: size, withoutEnlargement: true })
          .webp({ quality: 82, effort: 4 })
          .toBuffer();

        await client.send(new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: webpBuffer,
          ContentType: 'image/webp',
          CacheControl: 'public, max-age=31536000, immutable',
        }));
      } catch (err) {
        failed.push({ key: photo.key, size, error: `Process/upload failed: ${err.message}` });
      }
    }

    completedCount++;
    if (completedCount % 25 === 0 || completedCount === jobs.length) {
      console.log(`[Worker] Progress: ${completedCount}/${jobs.length} (${Math.round((completedCount / jobs.length) * 100)}%)`);
    }
  }
}

await Promise.all(Array.from({ length: concurrency }, (_, i) => worker(i)));

console.log(`\nBackfill upload complete: ${completedCount} processed, ${failed.length} failed.`);

if (failed.length) {
  console.error('Failed items:', failed.slice(0, 10));
}

// Refresh R2 Inventory snapshot
console.log('\nRefreshing R2 inventory snapshot from bucket...');
try {
  const freshObjects = [];
  for (const type of ['originals', 'variants']) {
    let token;
    do {
      const res = await client.send(new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: `photos/${type}/`,
        ContinuationToken: token,
      }));
      freshObjects.push(...(res.Contents || []).filter(x => x.Key).map(x => ({ key: x.Key, etag: x.ETag })));
      token = res.IsTruncated ? res.NextContinuationToken : undefined;
    } while (token);
  }

  const safeObjects = freshObjects.filter(x => isPortfolioKey(x.key) || (x.key.startsWith('photos/variants/') && !/punctum|avatar|landing-page|site-assets|site-graphics|ui-assets/i.test(x.key)));
  fs.writeFileSync('src/data/photographyR2.generated.json', JSON.stringify(safeObjects, null, 2) + '\n');
  if (fs.existsSync('/tmp/photography-audit')) {
    fs.writeFileSync('/tmp/photography-audit/inventory.json', JSON.stringify(freshObjects, null, 2));
  }
  console.log(`Snapshot refreshed! Total objects in catalog inventory: ${safeObjects.length}`);
} catch (err) {
  console.warn('Could not refresh snapshot automatically:', err.message);
}

client.destroy();
