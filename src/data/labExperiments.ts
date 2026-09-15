import { getPublishedLabProjects } from "../lib/portfolio/services.js";
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

const projectDestination = (project: any) => {
  const destinationBlock = (project.blocks || []).find((block: any) =>
    ["external_link", "link"].includes(block.blockType)
    && (block.content?.url || block.content?.href)
  );
  return {
    href: destinationBlock?.content?.url
      || destinationBlock?.content?.href
      || `/work/${project.slug}`,
    label: destinationBlock?.content?.label
      || destinationBlock?.content?.text
      || "Open experiment",
  };
};

const projectDiscipline = (project: any) => {
  const labels = (project.taxonomies || [])
    .filter((term: any) => String(term.label || term.slug || "").toLowerCase() !== "lab")
    .map((term: any) => term.label)
    .filter(Boolean);
  return labels.slice(0, 2).join(" · ") || "Creative technology";
};

const catalogueSettings = (project: any) =>
  (project.blocks || []).find((block: any) => block.settings?.catalogueSurface)?.settings || {};

const catalogueText = (project: any, role: string) => {
  const block = (project.blocks || []).find((item: any) => item.settings?.catalogueRole === role);
  return block?.content?.text || "";
};

export async function getLabExperiments(): Promise<LabExperiment[]> {
  try {
    const projects = await getPublishedLabProjects();

    return projects.map((project: any, position: number) => {
      const destination = projectDestination(project);
      const settings = catalogueSettings(project);
      const isSecondBrain = project.slug === "second-brain";
      const surface = isSecondBrain
        ? "yellow"
        : ["pink", "blue", "yellow", "cream", "lime"].includes(settings.catalogueSurface)
          ? settings.catalogueSurface
          : "cream";
      const cardVariant = isSecondBrain
        ? "media"
        : settings.catalogueVariant === "vault-tags"
          ? "vault-tags"
          : "media";
      const isVideo = /\.(mp4|webm|ogg)(?:\?|$)/i.test(project.coverUrl || "");

      const video = isSecondBrain
        ? OBSIDIAN_VAULT_THUMBNAIL_VIDEO_URL
        : project.slug === "punctum"
          ? PUNCTUM_WALKTHROUGH_VIDEO_URL
          : isVideo
            ? project.coverUrl
            : undefined;

      return {
        id: project.slug,
        index: String(position + 1).padStart(2, "0"),
        title: isSecondBrain ? "Obsidian Vault" : project.title,
        description: isSecondBrain
          ? "A public, interactive interface for my local Obsidian vault, synced through GitHub with tag filtering, SEO-friendly shareable notes, and an AI-powered RAG pipeline for semantic search across my knowledge base."
          : project.oneLineDescription,
        discipline: projectDiscipline(project),
        status: project.outcomeText || (project.workInProgress ? "Prototype" : "Live"),
        year: String(project.yearStart || ""),
        href: destination.href,
        destinationLabel: destination.label,
        thumbnail: project.coverUrl,
        video,
        thumbnailAlt: isSecondBrain
          ? "Obsidian Vault notes and knowledge system preview"
          : project.coverAlt || `${project.title} experiment preview`,
        surface,
        cardVariant,
        previewHeading: catalogueText(project, "previewHeading"),
        previewCta: catalogueText(project, "previewCta"),
      };
    });
  } catch (error) {
    console.error("Lab experiments could not be loaded from Supabase:", error);
    return [];
  }
}

