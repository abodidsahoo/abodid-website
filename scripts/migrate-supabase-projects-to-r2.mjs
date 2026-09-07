import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

let env = { ...process.env };
if (fs.existsSync(".env")) Object.assign(env, dotenv.parse(fs.readFileSync(".env")));
if (fs.existsSync(".env.local")) Object.assign(env, dotenv.parse(fs.readFileSync(".env.local")));

const supabaseUrl = env.PUBLIC_SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || env.PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const s3 = new S3Client({
  region: "auto",
  endpoint: env.R2_ENDPOINT || `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: env.R2_ACCESS_KEY_ID, secretAccessKey: env.R2_SECRET_ACCESS_KEY },
});

function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[\s\W_]+|-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function listAllFiles(bucket, dirPath = "") {
  const { data, error } = await supabase.storage.from(bucket).list(dirPath, { limit: 1000 });
  if (error || !data) return [];
  let results = [];
  for (const item of data) {
    const fullPath = dirPath ? `${dirPath}/${item.name}` : item.name;
    if (item.id === null) {
      const sub = await listAllFiles(bucket, fullPath);
      results.push(...sub);
    } else {
      results.push({ name: item.name, path: fullPath });
    }
  }
  return results;
}

async function migrateSupabaseProjectsToR2() {
  console.log("=== MIGRATING SUPABASE PHOTOGRAPHY BUCKETS TO R2 photos/originals/[project-slug]/ ===");

  const portfoliosData = JSON.parse(fs.readFileSync("src/data/photographyPortfolios.generated.json", "utf-8"));
  const stories = portfoliosData.stories || [];

  console.log(`Scanning Supabase 'photography' storage bucket...`);
  const allFiles = await listAllFiles("photography");
  console.log(`Found ${allFiles.length} files in Supabase 'photography' bucket.`);

  // Map each file to a story slug
  const tasks = [];

  for (const file of allFiles) {
    const filePath = file.path;
    const filename = path.basename(filePath);

    // Determine project slug based on matching story or filename keywords
    let matchedSlug = "misc";

    for (const story of stories) {
      const slug = slugify(story.title || story.slug);
      const keywords = slug.split("-").filter(k => k.length > 3);

      if (filePath.toLowerCase().includes(slug) || filename.toLowerCase().includes(slug)) {
        matchedSlug = slug;
        break;
      }

      const matchCount = keywords.filter(kw => filename.toLowerCase().includes(kw)).length;
      if (matchCount >= 2) {
        matchedSlug = slug;
        break;
      }
    }

    // If still unmatched, try matching known prefix patterns
    if (matchedSlug === "misc") {
      if (filename.includes("outernet")) matchedSlug = "outernet-london-2025";
      else if (filename.includes("into-the-flux")) matchedSlug = "into-the-flux";
      else if (filename.includes("ting")) matchedSlug = "yu-ting-blinded-in-london-overground";
      else if (filename.includes("breathe-variations")) matchedSlug = "breathe-variations-london-exhibition";
      else if (filename.includes("hidden-exhibition")) matchedSlug = "rca-gradshow-in-london";
      else if (filename.includes("digital-direction")) matchedSlug = "digital-direction-rca-gradshow-in-white-city";
      else if (filename.includes("truman-brewery")) matchedSlug = "rca-gradshow-in-london";
    }

    const r2Key = `photos/originals/${matchedSlug}/${filename}`;
    tasks.push({ filePath, r2Key, matchedSlug });
  }

  // Deduplicate tasks by r2Key
  const uniqueTasks = Array.from(new Map(tasks.map(t => [t.r2Key, t])).values());
  console.log(`Prepared ${uniqueTasks.length} migration tasks across project folders.`);

  // Download & upload concurrently in batches of 15
  const CONCURRENCY = 15;
  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < uniqueTasks.length; i += CONCURRENCY) {
    const chunk = uniqueTasks.slice(i, i + CONCURRENCY);
    await Promise.all(
      chunk.map(async (task) => {
        try {
          const { data: blob, error } = await supabase.storage.from("photography").download(task.filePath);
          if (error || !blob) {
            console.error(`  ✕ Supabase download failed for ${task.filePath}:`, error?.message);
            failCount++;
            return;
          }

          const arrayBuffer = await blob.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          const ext = task.filePath.split(".").pop()?.toLowerCase();
          const mime = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";

          await s3.send(
            new PutObjectCommand({
              Bucket: "assets",
              Key: task.r2Key,
              Body: buffer,
              ContentType: mime,
              CacheControl: "public, max-age=31536000, immutable",
            })
          );
          successCount++;
        } catch (err) {
          console.error(`  ✕ R2 upload failed for ${task.r2Key}:`, err.message);
          failCount++;
        }
      })
    );
    console.log(`Progress: ${Math.min(i + CONCURRENCY, uniqueTasks.length)} / ${uniqueTasks.length} transferred.`);
  }

  console.log(`\n=== MIGRATION COMPLETE! ===`);
  console.log(`Successfully migrated: ${successCount} files`);
  console.log(`Failed: ${failCount} files`);
}

migrateSupabaseProjectsToR2().catch(err => {
  console.error("Migration error:", err);
  process.exit(1);
});
