export type PunctumImage = {
  id: string;
  slug: string;
  title: string;
  sequence: number;
  url: string;
  objectKey: string;
  width: number;
  height: number;
  checksum: string;
  version: number;
  softBackground: string;
};

export const PUNCTUM_STUDY_ID = "b9ca68cf-76d5-45a6-b9e2-eb8b7b0c5dbe";

const legacyPunctumImageSlugs: Record<string, string> = {
  "outernet-18": "rca-outernet-digital-direction-2024-gradshow-abodid-18",
  "digital-direction-146": "rca-digital-direction-2024-gradshow-abodid-146",
  "truman-brewery-97": "rca-grad-show-truman-brewery-abodid-97",
  "digital-direction-346": "rca-digital-direction-2024-gradshow-abodid-346",
  "ting-collaboration-09": "rca-2023-ting-photoshoot-collab-9",
  "into-the-flux-88": "into-the-flux-iba-london88",
};

/**
 * A stable random sample selected from Cloudflare R2's
 * `originals/exhibition-photos` folder on 28 July 2026.
 *
 * Keep these URLs on the originals path: research responses are tied to the
 * exact image checksum and must never silently move to a generated variant.
 * Each slug is the original filename without its directory or extension.
 */
export const punctumImages: PunctumImage[] = [
  {
    id: "b52cfd49-194d-4990-8243-9ca96ef171b7",
    slug: "rca-outernet-digital-direction-2024-gradshow-abodid-18",
    title: "Exhibition photograph 01",
    sequence: 1,
    url: "https://photos.abodid.com/originals/exhibition-photos/rca-outernet-digital-direction-2024-gradshow-abodid-18.jpg",
    objectKey:
      "originals/exhibition-photos/rca-outernet-digital-direction-2024-gradshow-abodid-18.jpg",
    width: 1920,
    height: 1280,
    checksum: "5f1b5ce734bda739f25a71b323ee05d3",
    version: 1,
    softBackground: "#d6d3ce",
  },
  {
    id: "fa7299d8-37fe-483f-b02c-aaf3537c8aa6",
    slug: "rca-digital-direction-2024-gradshow-abodid-146",
    title: "Exhibition photograph 02",
    sequence: 2,
    url: "https://photos.abodid.com/originals/exhibition-photos/rca-digital-direction-2024-gradshow-abodid-146.jpg",
    objectKey:
      "originals/exhibition-photos/rca-digital-direction-2024-gradshow-abodid-146.jpg",
    width: 1920,
    height: 1280,
    checksum: "71558b1e9e0f55d7175b80cf2c1ac025",
    version: 1,
    softBackground: "#e9e0d6",
  },
  {
    id: "f42c5540-7748-4795-9d2e-6bb7a62175ac",
    slug: "rca-grad-show-truman-brewery-abodid-97",
    title: "Exhibition photograph 03",
    sequence: 3,
    url: "https://photos.abodid.com/originals/exhibition-photos/rca-grad-show-truman-brewery-abodid-97.jpg",
    objectKey:
      "originals/exhibition-photos/rca-grad-show-truman-brewery-abodid-97.jpg",
    width: 1920,
    height: 1280,
    checksum: "3853dd699c864ce0f3cdfb3ce2a472c0",
    version: 1,
    softBackground: "#dbd6cf",
  },
  {
    id: "dbb67b6b-32c4-4ff0-ba00-eb7809f5e688",
    slug: "rca-digital-direction-2024-gradshow-abodid-346",
    title: "Exhibition photograph 04",
    sequence: 4,
    url: "https://photos.abodid.com/originals/exhibition-photos/rca-digital-direction-2024-gradshow-abodid-346.jpg",
    objectKey:
      "originals/exhibition-photos/rca-digital-direction-2024-gradshow-abodid-346.jpg",
    width: 1920,
    height: 1280,
    checksum: "a9afa1724f4329d51de2ebfb38939c35",
    version: 1,
    softBackground: "#e8dbd0",
  },
  {
    id: "813cac09-7777-4042-a432-c605252bdfd4",
    slug: "rca-2023-ting-photoshoot-collab-9",
    title: "Exhibition photograph 05",
    sequence: 5,
    url: "https://photos.abodid.com/originals/exhibition-photos/rca-2023-ting-photoshoot-collab-9.jpg",
    objectKey:
      "originals/exhibition-photos/rca-2023-ting-photoshoot-collab-9.jpg",
    width: 1920,
    height: 1280,
    checksum: "29517ab5fa91fdf58e633bf8c544243b",
    version: 1,
    softBackground: "#cecdc5",
  },
  {
    id: "f89a3837-7534-4fd7-adae-b6b92edc8144",
    slug: "into-the-flux-iba-london88",
    title: "Exhibition photograph 06",
    sequence: 6,
    url: "https://photos.abodid.com/originals/exhibition-photos/into-the-flux-iba-london88.jpg",
    objectKey:
      "originals/exhibition-photos/into-the-flux-iba-london88.jpg",
    width: 1980,
    height: 1320,
    checksum: "28d7f7c01fa9ba276e5e639ce71d3df9",
    version: 1,
    softBackground: "#d2d3cf",
  },
];

export const getPunctumImageById = (id: string) =>
  punctumImages.find((image) => image.id === id);

export const getPunctumImageBySlug = (slug: string) =>
  punctumImages.find(
    (image) => image.slug === (legacyPunctumImageSlugs[slug] || slug),
  );
