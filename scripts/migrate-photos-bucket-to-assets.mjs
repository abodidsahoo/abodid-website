import fs from "node:fs";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { S3Client, ListObjectsV2Command, CopyObjectCommand } from "@aws-sdk/client-s3";

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

async function copyAllObjectsFromPhotosToAssets() {
  console.log("=== STEP 1: PARALLEL COPYING R2 OBJECTS FROM [photos] -> [assets] ===");
  
  let allKeys = [];
  let continuationToken = undefined;

  while (true) {
    const listCmd = new ListObjectsV2Command({
      Bucket: "photos",
      ContinuationToken: continuationToken,
    });
    const res = await s3.send(listCmd);
    if (res.Contents) {
      allKeys.push(...res.Contents.map(c => c.Key));
    }
    if (!res.IsTruncated) break;
    continuationToken = res.NextContinuationToken;
  }

  console.log(`Found ${allKeys.length} objects in [photos] bucket. Copying in parallel...`);

  const BATCH_SIZE = 25;
  let copiedCount = 0;

  for (let i = 0; i < allKeys.length; i += BATCH_SIZE) {
    const batch = allKeys.slice(i, i + BATCH_SIZE);
    await Promise.all(batch.map(async (key) => {
      try {
        await s3.send(new CopyObjectCommand({
          Bucket: "assets",
          CopySource: `photos/${encodeURIComponent(key)}`,
          Key: key,
        }));
        copiedCount++;
      } catch (err) {
        console.error(` ❌ Error copying ${key}:`, err.message);
      }
    }));
    console.log(` Progress: ${copiedCount}/${allKeys.length} objects copied...`);
  }

  console.log(`✅ Successfully copied ${copiedCount} objects to R2 [assets] bucket.\n`);
}

async function updateDatabaseUrls() {
  console.log("=== STEP 2: REWRITING SUPABASE DATABASE IMAGE URLS ===");

  // A. punctum_generations table
  const { data: punctumRows } = await supabase.from("punctum_generations").select("*");
  if (punctumRows) {
    let count = 0;
    for (const row of punctumRows) {
      const updates = {};
      ["generated_image_url", "generated_image_path", "masked_fragment_path", "context_crop_path", "mask_path"].forEach(field => {
        if (row[field] && typeof row[field] === "string" && row[field].includes("photos.abodid.com")) {
          updates[field] = row[field].replaceAll("photos.abodid.com", "assets.abodid.com");
        }
      });
      if (Object.keys(updates).length > 0) {
        await supabase.from("punctum_generations").update(updates).eq("id", row.id);
        count++;
      }
    }
    console.log(` Updated ${count} rows in [punctum_generations] table.`);
  }

  // B. media_assets table if exists
  try {
    const { data: mediaRows } = await supabase.from("media_assets").select("id, public_url");
    if (mediaRows) {
      let mCount = 0;
      for (const m of mediaRows) {
        if (m.public_url && m.public_url.includes("photos.abodid.com")) {
          const newUrl = m.public_url.replaceAll("photos.abodid.com", "assets.abodid.com");
          await supabase.from("media_assets").update({ public_url: newUrl }).eq("id", m.id);
          mCount++;
        }
      }
      console.log(` Updated ${mCount} rows in [media_assets] table.`);
    }
  } catch (e) {}

  // C. media_variants table if exists
  try {
    const { data: variantRows } = await supabase.from("media_variants").select("id, public_url");
    if (variantRows) {
      let vCount = 0;
      for (const v of variantRows) {
        if (v.public_url && v.public_url.includes("photos.abodid.com")) {
          const newUrl = v.public_url.replaceAll("photos.abodid.com", "assets.abodid.com");
          await supabase.from("media_variants").update({ public_url: newUrl }).eq("id", v.id);
          vCount++;
        }
      }
      console.log(` Updated ${vCount} rows in [media_variants] table.`);
    }
  } catch (e) {}

  console.log("✅ Database URL migration complete!\n");
}

async function main() {
  await copyAllObjectsFromPhotosToAssets();
  await updateDatabaseUrls();
  console.log("=== MIGRATION TO ASSETS.ABODID.COM COMPLETE! ===");
}

main().catch(err => {
  console.error("Migration error:", err);
  process.exit(1);
});
