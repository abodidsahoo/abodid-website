import generatedMetadata from "../../data/xr-showcase.generated.json";
import {
  publicXRShowcaseItems,
} from "../../data/xr-showcase";
import { supabase } from "../supabase";

const metadataById = new Map(generatedMetadata.map((item) => [item.id, item]));

const shuffle = (items) => {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[index]];
  }
  return shuffled;
};

const visualTier = (item) => {
  if (!item.thumbnail) return 0;
  if (
    item.visualWidth > 0 &&
    item.visualHeight > 0 &&
    (item.visualWidth < 480 || item.visualHeight < 270)
  ) {
    return 0;
  }
  if (item.visualScore >= 72) return 3;
  if (item.visualScore >= 56) return 2;
  return 1;
};

const orderForVisit = (items) => {
  const tiers = new Map([
    [3, []],
    [2, []],
    [1, []],
    [0, []],
  ]);
  items.forEach((item) => tiers.get(visualTier(item)).push(item));
  return [3, 2, 1, 0].flatMap((tier) => shuffle(tiers.get(tier)));
};

const fallbackItems = () =>
  orderForVisit(
    publicXRShowcaseItems.map((item) => {
      const metadata = metadataById.get(item.id);
      const thumbnail = item.thumbnail || metadata?.selectedImage;
      return {
        ...item,
        canonicalUrl: item.canonicalUrl || metadata?.canonicalUrl,
        thumbnail,
        thumbnailAlt: item.thumbnailAlt || `${item.title} preview image`,
        source: item.source || metadata?.source,
        domain: item.domain || metadata?.domain,
        visualScore: thumbnail ? 45 : 0,
        visualWidth: 0,
        visualHeight: 0,
      };
    }),
  );

const mapDatabaseItem = (row) => {
  const thumbnail = row.effective_image_url || row.manual_image_url || row.preview_image_url;
  const measuredImage = row.metadata?.image_quality;
  const visualScore =
    thumbnail && measuredImage?.url === thumbnail
      ? Number(measuredImage.score || 0)
      : thumbnail
        ? 45
        : 0;

  return {
    id: row.slug || row.id,
    databaseId: row.id,
    title: row.title,
    description: row.description || "",
    url: row.source_url,
    canonicalUrl: row.canonical_url || row.source_url,
    thumbnail,
    thumbnailAlt: row.image_alt || `${row.title} preview image`,
    primaryGenre: row.primary_genre || "Creative Concepts",
    tags: Array.isArray(row.tags) ? row.tags : [],
    source: row.source_name || row.source_domain,
    domain: row.source_domain,
    status: row.status,
    featured: Boolean(row.featured),
    visualScore,
    visualWidth: Number(measuredImage?.width || 0),
    visualHeight: Number(measuredImage?.height || 0),
  };
};

export async function getPublicXRShowcaseItems() {
  const { data, error } = await supabase
    .from("xr_showcase_items")
    .select(
      "id,slug,title,description,source_url,canonical_url,source_name,source_domain,primary_genre,tags,preview_image_url,manual_image_url,effective_image_url,image_alt,status,featured,metadata",
    )
    .eq("status", "published");

  if (error) {
    if (!["42P01", "PGRST205"].includes(error.code || "")) {
      console.error("XR Showcase database query failed:", error.message);
    }
    return fallbackItems();
  }

  return orderForVisit((data || []).map(mapDatabaseItem));
}
