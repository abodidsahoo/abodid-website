export type PortfolioProjectStatus = "draft" | "published" | "wip" | "archived";
export type PortfolioRevisionState = "draft" | "published" | "archived";

export interface PortfolioMedia {
  id?: string;
  url: string;
  storagePath?: string;
  originalFilename?: string;
  mimeType?: string;
  width?: number | null;
  height?: number | null;
  alt: string;
  caption?: string;
  credit?: string;
  decorative?: boolean;
  focalX?: number;
  focalY?: number;
}

export interface PortfolioBlock {
  id: string;
  blockType: string;
  content: Record<string, unknown>;
  settings: Record<string, unknown>;
  visible: boolean;
  position?: number;
}

export interface PortfolioTaxonomy {
  id?: string;
  groupType: string;
  label: string;
  slug: string;
}

export interface PortfolioDraft {
  id: string | null;
  lockVersion: number;
  revisionNumber: number;
  title: string;
  oneLineDescription: string;
  context: string;
  specificContribution: string;
  yearStart: number | null;
  yearEnd: number | null;
  location: string;
  duration: string;
  outcomeHeading: string;
  outcomeText: string;
  workInProgress: boolean;
  limitedPublic: boolean;
  coverUrl: string;
  coverMedia?: PortfolioMedia | null;
  coverAlt: string;
  coverFocalX: number;
  coverFocalY: number;
  seoTitle: string;
  metaDescription: string;
  socialImageUrl: string;
  socialImageMedia?: PortfolioMedia | null;
  searchVisible: boolean;
  layoutStyle: number;
  blocks: PortfolioBlock[];
  taxonomies: PortfolioTaxonomy[];
  organisations: Record<string, unknown>[];
  collaborators: Record<string, unknown>[];
  links: Record<string, unknown>[];
}

export type PortfolioProjectContent = Omit<PortfolioDraft, "id" | "lockVersion" | "revisionNumber">;

export interface PortfolioProjectRecord {
  id: string;
  slug: string;
  title: string;
  status: PortfolioProjectStatus;
  content: PortfolioProjectContent;
  publishedContent: PortfolioProjectContent | null;
  publishedVersion: number;
  publishedAt: string | null;
  lockVersion: number;
}

export interface PortfolioProjectBackup {
  id: string;
  projectId: string;
  versionNumber: number;
  title: string;
  slug: string;
  content: PortfolioProjectContent;
  createdAt: string;
}
