export const PORTFOLIO_STATUS = ["draft", "published", "wip", "archived"];
export const BLOCK_TYPES = [
  "body_text",
  "heading",
  "quotation",
  "highlight",
  "testimonial",
  "single_image",
  "image_grid",
  "image_gallery",
  "video_embed",
  "media_text",
  "external_link",
  "divider",
];

export const BLOCK_LABELS = {
  body_text: "Body text",
  heading: "Heading",
  quotation: "Quotation",
  highlight: "Highlight",
  testimonial: "Testimonial",
  single_image: "Single image",
  image_grid: "Image grid",
  image_gallery: "Gallery / lightbox",
  video_embed: "Video embed",
  media_text: "Media with text",
  external_link: "External link / CTA",
  divider: "Divider / spacing",
};

export const TAXONOMY_GROUPS = [
  "genre",
  "role",
  "project_type"
];

export const PRIMARY_TERMS = [
  "Creative",
  "Technology",
  "Research",
  "Experimental",
  "Film",
  "Photography",
];

export const ROLE_TERMS = [
  "Creative Producer",
  "Director",
  "Editor",
  "Cinematographer",
  "Exhibition Designer",
  "Photographer",
  "Researcher",
  "Creative Technologist",
  "Artist",
  "Writer",
  "Strategist",
  "Creative Director",
  "Client Servicing / Developer",
  "Social Media Manager",
  "Workshop Facilitation",
  "Concept Development",
];

export function slugify(value = "") {
  return String(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96);
}

function normalizeGroupType(value) {
  return slugify(value).replace(/-/g, "_");
}

export function normalizeTaxonomyTerm(term, groupType = "theme") {
  const label = typeof term === "string" ? term.trim() : term?.label?.trim();
  const rawGroup = typeof term === "string" ? groupType : term?.groupType || term?.group_type || groupType;
  const group = normalizeGroupType(rawGroup);
  if (!label || !group) return null;
  return { label, slug: slugify(label), groupType: group };
}

export function taxonomyKey(term) {
  return `${term.groupType || term.group_type}:${term.slug || slugify(term.label)}`;
}

export function dedupeTaxonomies(terms = []) {
  const unique = new Map();
  terms.map((term) => normalizeTaxonomyTerm(term, term?.groupType)).filter(Boolean).forEach((term) => {
    unique.set(taxonomyKey(term), term);
  });
  return [...unique.values()];
}

