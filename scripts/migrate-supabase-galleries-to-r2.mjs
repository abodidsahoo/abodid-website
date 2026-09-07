import { createClient } from '@supabase/supabase-js';
import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import fs from 'fs';

const envText = fs.readFileSync('.env', 'utf8');
const env = {};
for (const line of envText.split('\n')) {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) env[match[1].trim()] = match[2].trim();
}

const envLocalText = fs.existsSync('.env.local') ? fs.readFileSync('.env.local', 'utf8') : '';
for (const line of envLocalText.split('\n')) {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) env[match[1].trim()] = match[2].trim();
}

const supabaseUrl = env.PUBLIC_SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || env.PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Supabase credentials missing.');
  process.exit(1);
}

const account = env.R2_ACCOUNT_ID;
const r2Client = new S3Client({
  region: 'auto', forcePathStyle: true,
  endpoint: `https://${account}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: env.R2_ACCESS_KEY_ID, secretAccessKey: env.R2_SECRET_ACCESS_KEY }
});

const supabaseClient = createClient(supabaseUrl, supabaseKey);

const sanitizeFilename = (name) => {
  if (!name) return `photo-${Date.now()}.jpg`;
  const clean = name.trim().replace(/[^\w\.\-]/g, '-').replace(/-+/g, '-');
  return clean || `photo-${Date.now()}.jpg`;
};

async function existsInR2(key) {
  try {
    await r2Client.send(new HeadObjectCommand({ Bucket: 'assets', Key: key }));
    return true;
  } catch {
    return false;
  }
}

async function fetchWithRetry(url, attempts = 2) {
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
      if (res.ok) return res;
    } catch {
      // Retry once on failure
    }
  }
  return null;
}

async function processItem(slug, item, idx) {
  const imageUrl = typeof item === 'string' ? item : item?.url;
  if (!imageUrl) return { status: 'skipped' };

  let filename = '';
  if (typeof item === 'object' && item?.caption && /\.(jpe?g|png|webp|avif)$/i.test(item.caption)) {
    filename = item.caption;
  } else {
    try {
      const urlPath = new URL(imageUrl).pathname;
      filename = urlPath.split('/').pop() || `image-${idx + 1}.webp`;
    } catch {
      filename = `image-${idx + 1}.webp`;
    }
  }
  filename = sanitizeFilename(filename);

  const r2Key = `photos/originals/${slug}/${filename}`;
  const exists = await existsInR2(r2Key);
  if (exists) return { status: 'exists', key: r2Key };

  const res = await fetchWithRetry(imageUrl);
  if (!res) return { status: 'error', url: imageUrl };

  try {
    const arrayBuf = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuf);
    const contentType = res.headers.get('content-type') || (filename.endsWith('.webp') ? 'image/webp' : 'image/jpeg');

    await r2Client.send(new PutObjectCommand({
      Bucket: 'assets',
      Key: r2Key,
      Body: buffer,
      ContentType: contentType
    }));

    return { status: 'uploaded', key: r2Key };
  } catch (err) {
    return { status: 'error', error: err.message };
  }
}

async function runMigration() {
  console.log('Fetching photography projects from Supabase...');
  const { data: projects, error } = await supabaseClient.from('photography').select('*');
  if (error) {
    console.error('Supabase fetch error:', error);
    process.exit(1);
  }

  console.log(`Found ${projects.length} projects in Supabase.`);

  const tasks = [];
  for (const proj of projects) {
    const slug = proj.slug || 'uncategorized';
    const gallery = Array.isArray(proj.gallery_images) ? proj.gallery_images : [];
    gallery.forEach((item, idx) => {
      tasks.push({ slug, item, idx, projectTitle: proj.title });
    });
  }

  console.log(`Prepared ${tasks.length} gallery image migration tasks.`);

  const CONCURRENCY = 10;
  let uploadedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  for (let i = 0; i < tasks.length; i += CONCURRENCY) {
    const batch = tasks.slice(i, i + CONCURRENCY);
    const results = await Promise.all(batch.map(t => processItem(t.slug, t.item, t.idx)));

    results.forEach(res => {
      if (res.status === 'uploaded') uploadedCount++;
      else if (res.status === 'exists') skippedCount++;
      else if (res.status === 'error') errorCount++;
    });

    console.log(`Progress: ${Math.min(i + CONCURRENCY, tasks.length)}/${tasks.length} (Uploaded: ${uploadedCount}, Existing: ${skippedCount}, Errors: ${errorCount})`);
  }

  console.log(`\nMigration finished! Uploaded: ${uploadedCount}, Existing: ${skippedCount}, Errors: ${errorCount}`);
}

runMigration().catch(console.error);
