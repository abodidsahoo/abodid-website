import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { S3Client, ListObjectsV2Command, CopyObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";

let env = { ...process.env };
if (fs.existsSync(".env")) Object.assign(env, dotenv.parse(fs.readFileSync(".env")));
if (fs.existsSync(".env.local")) Object.assign(env, dotenv.parse(fs.readFileSync(".env.local")));

const s3 = new S3Client({
  region: "auto",
  endpoint: env.R2_ENDPOINT || `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: env.R2_ACCESS_KEY_ID, secretAccessKey: env.R2_SECRET_ACCESS_KEY },
});

const projectFolderMap = [
  { prefix: "breathe-variations", folder: "breathe-variations" },
  { prefix: "hidden-exhibition", folder: "hidden-exhibition" },
  { prefix: "into-the-flux", folder: "into-the-flux" },
  { prefix: "rca-2023-ma-print", folder: "ma-print" },
  { prefix: "rca-2023-mres", folder: "mres-exhibition" },
  { prefix: "rca-2023-ting", folder: "ting-collaboration" },
  { prefix: "rca-digital-direction", folder: "digital-direction" },
  { prefix: "rca-grad-show-truman", folder: "truman-brewery" },
  { prefix: "rca-outernet", folder: "outernet" },
];

async function reorganizeProjectFolders() {
  console.log("=== REORGANIZING R2 EXHIBITION PHOTOS INTO DEDICATED PROJECT SUBFOLDERS ===");

  const res = await s3.send(new ListObjectsV2Command({ Bucket: "assets", Prefix: "photos/originals/exhibition-photos/" }));
  const objects = (res.Contents || []).filter(c => c.Key && !c.Key.endsWith("/"));
  console.log(`Found ${objects.length} objects in photos/originals/exhibition-photos/`);

  // Batch copy exhibition images
  const CONCURRENCY = 20;
  for (let i = 0; i < objects.length; i += CONCURRENCY) {
    const chunk = objects.slice(i, i + CONCURRENCY);
    await Promise.all(chunk.map(async obj => {
      const oldKey = obj.Key;
      const filename = path.basename(oldKey);

      let targetFolder = "exhibitions";
      for (const rule of projectFolderMap) {
        if (filename.startsWith(rule.prefix)) {
          targetFolder = rule.folder;
          break;
        }
      }

      const newKey = `photos/originals/${targetFolder}/${filename}`;
      try {
        await s3.send(new CopyObjectCommand({
          Bucket: "assets",
          CopySource: `assets/${encodeURIComponent(oldKey)}`,
          Key: newKey,
        }));
      } catch (err) {
        console.error(` Error copying ${oldKey}:`, err.message);
      }
    }));
  }
  console.log(`✅ Copied all exhibition files into project subfolders!`);

  // Concurrent cover image download from Supabase -> R2
  console.log("\n=== MIGRATING ALL 24 PROJECT COVERS FROM SUPABASE ===");
  const portfoliosData = JSON.parse(fs.readFileSync("src/data/photographyPortfolios.generated.json", "utf-8"));
  const stories = portfoliosData.stories || [];

  for (let i = 0; i < stories.length; i += CONCURRENCY) {
    const chunk = stories.slice(i, i + CONCURRENCY);
    await Promise.all(chunk.map(async story => {
      if (!story.coverImage) return;
      const coverUrl = story.coverImage.replace("/photography/photography/", "/photography/");
      const filename = path.basename(new URL(coverUrl).pathname);
      const targetKey = `photos/originals/${story.slug}/${filename}`;

      try {
        const res = await fetch(coverUrl);
        if (res.ok) {
          const buffer = Buffer.from(await res.arrayBuffer());
          await s3.send(new PutObjectCommand({
            Bucket: "assets",
            Key: targetKey,
            Body: buffer,
            ContentType: res.headers.get("content-type") || "image/webp",
            CacheControl: "public, max-age=31536000, immutable",
          }));
          console.log(` ✓ Saved cover: ${targetKey}`);
        }
      } catch (err) {
        console.error(` Error saving cover ${coverUrl}:`, err.message);
      }
    }));
  }

  console.log("\n=== PROJECT REORGANIZATION COMPLETE! ===");
}

reorganizeProjectFolders().catch(err => {
  console.error("Reorganization error:", err);
  process.exit(1);
});
