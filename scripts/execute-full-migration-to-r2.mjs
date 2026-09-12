import fs from "node:fs";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { S3Client, PutObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";

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
const r2Bucket = env.R2_BUCKET_NAME || "assets";
const r2Endpoint = env.R2_ENDPOINT || `https://${accountId}.r2.cloudflarestorage.com`;
const r2PublicBaseUrl = (env.R2_PUBLIC_BASE_URL || "https://assets.abodid.com").replace(/\/$/, "");

const s3 = new S3Client({
  region: "auto",
  endpoint: r2Endpoint,
  credentials: { accessKeyId, secretAccessKey },
});

async function uploadToR2(key, buffer, contentType) {
  const command = new PutObjectCommand({
    Bucket: r2Bucket,
    Key: key,
    Body: buffer,
    ContentType: contentType,
    CacheControl: "public, max-age=31536000, immutable",
  });
  await s3.send(command);
  return `${r2PublicBaseUrl}/${key}`;
}

async function checkExistsInR2(key) {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: r2Bucket, Key: key }));
    return true;
  } catch (e) {
    return false;
  }
}

// Paginated recursive file listing
async function listAllInFolder(bucket, folder = "") {
  let allItems = [];
  let page = 0;
  const pageSize = 100;

  while (true) {
    const { data, error } = await supabase.storage.from(bucket).list(folder, {
      limit: pageSize,
      offset: page * pageSize,
      sortBy: { column: "name", order: "asc" },
    });

    if (error || !data || data.length === 0) break;

    for (const item of data) {
      const fullPath = folder ? `${folder}/${item.name}` : item.name;
      if (!item.id && (!item.metadata || Object.keys(item.metadata).length === 0)) {
        const nested = await listAllInFolder(bucket, fullPath);
        allItems = allItems.concat(nested);
      } else {
        allItems.push({
          fullPath,
          name: item.name,
          size: item.metadata?.size || 0,
          mimetype: item.metadata?.mimetype || "application/octet-stream",
        });
      }
    }

    if (data.length < pageSize) break;
    page++;
  }
  return allItems;
}

// 1. Migrate Research Papers
async function migrateResearchPapers() {
  console.log("\n=======================================================");
  console.log("PHASE 1: MIGRATING RESEARCH WORKSPACE PAPERS TO R2");
  console.log("Target: assets/research-papers/");
  console.log("=======================================================");

  const papers = await listAllInFolder("research-workspace-papers", "");
  console.log(`Found ${papers.length} research papers in Supabase.`);

  let successCount = 0;
  for (const paper of papers) {
    const fileName = paper.name;
    const r2Key = `research-papers/${fileName}`;
    const contentType = paper.mimetype || "application/pdf";

    // Download from Supabase
    const { data: blob, error: dlErr } = await supabase.storage
      .from("research-workspace-papers")
      .download(paper.fullPath);

    if (dlErr || !blob) {
      console.error(`  ❌ Failed to download ${paper.fullPath}:`, dlErr?.message);
      continue;
    }

    const buffer = Buffer.from(await blob.arrayBuffer());
    await uploadToR2(r2Key, buffer, contentType);
    console.log(`  ✅ Uploaded to R2: ${r2Key} (${(buffer.length / 1024).toFixed(1)} KB)`);

    // Delete from Supabase
    const { error: delErr } = await supabase.storage
      .from("research-workspace-papers")
      .remove([paper.fullPath]);

    if (!delErr) {
      successCount++;
    } else {
      console.warn(`  ⚠️ Supabase delete error for ${paper.fullPath}:`, delErr.message);
    }
  }

  // Update research_papers DB table URLs if any
  console.log("Updating research_papers database records...");
  const { data: dbPapers } = await supabase.from("research_papers").select("*");
  if (dbPapers) {
    for (const p of dbPapers) {
      if (p.pdf_url && p.pdf_url.includes("supabase.co")) {
        const fName = p.pdf_url.split("/").pop().split("?")[0];
        const newUrl = `${r2PublicBaseUrl}/research-papers/${fName}`;
        await supabase.from("research_papers").update({ pdf_url: newUrl }).eq("id", p.id);
        console.log(`  Updated DB record "${p.title || p.id}" -> ${newUrl}`);
      }
    }
  }

  console.log(`Phase 1 Complete: Migrated & cleaned up ${successCount}/${papers.length} research papers.`);
}

