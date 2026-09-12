const SUPABASE_STORAGE_BASE =
  "https://jwipqbjxpmgyevfzpjjx.supabase.co/storage/v1/object/public";
const R2_STORAGE_BASE = "https://assets.abodid.com";

const publicStorageUrl = (bucket: string, objectPath: string) =>
  `${SUPABASE_STORAGE_BASE}/${bucket}/${objectPath
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;

export type MediaDeliveryTestItem = {
  label: string;
  kind: "video" | "image";
  sizeMiB: number;
  supabase: string;
  cloudflare: string;
};

export const mediaDeliveryTestItems: MediaDeliveryTestItem[] = [
  {
    label: "Showreel 2025",
    kind: "video",
    sizeMiB: 17.52,
    supabase: publicStorageUrl(
      "films",
      "videos/Showreel 2025 compressed.mp4",
    ),
    cloudflare: `${R2_STORAGE_BASE}/videos/showreel-2025-compressed.mp4`,
  },
  {
    label: "Obsidian Timelapse",
    kind: "video",
    sizeMiB: 6.57,
    supabase: publicStorageUrl(
      "misc",
      "video-clips/Obsidian_Timelapse.mp4",
    ),
    cloudflare: `${R2_STORAGE_BASE}/videos/obsidian-timelapse.mp4`,
  },
  {
    label: "Siri article thumbnail",
    kind: "image",
    sizeMiB: 1.38,
    supabase: publicStorageUrl(
      "blog",
      "articles/if-siri-finally-becomes-a-good-listener-the-future-is-bright/apple-events/siri-app-actions-mac.jpg",
    ),
    cloudflare: `${R2_STORAGE_BASE}/documents/thumbnails/siri-app-actions-mac.jpg`,
  },
  {
    label: "Punctum research thumbnail",
    kind: "image",
    sizeMiB: 1.16,
    supabase: publicStorageUrl(
      "research",
      "covers/1769636977430_msh94w5fk.jpg",
    ),
    cloudflare: `${R2_STORAGE_BASE}/documents/thumbnails/research-1769636977430-msh94w5fk.jpg`,
  },
  {
    label: "Research cover thumbnail",
    kind: "image",
    sizeMiB: 1.16,
    supabase: publicStorageUrl(
      "research",
      "covers/1769634589720_dz93s7tr8.jpg",
    ),
    cloudflare: `${R2_STORAGE_BASE}/documents/thumbnails/research-1769634589720-dz93s7tr8.jpg`,
  },
  {
    label: "Page preview thumbnail",
    kind: "image",
    sizeMiB: 1.08,
    supabase: publicStorageUrl(
      "page-assets",
      "og-images/1768884087671_0himmkhnc.jpg",
    ),
    cloudflare: `${R2_STORAGE_BASE}/documents/thumbnails/page-preview-1768884087671-0himmkhnc.jpg`,
  },
];

