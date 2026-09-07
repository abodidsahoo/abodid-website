import fs from "node:fs";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

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
const bucket = env.R2_BUCKET_NAME || "photos";
const endpoint = env.R2_ENDPOINT || `https://${accountId}.r2.cloudflarestorage.com`;
const R2_PUBLIC_BASE_URL = (env.R2_PUBLIC_BASE_URL || "https://assets.abodid.com").replace(/\/$/, "");

const s3 = new S3Client({
  region: "auto",
  endpoint,
  credentials: { accessKeyId, secretAccessKey },
});

async function uploadToR2(key, buffer, contentType = "image/png") {
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: buffer,
    ContentType: contentType,
    CacheControl: "public, max-age=31536000, immutable",
  });
  await s3.send(command);
  return `${R2_PUBLIC_BASE_URL}/${key}`;
}

async function migratePunctumData() {
  console.log("=== STARTING PUNCTUM EXPERIMENT MIGRATION TO CLOUDFLARE R2 ===");

  const { data: generations, error: dbErr } = await supabase
    .from("punctum_generations")
    .select("*");

  if (dbErr) {
    console.error("Failed to query punctum_generations table:", dbErr);
    process.exit(1);
  }

  // Filter only rows that need migration (those with Supabase storage URLs or unmigrated artifacts)
  const rowsToMigrate = generations.filter(row => {
    const isMainImageUnmigrated = row.generated_image_url && row.generated_image_url.includes("supabase.co");
    const isArtifactUnmigrated = 
      (row.masked_fragment_path && !row.masked_fragment_path.includes("photos.abodid.com")) ||
      (row.context_crop_path && !row.context_crop_path.includes("photos.abodid.com")) ||
      (row.mask_path && !row.mask_path.includes("photos.abodid.com"));
    return isMainImageUnmigrated || isArtifactUnmigrated;
  });

  console.log(`Total DB records: ${generations.length}. Records needing migration: ${rowsToMigrate.length}.\n`);

  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < rowsToMigrate.length; i++) {
    const row = rowsToMigrate[i];
    const genId = row.id;

    console.log(`[${i + 1}/${rowsToMigrate.length}] Migrating Generation ${genId}...`);

    let newGeneratedImageUrl = row.generated_image_url;
    let newGeneratedImagePath = row.generated_image_path;
    let newMaskedFragmentPath = row.masked_fragment_path;
    let newContextCropPath = row.context_crop_path;
    let newMaskPath = row.mask_path;

    // A. Process Generated World Image
    if (row.generated_image_path || row.generated_image_url) {
      let pathInBucket = row.generated_image_path;
      if (!pathInBucket && row.generated_image_url) {
        const parts = row.generated_image_url.split("punctum-generated-worlds/");
        if (parts[1]) pathInBucket = parts[1];
      }

      if (pathInBucket && (!row.generated_image_url || row.generated_image_url.includes("supabase.co"))) {
        const { data: blob } = await supabase.storage
          .from("punctum-generated-worlds")
          .download(pathInBucket);

        if (blob) {
          const buffer = Buffer.from(await blob.arrayBuffer());
          const originalKey = `originals/punctum-experiment/generated-worlds/${pathInBucket}`;
          const publicUrl = await uploadToR2(originalKey, buffer, "image/png");

          newGeneratedImageUrl = publicUrl;
          newGeneratedImagePath = originalKey;
          console.log(`  ✅ Generated world -> R2: ${publicUrl}`);
        }
      }
    }

    // B. Process Artifacts (punctum.png, context.png, mask.png)
    const artifactFiles = [
      { field: "masked_fragment_path", file: "punctum.png" },
      { field: "context_crop_path", file: "context.png" },
      { field: "mask_path", file: "mask.png" },
    ];

    for (const item of artifactFiles) {
      const currentVal = row[item.field];
      if (!currentVal || !currentVal.includes("photos.abodid.com")) {
        const artifactPathInBucket = `${genId}/${item.file}`;
        const { data: blob } = await supabase.storage
          .from("punctum-world-artifacts")
          .download(artifactPathInBucket);

        if (blob) {
          const buffer = Buffer.from(await blob.arrayBuffer());
          const originalKey = `originals/punctum-experiment/artifacts/${genId}/${item.file}`;
          const publicUrl = await uploadToR2(originalKey, buffer, "image/png");

          if (item.field === "masked_fragment_path") newMaskedFragmentPath = publicUrl;
          if (item.field === "context_crop_path") newContextCropPath = publicUrl;
          if (item.field === "mask_path") newMaskPath = publicUrl;
          console.log(`  ✅ Artifact (${item.file}) -> R2: ${publicUrl}`);
        }
      }
    }

    // C. Update database row
    const { error: updateErr } = await supabase
      .from("punctum_generations")
      .update({
        generated_image_url: newGeneratedImageUrl,
        generated_image_path: newGeneratedImagePath,
        masked_fragment_path: newMaskedFragmentPath,
        context_crop_path: newContextCropPath,
        mask_path: newMaskPath,
        updated_at: new Date().toISOString(),
      })
      .eq("id", genId);

    if (updateErr) {
      console.error(`  ❌ Failed to update DB for ${genId}:`, updateErr.message);
      errorCount++;
    } else {
      successCount++;
    }
  }

  console.log("\n==================================================");
  console.log(`MIGRATION COMPLETE!`);
  console.log(`Successfully migrated & updated DB for ${successCount} generations.`);
  if (errorCount > 0) console.log(`Encountered errors on ${errorCount} rows.`);
  console.log("==================================================\n");
}

migratePunctumData().catch(err => {
  console.error("Migration error:", err);
  process.exit(1);
});
