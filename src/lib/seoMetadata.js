import { normalizePagePath } from "./urlNormalization.js";

export const SEO_SITE_NAME = "Abodid Sahoo";
export const SEO_SITE_URL = "https://abodid.com";

export const SEO_MANAGED_PAGES = [
  { page_path: "/", page_title: "Home" },
  { page_path: "/about", page_title: "About" },
  { page_path: "/services", page_title: "Services" },
  { page_path: "/consulting", page_title: "Consulting" },
  { page_path: "/obsidian-tutoring", page_title: "Obsidian Tutoring" },
  { page_path: "/video-editing-mentor", page_title: "Video Editing Mentor" },
  { page_path: "/workshops", page_title: "Workshops" },
  { page_path: "/photography", page_title: "Photography" },
  { page_path: "/films", page_title: "Films" },
  { page_path: "/work", page_title: "Work" },
  { page_path: "/blog", page_title: "Blog" },
  { page_path: "/research", page_title: "Research" },
  { page_path: "/education", page_title: "Education" },
  { page_path: "/press", page_title: "Press" },
  { page_path: "/cv", page_title: "CV" },
  { page_path: "/contact", page_title: "Contact" },
];

const cleanText = (value) =>
  typeof value === "string" && value.trim() ? value.trim() : undefined;

export const normalizeSeoPagePath = (value) => {
  const trimmed = cleanText(value) || "/";
  const withLeadingSlash = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return normalizePagePath(withLeadingSlash);
};

export const formatSeoTitle = (value, siteName = SEO_SITE_NAME) => {
  const title = cleanText(value);
  if (!title) return siteName;

  return title.toLowerCase().includes(siteName.toLowerCase())
    ? title
    : `${title} | ${siteName}`;
};

export const resolvePageSeo = ({ metadata, defaults = {} }) => {
  const publishedMetadata = metadata?.is_active ? metadata : null;

  return {
    title:
      cleanText(publishedMetadata?.meta_title) ||
      cleanText(defaults.title) ||
      cleanText(publishedMetadata?.page_title) ||
      SEO_SITE_NAME,
    description:
      cleanText(publishedMetadata?.meta_description) ||
      cleanText(defaults.description),
    image:
      cleanText(publishedMetadata?.og_image_url) || cleanText(defaults.image),
    imageAlt:
      cleanText(publishedMetadata?.og_image_alt) ||
      cleanText(defaults.imageAlt),
    type:
      cleanText(publishedMetadata?.og_type) ||
      cleanText(defaults.type) ||
      "website",
    focusKeyword: cleanText(publishedMetadata?.focus_keyword),
    noindex: publishedMetadata?.robots_index === false,
    hasPublishedOverride: Boolean(publishedMetadata),
    hasCustomSocialImage: Boolean(cleanText(publishedMetadata?.og_image_url)),
  };
};

export const getSeoReadiness = (metadata) => {
  if (!metadata?.id) {
    return { state: "missing", searchReady: false, socialReady: false };
  }

  const searchReady = Boolean(
    metadata.is_active &&
      cleanText(metadata.meta_title) &&
      cleanText(metadata.meta_description) &&
      cleanText(metadata.focus_keyword),
  );
  const socialReady = Boolean(
    cleanText(metadata.og_image_url) && cleanText(metadata.og_image_alt),
  );

  return {
    state: metadata.is_active ? (searchReady ? "ready" : "warning") : "draft",
    searchReady,
    socialReady,
  };
};

export const mergeManagedSeoPages = (metadataRows = []) => {
  const rowsByPath = new Map(
    metadataRows.map((row) => [normalizeSeoPagePath(row.page_path), row]),
  );

  const managed = SEO_MANAGED_PAGES.map((page) => ({
    ...page,
    ...rowsByPath.get(page.page_path),
    page_path: page.page_path,
    page_title:
      rowsByPath.get(page.page_path)?.page_title || page.page_title,
  }));
  const managedPaths = new Set(SEO_MANAGED_PAGES.map((page) => page.page_path));
  const custom = metadataRows
    .filter((row) => !managedPaths.has(normalizeSeoPagePath(row.page_path)))
    .map((row) => ({ ...row, page_path: normalizeSeoPagePath(row.page_path) }));

  return [...managed, ...custom].sort((a, b) =>
    a.page_path.localeCompare(b.page_path),
  );
};

export const createWebPageStructuredData = ({
  pagePath,
  title,
  description,
  focusKeyword,
}) => {
  const normalizedPath = normalizeSeoPagePath(pagePath);
  const url = new URL(normalizedPath, SEO_SITE_URL).toString();

  return {
    "@context": "https://schema.org",
    "@type": normalizedPath === "/about" ? "ProfilePage" : "WebPage",
    "@id": `${url}#webpage`,
    url,
    name: formatSeoTitle(title),
    ...(cleanText(description) ? { description: cleanText(description) } : {}),
    ...(cleanText(focusKeyword) ? { keywords: cleanText(focusKeyword) } : {}),
    isPartOf: { "@id": `${SEO_SITE_URL}/#website` },
    about: { "@id": `${SEO_SITE_URL}/#abodid-sahoo` },
  };
};