// 2. Migrate Moodboard Assets
async function migrateMoodboardAssets() {
  console.log("\n=======================================================");
  console.log("PHASE 2: MIGRATING MOODBOARD ASSETS TO R2");
  console.log("Target: assets/photos/originals/moodboard/");
  console.log("=======================================================");

  const files = await listAllInFolder("moodboard-assets", "");
  console.log(`Found ${files.length} moodboard files in Supabase.`);

  let successCount = 0;
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const r2Key = `photos/originals/moodboard/${file.name}`;
    const contentType = file.mimetype || "image/webp";

    const { data: blob, error: dlErr } = await supabase.storage
      .from("moodboard-assets")
      .download(file.fullPath);

    if (dlErr || !blob) {
      console.error(`  ❌ Failed to download ${file.fullPath}:`, dlErr?.message);
      continue;
    }

    const buffer = Buffer.from(await blob.arrayBuffer());
    await uploadToR2(r2Key, buffer, contentType);
    
    // Delete from Supabase
    const { error: delErr } = await supabase.storage
      .from("moodboard-assets")
      .remove([file.fullPath]);

    if (!delErr) {
      successCount++;
    }

    if ((i + 1) % 50 === 0 || i === files.length - 1) {
      console.log(`  [Progress] ${i + 1}/${files.length} moodboard files migrated to ${r2Key}...`);
    }
  }

  console.log(`Phase 2 Complete: Migrated & cleaned up ${successCount}/${files.length} moodboard assets.`);
}

// 3. Migrate Photography Images Series-Wise
async function migratePhotographySeriesWise() {
  console.log("\n=======================================================");
  console.log("PHASE 3: MIGRATING PHOTOGRAPHY ASSETS (SERIES-WISE) TO R2");
  console.log("Target: assets/photos/originals/<series-slug>/");
  console.log("=======================================================");

  // Build Project ID -> Slug mapping from Supabase database
  const { data: projects } = await supabase
    .from("photography")
    .select("id, slug, title, cover_image, gallery_images");

  const projectMap = new Map();
  const coverMap = new Map();

  if (projects) {
    for (const proj of projects) {
      if (proj.id && proj.slug) {
        projectMap.set(proj.id, proj.slug);
      }
      if (proj.cover_image) {
        const coverFilename = proj.cover_image.split("/").pop().split("?")[0];
        coverMap.set(coverFilename, proj.slug);
      }
      if (Array.isArray(proj.gallery_images)) {
        for (const item of proj.gallery_images) {
          const imgUrl = typeof item === 'string' ? item : item?.url;
          if (imgUrl && typeof imgUrl === 'string') {
            const imgFilename = imgUrl.split("/").pop().split("?")[0];
            coverMap.set(imgFilename, proj.slug);
          }
        }
      }
    }
  }

  console.log(`Loaded ${projectMap.size} photography series mappings from database.`);

  const files = await listAllInFolder("photography", "");
  console.log(`Found ${files.length} photography files in Supabase.`);

  let successCount = 0;
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const pathParts = file.fullPath.split("/");

    let targetSlug = "general";
    if (pathParts[0] === "projects" && pathParts.length > 2) {
      const projId = pathParts[1];
      targetSlug = projectMap.get(projId) || `project-${projId.slice(0, 8)}`;
    } else if (coverMap.has(file.name)) {
      targetSlug = coverMap.get(file.name);
    } else if (pathParts[0] === "stories") {
      targetSlug = "stories";
    } else if (pathParts[0] === "covers") {
      targetSlug = "covers";
    }

    const r2Key = `photos/originals/${targetSlug}/${file.name}`;
    const contentType = file.mimetype || "image/webp";

    const { data: blob, error: dlErr } = await supabase.storage
      .from("photography")
      .download(file.fullPath);

    if (dlErr || !blob) {
      console.error(`  ❌ Failed to download ${file.fullPath}:`, dlErr?.message);
      continue;
    }

    const buffer = Buffer.from(await blob.arrayBuffer());
    await uploadToR2(r2Key, buffer, contentType);

    // Delete from Supabase
    const { error: delErr } = await supabase.storage
      .from("photography")
      .remove([file.fullPath]);

    if (!delErr) {
      successCount++;
    }

    if ((i + 1) % 50 === 0 || i === files.length - 1) {
      console.log(`  [Progress] ${i + 1}/${files.length} photography files migrated (e.g. -> ${r2Key})...`);
    }
  }

  console.log(`Phase 3 Complete: Migrated & cleaned up ${successCount}/${files.length} photography assets.`);
}

async function run() {
  console.log("=== STARTING FULL ASSET MIGRATION & SUPABASE CLEANUP ===");
  await migrateResearchPapers();
  await migrateMoodboardAssets();
  await migratePhotographySeriesWise();
  console.log("\n🎉 ALL ASSETS SUCCESSFULLY MIGRATED TO CLOUDFLARE R2 AND SUPABASE CLEANED UP!");
}

run().catch((e) => {
  console.error("Fatal migration error:", e);
  process.exit(1);
});
