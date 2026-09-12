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

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in .env / .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const accountId = env.R2_ACCOUNT_ID;
const accessKeyId = env.R2_ACCESS_KEY_ID;
const secretAccessKey = env.R2_SECRET_ACCESS_KEY;
const r2Bucket = env.R2_BUCKET_NAME || "assets";
const r2Endpoint = env.R2_ENDPOINT || `https://${accountId}.r2.cloudflarestorage.com`;
const r2PublicBaseUrl = (env.R2_PUBLIC_BASE_URL || "https://assets.abodid.com").replace(/\/$/, "");

if (!accountId || !accessKeyId || !secretAccessKey) {
  console.error("Missing Cloudflare R2 credentials (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY)");
  process.exit(1);
}

const s3 = new S3Client({
  region: "auto",
  endpoint: r2Endpoint,
  credentials: { accessKeyId, secretAccessKey },
});

async function uploadToR2(key, buffer, contentType = "application/pdf") {
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

async function migratePapers() {
  console.log("=== MIGRATING RESEARCH PAPERS FROM SUPABASE TO CLOUDFLARE R2 ===");
  console.log(`Target R2 Bucket: ${r2Bucket}`);
  console.log(`Target R2 Folder: research-papers/`);
  console.log(`Public Base URL:  ${r2PublicBaseUrl}\n`);

  const possibleBuckets = ["research-papers", "research-workspace-papers", "research"];
  
  for (const bucket of possibleBuckets) {
    console.log(`Checking Supabase Storage bucket [${bucket}]...`);
    
    // Recursive list helper
    async function listAllFiles(prefix = "") {
      const { data, error } = await supabase.storage.from(bucket).list(prefix, { limit: 100 });
      if (error || !data || data.length === 0) return [];
      
      let files = [];
      for (const item of data) {
        const fullPath = prefix ? `${prefix}/${item.name}` : item.name;
        if (!item.id && (!item.metadata || Object.keys(item.metadata).length === 0)) {
          const subFiles = await listAllFiles(fullPath);
          files = files.concat(subFiles);
        } else {
          files.push({ ...item, fullPath });
        }
      }
      return files;
    }

    const files = await listAllFiles();
    if (!files.length) {
      console.log(`  No files found in bucket [${bucket}].\n`);
      continue;
    }

    console.log(`  Found ${files.length} files in [${bucket}]. Starting transfer to R2...`);

    for (const file of files) {
      console.log(`  -> Downloading ${file.fullPath}...`);
      const { data: blob, error: dlErr } = await supabase.storage.from(bucket).download(file.fullPath);
      
      if (dlErr || !blob) {
        console.error(`     Failed to download ${file.fullPath}:`, dlErr?.message);
        continue;
      }

      const buffer = Buffer.from(await blob.arrayBuffer());
      const fileName = file.fullPath.split("/").pop();
      const r2Key = `research-papers/${fileName}`;
      const contentType = file.metadata?.mimetype || "application/pdf";

      console.log(`     Uploading to R2 as [${r2Key}]...`);
      const publicUrl = await uploadToR2(r2Key, buffer, contentType);
      console.log(`     Uploaded: ${publicUrl}`);

      // Delete from Supabase storage after successful upload
      const { error: rmErr } = await supabase.storage.from(bucket).remove([file.fullPath]);
      if (rmErr) {
        console.warn(`     Warning: Failed to delete ${file.fullPath} from Supabase:`, rmErr.message);
      } else {
        console.log(`     Removed ${file.fullPath} from Supabase storage.`);
      }
    }
    console.log(`Finished processing bucket [${bucket}].\n`);
  }

  // Update DB URLs if research_papers table references Supabase storage paths
  console.log("Checking database records in public.research_papers...");
  const { data: dbPapers, error: dbErr } = await supabase.from("research_papers").select("*");
  if (!dbErr && dbPapers && dbPapers.length > 0) {
    for (const paper of dbPapers) {
      if (paper.pdf_url && paper.pdf_url.includes("supabase.co")) {
        const fileName = paper.pdf_url.split("/").pop().split("?")[0];
        const newUrl = `${r2PublicBaseUrl}/research-papers/${fileName}`;
        await supabase.from("research_papers").update({ pdf_url: newUrl }).eq("id", paper.id);
        console.log(`  Updated DB record "${paper.title || paper.id}" -> ${newUrl}`);
      }
    }
  }

  console.log("\nResearch papers migration completed!");
}

migratePapers().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
