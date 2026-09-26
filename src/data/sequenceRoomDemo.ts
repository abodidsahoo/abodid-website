const ASSET_ROOT = 'https://assets.abodid.com/photos/variants/exhibition-photos/800';

// This is intentionally a hand-picked, versioned set. Do not replace this with a
// runtime query: the demo board must open with the same photographs and IDs.
export const sequenceRoomDemoFilenames = [
  'breathe-variations-rca-2023-abodid-sahoo-12-d06e2bea64.webp',
  'breathe-variations-rca-2023-abodid-sahoo-7-e349cb9d57.webp',
  'hidden-exhibition-rca-abodid-17-72de495288.webp',
  'hidden-exhibition-rca-abodid-35-736387d606.webp',
  'hidden-exhibition-rca-abodid-45-12b0da9ee8.webp',
  'hidden-exhibition-rca-abodid-6-065be47488.webp',
  'into-the-flux-iba-london103-baac9bdf57.webp',
  'into-the-flux-iba-london25-c63d120285.webp',
  'into-the-flux-iba-london3-b6f687d4a1.webp',
  'into-the-flux-iba-london32-9358ff9710.webp',
  'into-the-flux-iba-london64-b2eb638e38.webp',
  'into-the-flux-iba-london7-bd8c4f9201.webp',
  'into-the-flux-iba-london88-28d7f7c01f.webp',
  'rca-2023-ma-print-exhibition-7-31a8897a8a.webp',
  'rca-2023-mres-exhibition-13-92f20e736a.webp',
  'rca-2023-mres-exhibition-5-d120ac9560.webp',
  'rca-2023-ting-photoshoot-collab-14-d25824f9d5.webp',
  'rca-2023-ting-photoshoot-collab-18-e2a4eaa7e0.webp',
  'rca-2023-ting-photoshoot-collab-22-d4ca79b9b1.webp',
  'rca-2023-ting-photoshoot-collab-9-29517ab5fa.webp',
  'rca-digital-direction-2024-gradshow-abodid-110-9e7cf71fec.webp',
  'rca-digital-direction-2024-gradshow-abodid-128-fb47103468.webp',
  'rca-digital-direction-2024-gradshow-abodid-137-c644bb86b7.webp',
  'rca-digital-direction-2024-gradshow-abodid-146-71558b1e9e.webp',
  'rca-digital-direction-2024-gradshow-abodid-154-ee8a91ffc1.webp',
  'rca-digital-direction-2024-gradshow-abodid-180-db18ec050f.webp',
  'rca-digital-direction-2024-gradshow-abodid-191-585204bf11.webp',
  'rca-digital-direction-2024-gradshow-abodid-195-53064575f0.webp',
  'rca-digital-direction-2024-gradshow-abodid-218-8b8ee75f22.webp',
  'rca-digital-direction-2024-gradshow-abodid-324-aeb8751430.webp',
] as const;

const titleFor = (filename: string) => {
  if (filename.startsWith('breathe-')) return 'Breathe Variations';
  if (filename.startsWith('hidden-')) return 'Hidden Exhibition';
  if (filename.startsWith('into-the-flux-')) return 'Into the Flux';
  if (filename.includes('ting-photoshoot')) return 'Ting Collaboration';
  if (filename.includes('ma-print')) return 'MA Print Exhibition';
  if (filename.includes('mres')) return 'MRes Exhibition';
  return 'Digital Direction Grad Show';
};

export const sequenceRoomDemoItems = sequenceRoomDemoFilenames.map((filename, index) => ({
  id: `sequence-demo-${String(index + 1).padStart(2, '0')}`,
  title: titleFor(filename),
  image: `${ASSET_ROOT}/${filename}`,
  paletteImageUrl: `/api/image-palette-proxy?url=${encodeURIComponent(`${ASSET_ROOT}/${filename}`)}`,
  slug: titleFor(filename).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
}));

export const sequenceRoomStarterItems = sequenceRoomDemoItems.slice(0, 3);
