// Frozen, content-addressed 800px WebP variants from the existing exhibition-photo folder.
// Keep this list in place so every reading ID retains the same image across deployments.
const BASE_URL = "https://assets.abodid.com/photos/variants/exhibition-photos/800/";
const FILENAMES = [
  "breathe-variations-rca-2023-abodid-sahoo-12-d06e2bea64.webp",
  "breathe-variations-rca-2023-abodid-sahoo-7-e349cb9d57.webp",
  "hidden-exhibition-rca-abodid-17-72de495288.webp",
  "hidden-exhibition-rca-abodid-35-736387d606.webp",
  "hidden-exhibition-rca-abodid-45-12b0da9ee8.webp",
  "hidden-exhibition-rca-abodid-6-065be47488.webp",
  "into-the-flux-iba-london103-baac9bdf57.webp",
  "into-the-flux-iba-london25-c63d120285.webp",
  "into-the-flux-iba-london3-b6f687d4a1.webp",
  "into-the-flux-iba-london32-9358ff9710.webp",
  "into-the-flux-iba-london64-b2eb638e38.webp",
  "into-the-flux-iba-london7-bd8c4f9201.webp",
  "into-the-flux-iba-london88-28d7f7c01f.webp",
  "rca-2023-ma-print-exhibition-7-31a8897a8a.webp",
  "rca-2023-mres-exhibition-13-92f20e736a.webp",
  "rca-2023-mres-exhibition-5-d120ac9560.webp",
  "rca-2023-ting-photoshoot-collab-14-d25824f9d5.webp",
  "rca-2023-ting-photoshoot-collab-18-e2a4eaa7e0.webp",
  "rca-2023-ting-photoshoot-collab-22-d4ca79b9b1.webp",
  "rca-2023-ting-photoshoot-collab-9-29517ab5fa.webp",
  "rca-digital-direction-2024-gradshow-abodid-110-9e7cf71fec.webp",
  "rca-digital-direction-2024-gradshow-abodid-128-fb47103468.webp",
  "rca-digital-direction-2024-gradshow-abodid-137-c644bb86b7.webp",
  "rca-digital-direction-2024-gradshow-abodid-146-71558b1e9e.webp",
  "rca-digital-direction-2024-gradshow-abodid-154-ee8a91ffc1.webp",
  "rca-digital-direction-2024-gradshow-abodid-180-db18ec050f.webp",
  "rca-digital-direction-2024-gradshow-abodid-191-585204bf11.webp",
  "rca-digital-direction-2024-gradshow-abodid-195-53064575f0.webp",
  "rca-digital-direction-2024-gradshow-abodid-218-8b8ee75f22.webp",
  "rca-digital-direction-2024-gradshow-abodid-324-aeb8751430.webp",
  "rca-digital-direction-2024-gradshow-abodid-346-a9afa1724f.webp",
  "rca-digital-direction-2024-gradshow-abodid-390-3868b73ee6.webp",
  "rca-digital-direction-2024-gradshow-abodid-471-899b322287.webp",
  "rca-digital-direction-2024-gradshow-abodid-492-daf220d645.webp",
  "rca-digital-direction-2024-gradshow-abodid-507-23fd27aded.webp",
  "rca-grad-show-truman-brewery-abodid-105-858f08c691.webp",
  "rca-grad-show-truman-brewery-abodid-118-f263e66352.webp",
  "rca-grad-show-truman-brewery-abodid-12-ca477fe8e3.webp",
  "rca-grad-show-truman-brewery-abodid-125-80e687285f.webp",
  "rca-grad-show-truman-brewery-abodid-129-8f9ed45643.webp",
  "rca-grad-show-truman-brewery-abodid-134-2fd0abb0b5.webp",
  "rca-grad-show-truman-brewery-abodid-145-ac99e8d257.webp",
  "rca-grad-show-truman-brewery-abodid-152-328e4c9ef2.webp",
  "rca-grad-show-truman-brewery-abodid-154-09225e3b40.webp",
  "rca-grad-show-truman-brewery-abodid-18-6237f1a833.webp",
  "rca-grad-show-truman-brewery-abodid-185-86d9a533a9.webp",
  "rca-grad-show-truman-brewery-abodid-196-c334b1da14.webp",
  "rca-grad-show-truman-brewery-abodid-4-b8757d155f.webp",
  "rca-grad-show-truman-brewery-abodid-67-678d3136ab.webp",
  "rca-grad-show-truman-brewery-abodid-73-913f01957c.webp",
  "rca-grad-show-truman-brewery-abodid-78-816cb20462.webp",
  "rca-grad-show-truman-brewery-abodid-84-d5194b4b92.webp",
  "rca-grad-show-truman-brewery-abodid-97-3853dd699c.webp",
  "rca-outernet-digital-direction-2024-gradshow-abodid-18-5f1b5ce734.webp",
  "rca-outernet-digital-direction-2024-gradshow-abodid-31-db2a6e5cd2.webp",
  "rca-outernet-digital-direction-2024-gradshow-abodid-33-c29a5e55be.webp",
] as const;

export const EXHIBITION_THUMBNAIL_COUNT = FILENAMES.length;

export function exhibitionThumbnailFor(readingId: string): string {
  // FNV-1a makes the choice look random without changing it on page refresh.
  let hash = 0x811c9dc5;
  for (let index = 0; index < readingId.length; index += 1) {
    hash ^= readingId.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return BASE_URL + FILENAMES[(hash >>> 0) % FILENAMES.length];
}
