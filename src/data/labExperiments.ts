import { supabase } from "../lib/supabaseClient";
import {
  PUNCTUM_WALKTHROUGH_VIDEO_URL,
  OBSIDIAN_VAULT_THUMBNAIL_VIDEO_URL,
} from "../lib/mediaAssets";

export type LabExperiment = {
  id: string;
  index: string;
  title: string;
  description: string;
  discipline: string;
  status: string;
  year: string;
  href: string;
  destinationLabel: string;
  thumbnail: string;
  video?: string;
  thumbnailAlt: string;
  surface: "pink" | "blue" | "yellow" | "cream" | "lime";
  cardVariant: "media" | "vault-tags";
  previewHeading?: string;
  previewCta?: string;
};

type LabCatalogueRow = {
  entry_key: string;
  title: string;
  description: string;
  discipline: string;
  status_label: string;
  year_label: string;
  destination_path: string;
  destination_label: string;
  thumbnail_url: string;
  video_url: string | null;
  thumbnail_alt: string;
  surface: LabExperiment["surface"];
  card_variant: LabExperiment["cardVariant"];
  preview_heading: string | null;
  preview_cta: string | null;
};

const obsidianVaultExperiment: Omit<LabExperiment, "index"> = {
  id: "obsidian-vault",
  title: "Obsidian Vault",
  description:
    "A public, interactive interface for my local Obsidian vault, synced through GitHub with tag filtering, SEO-friendly shareable notes, and an AI-powered RAG pipeline for semantic search across my knowledge base.",
  discipline: "Knowledge systems · Creative technology",
  status: "Live system",
  year: "2026",
  href: "/obsidian-vault",
  destinationLabel: "Open experiment",
  thumbnail: OBSIDIAN_VAULT_THUMBNAIL_VIDEO_URL,
  video: OBSIDIAN_VAULT_THUMBNAIL_VIDEO_URL,
  thumbnailAlt: "Obsidian Vault notes and knowledge system preview",
  surface: "yellow",
  cardVariant: "media",
};

const fallbackLabExperiments: Omit<LabExperiment, "index">[] = [
  {
    id: "punctum",
    title: "Punctum",
    description:
      "A participatory study of the detail in a photograph that catches, moves, or stays with each viewer.",
    discipline: "Visual attention · Participatory AI",
    status: "Live",
    year: "2026",
    href: "/lab/punctum",
    destinationLabel: "Open experiment",
    thumbnail: PUNCTUM_WALKTHROUGH_VIDEO_URL,
    video: PUNCTUM_WALKTHROUGH_VIDEO_URL,
    thumbnailAlt:
      "Interactive walkthrough animation of the Punctum visual-attention experiment",
    surface: "pink",
    cardVariant: "media",
  },
  {
    id: "image-flick",
    title: "Image Flick",
    description:
      "A physics-led photo stack controlled by cursor movement, hand gestures, and an optional voice trigger.",
    discipline: "Gesture interface · Photography",
    status: "Prototype",
    year: "2026",
    href: "/lab/image-flick",
    destinationLabel: "Open experiment",
    thumbnail:
      "https://jwipqbjxpmgyevfzpjjx.supabase.co/storage/v1/object/public/misc/gif/gesture-control-abodid-thumbnail-gif.gif",
    thumbnailAlt: "A hand gesture controlling a stack of digital photographs",
    surface: "yellow",
    cardVariant: "media",
  },
  {
    id: "glyph-loom",
    title: "Glyph Loom",
    description:
      "A generative typography instrument that reconstructs live letterforms from modular bars, dots, crosses, and woven structures.",
    discipline: "Generative typography · Creative coding",
    status: "Live",
    year: "2026",
    href: "/lab/glyph-loom",
    destinationLabel: "Open experiment",
    thumbnail: "/images/research/glyph-loom-cover.png",
    thumbnailAlt: "Generative typography outlines in the Glyph Loom instrument",
    surface: "lime",
    cardVariant: "media",
  },
  {
    id: "sequence-room",
    title: "Sequence Room",
    description:
      "An immersive table for scattering, rearranging, and discovering new relationships between photographs.",
    discipline: "Photo archive · Spatial interaction",
    status: "Prototype",
    year: "2026",
    href: "/lab/sequence-room",
    destinationLabel: "Open experiment",
    thumbnail:
      "https://jwipqbjxpmgyevfzpjjx.supabase.co/storage/v1/object/public/misc/video-clips/sequence-room-comp.mp4",
    video:
      "https://jwipqbjxpmgyevfzpjjx.supabase.co/storage/v1/object/public/misc/video-clips/sequence-room-comp.mp4",
    thumbnailAlt: "Interactive Sequence Room photo workspace preview",
    surface: "cream",
    cardVariant: "media",
  },
  obsidianVaultExperiment,
  {
    id: "obsidian-tags-interactive-explorer",
    title: "Obsidian Tags Interactive Explorer",
    description:
      "A living, cursor-led window into my Obsidian knowledge system, where movement reveals the ideas and connections shaping my work.",
    discipline: "Knowledge systems · Creative technology",
    status: "Live system",
    year: "2026",
    href: "/lab/obsidian-tags-interactive-explorer",
    destinationLabel: "Open experiment",
    thumbnail: OBSIDIAN_VAULT_THUMBNAIL_VIDEO_URL,
    video: OBSIDIAN_VAULT_THUMBNAIL_VIDEO_URL,
    thumbnailAlt: "Obsidian Vault notes and knowledge system preview",
    surface: "blue",
    cardVariant: "vault-tags",
    previewHeading: "A glimpse into my second brain.",
    previewCta: "Open the interactive explorer ↗",
  },
];

