// One-off: move public landing-page videos from Supabase Storage to R2 (videos/landing-page/).
// Source files are NOT deleted, so old URLs keep working until you clean them up manually.
import dotenv from "dotenv";
dotenv.config({ path: [".env.local", ".env"] });
import { S3Client, PutObjectCommand, CopyObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";

const SUPABASE_BASE = "https://jwipqbjxpmgyevfzpjjx.supabase.co/storage/v1/object/public/misc/video-clips";
const PREFIX = "videos/landing-page";
const CACHE_CONTROL = "public, max-age=31536000, immutable";

const fromSupabase = {
  "Obsidian_Timelapse.mp4": "obsidian-timelapse.mp4",
  "audio-spectrum-compressed.mp4": "audio-spectrum.mp4",
  "gesture-image.mp4": "gesture-control.mp4",
  "obsidian-vault-notes-thumbnail-video.mp4": "obsidian-vault-notes-thumbnail.mp4",
  "punctum_thumbnail_video.mp4": "punctum-thumbnail.mp4",
  "sequence-room-comp.mp4": "sequence-room.mp4",
};
const fromR2Root = {
  "videos/showreel-2025-compressed.mp4": "showreel-2025.mp4",
};

const bucket = process.env.R2_BUCKET_NAME || "assets";
const s3 = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT || `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY },
});

for (const [src, dest] of Object.entries(fromSupabase)) {
  const res = await fetch(`${SUPABASE_BASE}/${src}`);
  if (!res.ok) throw new Error(`Download failed ${src}: ${res.status}`);
  const body = Buffer.from(await res.arrayBuffer());
  await s3.send(new PutObjectCommand({
    Bucket: bucket, Key: `${PREFIX}/${dest}`, Body: body,
    ContentType: "video/mp4", CacheControl: CACHE_CONTROL,
  }));
  console.log(`uploaded ${src} -> ${PREFIX}/${dest} (${body.length} bytes)`);
}

for (const [src, dest] of Object.entries(fromR2Root)) {
  await s3.send(new CopyObjectCommand({
    Bucket: bucket, CopySource: `${bucket}/${src}`, Key: `${PREFIX}/${dest}`,
    MetadataDirective: "REPLACE", ContentType: "video/mp4", CacheControl: CACHE_CONTROL,
  }));
  console.log(`copied ${src} -> ${PREFIX}/${dest}`);
}

for (const dest of [...Object.values(fromSupabase), ...Object.values(fromR2Root)]) {
  const head = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: `${PREFIX}/${dest}` }));
  console.log(`verified ${dest}: ${head.ContentLength} bytes`);
}
