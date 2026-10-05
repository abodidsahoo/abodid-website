// One-off: upload repo-hosted videos from public/videos to R2 (videos/landing-page/).
import dotenv from "dotenv";
dotenv.config({ path: [".env.local", ".env"] });
import { readFile } from "node:fs/promises";
import { S3Client, PutObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";

const PREFIX = "videos/landing-page";
const files = { "public/videos/cambridge-visual-edit.mp4": "cambridge-visual-edit.mp4" };

const bucket = process.env.R2_BUCKET_NAME || "assets";
const s3 = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT || `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY },
});

for (const [src, dest] of Object.entries(files)) {
  const body = await readFile(src);
  await s3.send(new PutObjectCommand({
    Bucket: bucket, Key: `${PREFIX}/${dest}`, Body: body,
    ContentType: "video/mp4", CacheControl: "public, max-age=31536000, immutable",
  }));
  const head = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: `${PREFIX}/${dest}` }));
  console.log(`uploaded ${src} -> ${PREFIX}/${dest} (local ${body.length}, r2 ${head.ContentLength})`);
}