const numberExperiments = (
  experiments: Omit<LabExperiment, "index">[],
): LabExperiment[] =>
  experiments.map((experiment, position) => ({
    ...experiment,
    index: String(position + 1).padStart(2, "0"),
  }));

const restoreObsidianVault = (
  experiments: Omit<LabExperiment, "index">[],
): Omit<LabExperiment, "index">[] => {
  if (experiments.some((experiment) => experiment.id === obsidianVaultExperiment.id)) {
    return experiments;
  }

  const restored = [...experiments];
  const explorerIndex = restored.findIndex(
    (experiment) => experiment.id === "obsidian-tags-interactive-explorer",
  );
  restored.splice(explorerIndex >= 0 ? explorerIndex : restored.length, 0, obsidianVaultExperiment);
  return restored;
};

const mapCatalogueRow = (row: LabCatalogueRow): Omit<LabExperiment, "index"> => ({
  id: row.entry_key,
  title: row.title,
  description: row.description,
  discipline: row.discipline,
  status: row.status_label,
  year: row.year_label,
  href: row.destination_path,
  destinationLabel: row.destination_label,
  thumbnail: row.thumbnail_url,
  video: row.video_url || undefined,
  thumbnailAlt: row.thumbnail_alt,
  surface: row.surface,
  cardVariant: row.card_variant,
  previewHeading: row.preview_heading || undefined,
  previewCta: row.preview_cta || undefined,
});

export async function getLabExperiments(): Promise<LabExperiment[]> {
  try {
    const { data, error } = await supabase
      .from("lab_catalogue_entries")
      .select(
        "entry_key,title,description,discipline,status_label,year_label,destination_path,destination_label,thumbnail_url,video_url,thumbnail_alt,surface,card_variant,preview_heading,preview_cta,sort_order",
      )
      .eq("visible", true)
      .order("sort_order", { ascending: true });

    if (error) throw error;
    if (!data?.length) return [];

    return numberExperiments(
      restoreObsidianVault((data as LabCatalogueRow[]).map(mapCatalogueRow)),
    );
  } catch (error) {
    console.warn(
      "Lab catalogue could not be loaded; using the local fallback:",
      error,
    );
    return numberExperiments(fallbackLabExperiments);
  }
}