export function createEmptyBlock(blockType = "body_text") {
  const contentByType = {
    body_text: { text: "" },
    heading: { text: "", level: 2 },
    quotation: { quote: "", attribution: "" },
    highlight: { text: "" },
    testimonial: { quote: "", name: "", role: "", link: "" },
    single_image: { media: null },
    image_grid: { media: [] },
    image_gallery: { media: [], caption: "" },
    video_embed: { url: "", caption: "", poster: "" },
    media_text: { media: null, text: "", mediaPosition: "left" },
    external_link: { label: "", url: "" },
    divider: {},
  };

  return {
    id: globalThis.crypto?.randomUUID?.() || `block-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    blockType,
    content: contentByType[blockType] || {},
    settings: {
      width: blockType === "divider" ? "standard" : "wide",
      alignment: "left",
      spacing: "default",
      columns: blockType === "image_grid" ? 2 : 1,
      mediaFit: "cover",
      lightbox: blockType === "image_gallery",
    },
    visible: true,
  };
}

export function createEmptyDraft(title = "Untitled project") {
  return {
    id: null,
    lockVersion: 0,
    revisionNumber: 1,
    title,
    oneLineDescription: "",
    context: "",
    specificContribution: "",
    yearStart: new Date().getFullYear(),
    yearEnd: null,
    location: "",
    duration: "",
    outcomeHeading: "",
    outcomeText: "",
    workInProgress: false,
    limitedPublic: false,
    coverUrl: "",
    coverAlt: "",
    coverFocalX: 50,
    coverFocalY: 50,
    seoTitle: "",
    metaDescription: "",
    socialImageUrl: "",
    searchVisible: true,
    blocks: [],
    taxonomies: [],
    organisations: [],
    collaborators: [],
    links: [],
  };
}

const validUrl = (value) => {
  if (!value) return true;
  try {
    const url = new URL(value, "https://abodid.com");
    return ["http:", "https:"].includes(url.protocol);
  } catch {
    return false;
  }
};

export function validateBlock(block) {
  const errors = [];
  if (!BLOCK_TYPES.includes(block?.blockType)) errors.push("Unsupported block type");
  const media = block?.content?.media;
  const mediaList = Array.isArray(media) ? media : media ? [media] : [];
  if (["single_image", "image_grid", "image_gallery", "media_text"].includes(block?.blockType)) {
    if (!mediaList.length) errors.push("Add media");
    mediaList.forEach((item) => {
      if (item?.url && !item.decorative && !item.alt?.trim()) errors.push("Image alt text is required");
    });
  }
  if (block?.blockType === "video_embed" && block.content?.url && !validUrl(block.content.url)) {
    errors.push("Video URL is invalid");
  }
  if (block?.blockType === "external_link" && block.content?.url && !validUrl(block.content.url)) {
    errors.push("Link URL is invalid");
  }
  return errors;
}

export function validateProjectForPublish(draft) {
  const errors = [];
  if (!draft?.title?.trim()) errors.push("Project title is required");
  if (!draft?.oneLineDescription?.trim()) errors.push("One-line proposition is required");
  if (!draft?.yearStart) errors.push("Start year is required");
  if (!draft?.coverUrl?.trim()) errors.push("Cover image is required");
  if (draft?.coverUrl && !draft?.coverAlt?.trim()) errors.push("Cover alt text is required");
  if (!draft?.workInProgress && !draft?.limitedPublic) {
    if (!draft?.context?.trim()) errors.push("Research Question is required");
    if (!draft?.specificContribution?.trim()) errors.push("Specific contribution is required");
  }
  (draft?.blocks || []).filter((block) => block.visible !== false).forEach((block, index) => {
    validateBlock(block).forEach((error) => errors.push(`Block ${index + 1}: ${error}`));
  });
  (draft?.links || []).forEach((link, index) => {
    if (!validUrl(link.url)) errors.push(`Link ${index + 1} is invalid`);
  });
  (draft?.collaborators || []).forEach((person, index) => {
    if (person.primaryUrl && !validUrl(person.primaryUrl)) errors.push(`Collaborator ${index + 1} link is invalid`);
  });
  return errors;
}

export function makeStorageFilename(originalFilename, suffix = Math.random().toString(36).slice(2, 8)) {
  const parts = String(originalFilename || "image").split(".");
  const extension = parts.length > 1 ? parts.pop().toLowerCase().replace(/[^a-z0-9]/g, "") : "bin";
  const base = slugify(parts.join(".")) || "image";
  return `${base}-${suffix}.${extension}`;
}

export function selectedFilterTokens(selected = {}) {
  return Object.entries(selected).flatMap(([group, slugs]) =>
    (slugs || []).map((slug) => `${group}:${slug}`),
  );
}

export function cardFilterTokens(card) {
  const tokens = (card.taxonomies || []).map((term) => `${term.groupType || term.group_type}:${term.slug}`);
  (card.organisations || []).forEach((org) => tokens.push(`organisation:${org.slug || slugify(org.name)}`));
  if (card.yearStart) tokens.push(`year:${card.yearStart}`);
  if (card.yearEnd && card.yearEnd !== card.yearStart) tokens.push(`year:${card.yearEnd}`);
  return new Set(tokens);
}

export function matchesStrictAnd(card, selected = {}) {
  const required = selectedFilterTokens(selected);
  if (!required.length) return true;
  const available = cardFilterTokens(card);
  return required.every((token) => available.has(token));
}

export function serializeFilters(selected = {}) {
  const params = new URLSearchParams();
  Object.entries(selected).forEach(([group, values]) => {
    if (!values?.length) return;
    const key = group === "primary" ? "terms" : group;
    params.set(key, [...values].sort().join(","));
  });
  return params.toString();
}

export function parseFilters(search = "") {
  const params = new URLSearchParams(search);
  const selected = {};
  const allowedGroups = new Set([...TAXONOMY_GROUPS, "primary", "organisation", "year"]);
  params.forEach((value, key) => {
    const group = key === "terms" ? "primary" : key;
    if (!allowedGroups.has(group)) return;
    const values = value.split(",").map((item) => slugify(item)).filter(Boolean);
    if (values.length) selected[group] = [...new Set(values)];
  });
  return selected;
}

export function toSavePayload(draft) {
  return {
    ...draft,
    taxonomies: dedupeTaxonomies(draft.taxonomies || []),
    blocks: (draft.blocks || []).map((block, position) => ({ ...block, position })),
    organisations: (draft.organisations || []).map((item, displayOrder) => ({ ...item, displayOrder })),
    collaborators: (draft.collaborators || []).map((item, displayOrder) => ({ ...item, displayOrder })),
    links: (draft.links || []).map((item, displayOrder) => ({ ...item, displayOrder })),
  };
}
