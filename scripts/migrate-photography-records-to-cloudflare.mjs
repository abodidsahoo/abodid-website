import "dotenv/config";

import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(
  fs.readFileSync(
    path.join(projectRoot, "src/data/photographyCloudflare.generated.json"),
    "utf8",
  ),
);
const apply = process.argv.includes("--apply");
const supabaseUrl = process.env.PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  throw new Error("PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const { data: projects, error } = await supabase
  .from("photography")
  .select("id, slug, cover_image, gallery_images")
  .order("sort_order", { ascending: true });
if (error) throw error;

const cloudflareOnly = (value) => {
  try {
    return new URL(value).hostname === "assets.abodid.com";
  } catch {
    return false;
  }
};
const objectKeyFromUrl = (url) => decodeURIComponent(new URL(url).pathname.slice(1));

let updated = 0;
let galleryImages = 0;
for (const project of projects || []) {
  const media = manifest[project.slug];
  if (!media) throw new Error(`No Cloudflare manifest entry for ${project.slug}.`);
  const cover = media.cover?.large || media.cover?.original || media.cover?.small;
  const images = (media.images || []).map(
    (image) => image.large || image.original || image.small,
  );
  if (!cloudflareOnly(cover) || images.some((url) => !cloudflareOnly(url))) {
    throw new Error(`Non-Cloudflare URL found in manifest entry for ${project.slug}.`);
  }

  const previous = Array.isArray(project.gallery_images) ? project.gallery_images : [];
  const gallery = images.map((url, index) => ({
    ...(typeof previous[index] === "object" && previous[index] ? previous[index] : {}),
    id: previous[index]?.id || `photo-${index}-${path.basename(new URL(url).pathname)}`,
    url,
    storagePath: objectKeyFromUrl(url),
    sort_order: index,
  }));
  galleryImages += gallery.length;

  console.log(
    `${apply ? "Updating" : "Would update"} ${project.slug}: 1 cover + ${gallery.length} gallery images`,
  );
  if (!apply) continue;

  const { error: updateError } = await supabase
    .from("photography")
    .update({ cover_image: cover, gallery_images: gallery })
    .eq("id", project.id);
  if (updateError) throw updateError;
  updated += 1;
}

console.log(
  apply
    ? `Updated ${updated} photography projects with ${galleryImages} Cloudflare gallery images.`
    : `Dry run complete for ${(projects || []).length} projects and ${galleryImages} gallery images. Run with --apply to update the records.`,
);
