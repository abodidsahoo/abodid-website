import fs from "node:fs";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

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

async function emptyBucket(bucketName) {
  console.log(`Cleaning up Supabase Storage bucket: [${bucketName}]...`);
  
  async function listAndDelete(path = '') {
    const { data: items, error } = await supabase.storage.from(bucketName).list(path, { limit: 100 });
    if (error || !items || items.length === 0) return;

    const filesToDelete = [];
    for (const item of items) {
      const itemPath = path ? `${path}/${item.name}` : item.name;
      if (!item.id && (!item.metadata || Object.keys(item.metadata).length === 0)) {
        await listAndDelete(itemPath);
      } else {
        filesToDelete.push(itemPath);
      }
    }

    if (filesToDelete.length > 0) {
      const { error: delErr } = await supabase.storage.from(bucketName).remove(filesToDelete);
      if (delErr) {
        console.error(` Error deleting files in ${bucketName}/${path}:`, delErr.message);
      } else {
        console.log(` Deleted ${filesToDelete.length} files from ${bucketName}/${path}`);
      }
    }
  }

  await listAndDelete();
  console.log(`Finished cleaning bucket [${bucketName}].\n`);
}

async function main() {
  await emptyBucket("punctum-generated-worlds");
  await emptyBucket("punctum-world-artifacts");
  console.log("Supabase storage cleanup complete!");
}

main().catch(err => {
  console.error("Cleanup error:", err);
  process.exit(1);
});
