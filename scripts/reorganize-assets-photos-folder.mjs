import fs from "node:fs";
import dotenv from "dotenv";
import { S3Client, ListObjectsV2Command, CopyObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

let env = process.env;
if (fs.existsSync(".env")) {
  env = { ...env, ...dotenv.parse(fs.readFileSync(".env")) };
}
if (fs.existsSync(".env.local")) {
  env = { ...env, ...dotenv.parse(fs.readFileSync(".env.local")) };
}

const accountId = env.R2_ACCOUNT_ID;
const accessKeyId = env.R2_ACCESS_KEY_ID;
const secretAccessKey = env.R2_SECRET_ACCESS_KEY;
const endpoint = env.R2_ENDPOINT || `https://${accountId}.r2.cloudflarestorage.com`;

const s3 = new S3Client({
  region: "auto",
  endpoint,
  credentials: { accessKeyId, secretAccessKey },
});

async function reorganizePhotosInAssetsBucket() {
  console.log("=== REORGANIZING PHOTOGRAPHY ASSETS INTO [photos/] SUBFOLDER ===");

  let allKeys = [];
  let token = undefined;

  while (true) {
    const res = await s3.send(new ListObjectsV2Command({ Bucket: "assets", ContinuationToken: token }));
    if (res.Contents) allKeys.push(...res.Contents.map(c => c.Key));
    if (!res.IsTruncated) break;
    token = res.NextContinuationToken;
  }

  // Filter keys starting with originals/ or variants/ (excluding punctum-experiment)
  const photoKeys = allKeys.filter(key => {
    if (key.startsWith("originals/punctum-experiment/")) return false;
    if (key.startsWith("variants/punctum-experiment/")) return false;
    if (key.startsWith("originals/")) return true;
    if (key.startsWith("variants/")) return true;
    return false;
  });

  console.log(`Found ${photoKeys.length} photography objects to reorganize into photos/...`);

  const BATCH_SIZE = 25;
  let copied = 0;

  for (let i = 0; i < photoKeys.length; i += BATCH_SIZE) {
    const batch = photoKeys.slice(i, i + BATCH_SIZE);
    await Promise.all(batch.map(async (oldKey) => {
      const newKey = `photos/${oldKey}`;
      try {
        await s3.send(new CopyObjectCommand({
          Bucket: "assets",
          CopySource: `assets/${encodeURIComponent(oldKey)}`,
          Key: newKey,
        }));
        copied++;
      } catch (err) {
        console.error(` Error copying ${oldKey}:`, err.message);
      }
    }));
    console.log(` Progress: ${copied}/${photoKeys.length} objects reorganized into photos/...`);
  }

  console.log(`\n==================================================`);
  console.log(`REORGANIZATION COMPLETE! ${copied} objects are now in https://assets.abodid.com/photos/`);
  console.log(`==================================================\n`);
}

reorganizePhotosInAssetsBucket().catch(err => {
  console.error("Reorganization error:", err);
  process.exit(1);
});
