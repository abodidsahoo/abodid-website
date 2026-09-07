import fs from "node:fs";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { S3Client, ListObjectsV2Command, CopyObjectCommand, DeleteObjectsCommand } from "@aws-sdk/client-s3";

let env = process.env;
if (fs.existsSync(".env")) {
  env = { ...env, ...dotenv.parse(fs.readFileSync(".env")) };
}
if (fs.existsSync(".env.local")) {
  env = { ...env, ...dotenv.parse(fs.readFileSync(".env.local")) };
}

const supabaseUrl = env.PUBLIC_SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || env.PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const accountId = env.R2_ACCOUNT_ID;
const accessKeyId = env.R2_ACCESS_KEY_ID;
const secretAccessKey = env.R2_SECRET_ACCESS_KEY;
const endpoint = env.R2_ENDPOINT || `https://${accountId}.r2.cloudflarestorage.com`;

const s3 = new S3Client({
  region: "auto",
  endpoint,
  credentials: { accessKeyId, secretAccessKey },
});

async function nestPunctumAndCleanupRoot() {
  console.log("=== STEP 1: NESTING PUNCTUM EXPERIMENT UNDER [photos/originals/] ===");

  let allKeys = [];
  let token = undefined;
  while (true) {
    const res = await s3.send(new ListObjectsV2Command({ Bucket: "assets", ContinuationToken: token }));
    if (res.Contents) allKeys.push(...res.Contents.map(c => c.Key));
    if (!res.IsTruncated) break;
    token = res.NextContinuationToken;
  }

  // 1. Copy punctum-experiment items to photos/
  const punctumKeys = allKeys.filter(k => k.startsWith("originals/punctum-experiment/") || k.startsWith("punctum-experiment/"));
  console.log(`Found ${punctumKeys.length} Punctum items to nest into photos/...`);

  const CONCURRENCY = 25;
  for (let i = 0; i < punctumKeys.length; i += CONCURRENCY) {
    const chunk = punctumKeys.slice(i, i + CONCURRENCY);
    await Promise.all(
      chunk.map(async (oldKey) => {
        let newKey = oldKey;
        if (oldKey.startsWith("originals/punctum-experiment/")) {
          newKey = `photos/${oldKey}`;
        } else if (oldKey.startsWith("punctum-experiment/")) {
          newKey = `photos/originals/${oldKey}`;
        }

        try {
          await s3.send(
            new CopyObjectCommand({
              Bucket: "assets",
              CopySource: `assets/${encodeURIComponent(oldKey)}`,
              Key: newKey,
            })
          );
        } catch (err) {
          console.error(` Error copying ${oldKey}:`, err.message);
        }
      })
    );
    console.log(`Copied ${Math.min(i + CONCURRENCY, punctumKeys.length)} / ${punctumKeys.length}...`);
  }
  console.log("✅ Finished copying Punctum experiment assets into photos/originals/!\n");

  // 2. Delete root-level leftovers (originals/, variants/, punctum-experiment/, assets/)
  console.log("=== STEP 2: CLEANING UP ROOT LEVEL LEFTOVER FOLDERS ===");

  let keysToDelete = [];
  token = undefined;
  while (true) {
    const res = await s3.send(new ListObjectsV2Command({ Bucket: "assets", ContinuationToken: token }));
    if (res.Contents) {
      res.Contents.forEach(c => {
        const k = c.Key;
        if (
          k.startsWith("originals/") ||
          k.startsWith("variants/") ||
          k.startsWith("punctum-experiment/") ||
          k.startsWith("assets/")
        ) {
          keysToDelete.push(k);
        }
      });
    }
    if (!res.IsTruncated) break;
    token = res.NextContinuationToken;
  }

  console.log(`Deleting ${keysToDelete.length} root-level leftover objects...`);
  const BATCH = 500;
  for (let i = 0; i < keysToDelete.length; i += BATCH) {
    const batch = keysToDelete.slice(i, i + BATCH);
    await s3.send(new DeleteObjectsCommand({
      Bucket: "assets",
      Delete: { Objects: batch.map(Key => ({ Key })) }
    }));
  }
  console.log("✅ Root-level leftovers deleted successfully!\n");

  // 3. Rewrite Supabase DB URLs for Punctum generations
  console.log("=== STEP 3: REWRITING PUNCTUM GENERATIONS DATABASE URLS ===");
  const { data: punctumRows } = await supabase.from("punctum_generations").select("*");
  let updatedCount = 0;
  if (punctumRows) {
    for (const row of punctumRows) {
      const updates = {};
      ["generated_image_url", "generated_image_path", "masked_fragment_path", "context_crop_path", "mask_path"].forEach(f => {
        if (row[f] && typeof row[f] === "string" && row[f].includes("https://assets.abodid.com/originals/punctum-experiment/")) {
          updates[f] = row[f].replaceAll(
            "https://assets.abodid.com/originals/punctum-experiment/",
            "https://assets.abodid.com/photos/originals/punctum-experiment/"
          );
        }
      });
      if (Object.keys(updates).length > 0) {
        await supabase.from("punctum_generations").update(updates).eq("id", row.id);
        updatedCount++;
      }
    }
  }
  console.log(`✅ Updated ${updatedCount} rows in [punctum_generations] table to photos/originals/punctum-experiment/!\n`);

  console.log("=== CLEANUP & REORGANIZATION COMPLETE! ===");
}

nestPunctumAndCleanupRoot().catch(err => {
  console.error("Migration error:", err);
  process.exit(1);
});
