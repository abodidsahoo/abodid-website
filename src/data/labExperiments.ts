import { GESTURE_CONTROL_HERO_GIF_URL } from "../lib/mediaAssets";

export type LabExperiment = {
  id: string;
  index: string;
  title: string;
  description: string;
  discipline: string;
  status: string;
  year: string;
  href: string;
  thumbnail: string;
  thumbnailAlt: string;
  surface: "pink" | "blue" | "yellow";
};

export const labExperiments: LabExperiment[] = [
  {
    id: "punctum",
    index: "01",
    title: "Punctum",
    description:
      "A participatory study of the detail in a photograph that catches, moves, or stays with each viewer.",
    discipline: "Visual attention · Participatory AI",
    status: "Live",
    year: "2026",
    href: "/lab/punctum",
    thumbnail:
      "https://jwipqbjxpmgyevfzpjjx.supabase.co/storage/v1/object/public/research/covers/1769636977430_msh94w5fk.jpg",
    thumbnailAlt: "A photograph from the Punctum visual-attention experiment",
    surface: "pink",
  },
  {
    id: "image-flick",
    index: "02",
    title: "Image Flick",
    description:
      "A physics-led photo stack controlled by cursor movement, hand gestures, and an optional voice trigger.",
    discipline: "Gesture interface · Photography",
    status: "Prototype",
    year: "2026",
    href: "/lab/image-flick",
    thumbnail: GESTURE_CONTROL_HERO_GIF_URL,
    thumbnailAlt: "A hand gesture controlling a stack of digital photographs",
    surface: "blue",
  },
  {
    id: "photo-board",
    index: "03",
    title: "Photo Board",
    description:
      "An immersive table for scattering, rearranging, and discovering new relationships between photographs.",
    discipline: "Photo archive · Spatial interaction",
    status: "Prototype",
    year: "2026",
    href: "/lab/photo-board",
    thumbnail:
      "https://assets.abodid.com/photos/variants/exhibition-photos/1600/breathe-variations-rca-2023-abodid-sahoo-12-d06e2bea64.webp",
    thumbnailAlt: "Visitors moving through Abodid Sahoo's Breathe Variations exhibition",
    surface: "yellow",
  },
];
