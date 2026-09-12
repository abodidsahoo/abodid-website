import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { buildCatalog } from "../src/lib/photography/catalog.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const readJson = (relativePath) =>
  JSON.parse(fs.readFileSync(path.join(projectRoot, relativePath), "utf8"));

const inventory = readJson("src/data/photographyR2.generated.json");
const metadata = readJson("src/data/photographyMetadata.json");
const portfolios = readJson("src/data/photographyPortfolios.generated.json");
const catalog = buildCatalog(inventory, metadata);
const inventoryByKey = new Map(inventory.map((object) => [object.key, object]));

const filename = (value) => {
  try {
    return decodeURIComponent(new URL(value).pathname.split("/").pop() || "");
  } catch {
    return String(value || "").split("/").pop() || "";
  }
};
const stem = (value) => filename(value).replace(/\.[^.]+$/, "").toLowerCase();
const withoutUploadPrefix = (value) => stem(value).replace(/^\d{10,}[-_]/, "");
const isUploadName = (photo) => /^\d{10,}[-_]/.test(filename(photo.key));

const dedupeByContent = (photos) => {
  const seen = new Set();
  return photos.filter((photo) => {
    const hash = inventoryByKey.get(photo.key)?.etag?.replaceAll('"', "") || photo.original;
    if (seen.has(hash)) return false;
    seen.add(hash);
    return true;
  });
};

const toMedia = (photo) => ({
  original: photo.original,
  small: photo.small,
  large: photo.large,
});

const manifest = {};
for (const story of portfolios.stories || []) {
  const seriesNames = new Set([story.slug, `photography-${story.slug}`]);
  const candidates = catalog
    .filter((photo) => seriesNames.has(photo.series))
    .sort((a, b) => a.key.localeCompare(b.key));
  if (!candidates.length) {
    throw new Error(`No Cloudflare images found for photography project: ${story.slug}`);
  }

  const coverStem = stem(story.coverImage);
  const normalizedCoverStem = withoutUploadPrefix(story.coverImage);
  const cover = candidates.find((photo) => stem(photo.key) === coverStem)
    || candidates.find((photo) => withoutUploadPrefix(photo.key) === normalizedCoverStem)
    || candidates.find(isUploadName)
    || candidates[0];

  // Migrated projects use timestamped WebP files for covers and camera-named
  // originals for the gallery. Keeping those roles separate also removes the
  // duplicated Into the Flux cover uploads left by the old migration.
  const regularPhotos = dedupeByContent(
    candidates.filter((photo) => !isUploadName(photo)),
  );
  const gallery = regularPhotos.length ? regularPhotos : dedupeByContent(candidates);

  manifest[story.slug] = {
    cover: toMedia(cover),
    images: gallery.map(toMedia),
  };
}

const outputPath = path.join(
  projectRoot,
  "src/data/photographyCloudflare.generated.json",
);
fs.writeFileSync(outputPath, `${JSON.stringify(manifest, null, 2)}\n`);

for (const story of portfolios.stories || []) {
  const cover = manifest[story.slug]?.cover;
  if (!cover) continue;
  story.coverImage = cover.large || cover.original || cover.small;
}
fs.writeFileSync(
  path.join(projectRoot, "src/data/photographyPortfolios.generated.json"),
  `${JSON.stringify(portfolios, null, 2)}\n`,
);

const imageCount = Object.values(manifest).reduce(
  (total, project) => total + project.images.length,
  0,
);
console.log(
  `Generated ${path.relative(projectRoot, outputPath)} and refreshed portfolio covers for ${Object.keys(manifest).length} projects and ${imageCount} gallery images.`,
);
