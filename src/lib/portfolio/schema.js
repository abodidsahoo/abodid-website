export const PORTFOLIO_STATUS = ["draft", "published", "wip", "archived"];
export const BLOCK_TYPES = [
  "body_text",
  "heading",
  "two_columns",
  "quotation",
  "highlight",
  "testimonial",
  "outcome",
  "collaborator",
  "organisation",
  "single_image",
  "image_grid",
  "image_gallery",
  "video_embed",
  "media_text",
  "link",
  "external_link",
  "divider",
  "spacer",
];

export const BLOCK_LABELS = {
  body_text: "Body text",
  heading: "Heading",
  two_columns: "Two Columns",
  quotation: "Quotation",
  highlight: "Highlight",
  testimonial: "Testimonial",
  outcome: "Outcome",
  collaborator: "Collaborator",
  organisation: "Organisation",
  single_image: "Single Image",
  image_grid: "Multi-image grid",
  image_gallery: "Multi-image grid",
  video_embed: "Video embed",
  media_text: "Media with text",
  link: "Link",
  external_link: "External link",
  divider: "Divider",
  spacer: "Spacer",
};

export const BLOCK_DESCRIPTIONS = {
  body_text: "Add the project narrative",
  heading: "Introduce a story section",
  two_columns: "Build a responsive two-column section",
  quotation: "Pull out a defining quote",
  highlight: "Emphasise one key idea",
  testimonial: "Add a named endorsement",
  outcome: "Add a small heading and supporting text",
  collaborator: "Add a collaborator, role and optional link",
  organisation: "Add an organisation, location and optional link",
  single_image: "Place one full image",
  image_grid: "Arrange several images with an optional lightbox",
  image_gallery: "Arrange several images with an optional lightbox",
  video_embed: "Add YouTube or Vimeo",
  media_text: "Pair an image with text",
  link: "Add linked text and a URL",
  external_link: "Add a footer-style link anywhere in the story",
  divider: "Add a visible horizontal line",
  spacer: "Add adjustable blank space",
};

export function balancePortfolioImageRows(count = 0) {
  const total = Math.max(0, Math.floor(Number(count) || 0));
  if (total <= 0) return [];
  if (total <= 3) return [total];
  const rowCount = Math.ceil(total / 3);
  const baseSize = Math.floor(total / rowCount);
  let remainder = total % rowCount;
  const rows = Array.from({ length: rowCount }, () => baseSize);
  const priority = Array.from({ length: rowCount }, (_, index) => index)
    .sort((left, right) => {
      if (remainder === 1) return Math.abs(left - (rowCount - 1) / 2) - Math.abs(right - (rowCount - 1) / 2);
      const leftEdge = Math.min(left, rowCount - 1 - left);
      const rightEdge = Math.min(right, rowCount - 1 - right);
      return leftEdge - rightEdge;
    });
  priority.forEach((rowIndex) => {
    if (remainder <= 0) return;
    rows[rowIndex] += 1;
    remainder -= 1;
  });
  return rows;
}

export function getPortfolioBlockSummary(block = {}) {
  const content = block.content || {};
  const media = Array.isArray(content.media) ? content.media : content.media ? [content.media] : [];
  const clean = (value) => String(value || "").replace(/\s+/g, " ").trim();
  const shorten = (value) => {
    const text = clean(value);
    return text.length > 72 ? `${text.slice(0, 69)}…` : text;
  };

  if (block.visible === false) return "Hidden from the public project";
  if (["single_image", "image_grid", "image_gallery"].includes(block.blockType)) {
    return media.length ? `${media.length} image${media.length === 1 ? "" : "s"}` : "No image selected";
  }
  if (block.blockType === "media_text") return shorten(content.text) || (media.length ? "Image with text" : "No content yet");
  if (block.blockType === "quotation") return shorten(content.quote) || "No quote yet";
  if (block.blockType === "testimonial") return shorten(content.quote || content.name) || "No testimonial yet";
  if (block.blockType === "outcome") return shorten(content.heading || content.text) || "No outcome yet";
  if (block.blockType === "collaborator") return shorten([content.name, content.role].filter(Boolean).join(" · ")) || "No collaborator yet";
  if (block.blockType === "organisation") return shorten([content.name, content.location].filter(Boolean).join(" · ")) || "No organisation yet";
  if (block.blockType === "two_columns") {
    const elementCount = (content.columns || []).reduce((total, column) => total + (Array.isArray(column.items) ? column.items.length : [column.heading, column.text, column.linkText].filter(Boolean).length), 0);
    return `2 columns · ${elementCount} element${elementCount === 1 ? "" : "s"}`;
  }
  if (block.blockType === "link") return shorten(content.text || content.url) || "No link yet";
  if (block.blockType === "external_link") return shorten(content.label || content.url) || "No link yet";
  if (block.blockType === "video_embed") return shorten(content.caption || content.url) || "No video yet";
  if (block.blockType === "divider") return "Horizontal line";
  if (block.blockType === "spacer") return `${Math.max(0, Number(content.height) || 0)}px blank space`;
  return shorten(content.text) || "No content yet";
}

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

export function normalizePortfolioHref(value = "") {
  let href = String(value || "").trim();
  if (!href) return "";
  if (href.startsWith("//")) href = `https:${href}`;
  if (href.startsWith("/") || href.startsWith("#") || href.startsWith("?")) return href;

  const looseProtocol = href.match(/^(https?)(?::|\/{1,2})\s*\/{0,2}(.*)$/i);
  if (looseProtocol) href = `${looseProtocol[1].toLowerCase()}://${looseProtocol[2]}`;
  else if (/^[a-z][a-z0-9+.-]*:/i.test(href)) return "";
  else href = `https://${href}`;

  try {
    const url = new URL(href);
    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}

export function isExternalPortfolioHref(value = "") {
  return /^https?:\/\//i.test(normalizePortfolioHref(value));
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
  const createColumnItem = (type, index) => ({
    id: globalThis.crypto?.randomUUID?.() || `column-${type}-${index + 1}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    type,
    ...(type === "heading" ? { text: "" } : {}),
    ...(type === "text" ? { text: "" } : {}),
    ...(type === "image" ? { url: "", alt: "", caption: "" } : {}),
    ...(type === "button" ? { label: "", url: "" } : {}),
    ...(type === "link" ? { text: "", url: "" } : {}),
  });
  const createColumn = (index) => ({
    id: globalThis.crypto?.randomUUID?.() || `column-${index + 1}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    items: [createColumnItem("heading", index), createColumnItem("text", index)],
  });
  const contentByType = {
    body_text: { text: "" },
    heading: { text: "", level: 2 },
    two_columns: { columns: [createColumn(0), createColumn(1)] },
    quotation: { quote: "", attribution: "" },
    highlight: { text: "" },
    testimonial: { quote: "", name: "", role: "", link: "" },
    outcome: { heading: "", text: "" },
    collaborator: { name: "", role: "", url: "" },
    organisation: { name: "", location: "", url: "" },
    single_image: { media: null },
    image_grid: { media: [] },
    image_gallery: { media: [], caption: "" },
    video_embed: { url: "", caption: "", poster: "" },
    media_text: { media: null, text: "", mediaPosition: "left" },
    link: { text: "", url: "" },
    external_link: { label: "", url: "" },
    divider: {},
    spacer: { height: 64 },
  };

  return {
    id: globalThis.crypto?.randomUUID?.() || `block-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    blockType,
    content: contentByType[blockType] || {},
    settings: {
      width: ["divider", "spacer", "outcome", "collaborator", "organisation", "external_link"].includes(blockType) ? "standard" : "wide",
      alignment: "left",
      spacing: ["spacer", "external_link"].includes(blockType) ? "compact" : "default",
      columns: blockType === "image_grid" ? 2 : 1,
      columnGap: blockType === "two_columns" ? 32 : undefined,
      mediaFit: "cover",
      displayMode: blockType === "image_gallery" ? "lightbox" : blockType === "image_grid" ? "grid" : undefined,
      imageSize: ["image_grid", "image_gallery"].includes(blockType) ? "medium" : undefined,
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
    layoutStyle: 1,
    blocks: [],
    taxonomies: [],
    organisations: [],
    collaborators: [],
    links: [],
  };
}

const COLLABORATOR_IDENTITY_FIELDS = ["name", "primaryUrl", "secondaryUrl", "organisation"];

export function createEmptyCollaborator(id = globalThis.crypto?.randomUUID?.()) {
  return {
    id,
    name: "",
    roleLabel: "",
    primaryUrl: "",
    secondaryUrl: "",
    organisation: "",
    _identityEditable: true,
  };
}

export function updateCollaboratorDraft(item, patch, createId = () => globalThis.crypto?.randomUUID?.()) {
  const changesIdentity = COLLABORATOR_IDENTITY_FIELDS.some(
    (field) => Object.hasOwn(patch, field) && patch[field] !== item?.[field],
  );
  const shouldForkIdentity = Boolean(item?.id) && !item?._identityEditable && changesIdentity;
  return {
    ...item,
    ...(shouldForkIdentity ? { id: createId(), _identityEditable: true } : {}),
    ...patch,
  };
}

export function markCollaboratorsPublished(collaborators = []) {
  return collaborators.map(({ _identityEditable, ...collaborator }) => ({
    ...collaborator,
    ...(_identityEditable ? {
      primaryUrl: normalizePortfolioHref(collaborator.primaryUrl) || String(collaborator.primaryUrl || "").trim(),
      secondaryUrl: normalizePortfolioHref(collaborator.secondaryUrl) || String(collaborator.secondaryUrl || "").trim(),
    } : {}),
  }));
}

export function orderPortfolioRevisionHistory(revisions = [], publishedRevisionId) {
  return [...revisions].sort((left, right) => {
    if (left.id === publishedRevisionId) return -1;
    if (right.id === publishedRevisionId) return 1;
    return Number(right.revision_number || 0) - Number(left.revision_number || 0);
  });
}

const validUrl = (value) => {
  if (!value) return true;
  return Boolean(normalizePortfolioHref(value));
};

export function validateBlock(block) {
  const errors = [];
  if (!BLOCK_TYPES.includes(block?.blockType)) errors.push("Unsupported block type");
  const media = block?.content?.media;
  const mediaList = Array.isArray(media) ? media : media ? [media] : [];
  if (["single_image", "image_grid", "image_gallery", "media_text"].includes(block?.blockType)) {
    if (!mediaList.length) errors.push("Add media");
  }
  if (block?.blockType === "video_embed" && block.content?.url && !validUrl(block.content.url)) {
    errors.push("Video URL is invalid");
  }
  if (["external_link", "link", "collaborator", "organisation"].includes(block?.blockType) && block.content?.url && !validUrl(block.content.url)) {
    errors.push("Link URL is invalid");
  }
  if (block?.blockType === "two_columns") {
    (block.content?.columns || []).forEach((column, index) => {
      if (column.linkUrl && !validUrl(column.linkUrl)) errors.push(`Column ${index + 1} link URL is invalid`);
      (column.items || []).forEach((item) => {
        const url = item.url || item.linkUrl;
        if (url && !validUrl(url)) errors.push(`Column ${index + 1} ${item.type || "element"} URL is invalid`);
      });
    });
  }
  return errors;
}

export function validateProjectForPublish(draft) {
  const errors = [];
  if (!draft?.title?.trim()) errors.push("Project title is required");
  if (!draft?.oneLineDescription?.trim()) errors.push("One-line proposition is required");
  if (!draft?.yearStart) errors.push("Year is required");
  if (!draft?.coverUrl?.trim()) errors.push("Cover image is required");
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

export function toPublicPortfolioProjection(draft = {}) {
  const limited = Boolean(draft.workInProgress && draft.limitedPublic);
  const projected = {
    ...draft,
    blocks: (draft.blocks || []).filter((block) => block.visible !== false),
  };
  if (!limited) return projected;
  return {
    ...projected,
    context: "",
    specificContribution: "",
    location: "",
    duration: "",
    outcomeHeading: "",
    outcomeText: "",
    collaborators: [],
    links: [],
  };
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
    blocks: (draft.blocks || []).map((block, position) => ({
      ...block,
      content: ["external_link", "link", "video_embed", "collaborator", "organisation"].includes(block.blockType)
        ? { ...block.content, url: normalizePortfolioHref(block.content?.url) || String(block.content?.url || "").trim() }
        : block.blockType === "two_columns"
          ? { ...block.content, columns: (block.content?.columns || []).map((column) => ({
            ...column,
            linkUrl: normalizePortfolioHref(column.linkUrl) || String(column.linkUrl || "").trim(),
            items: (column.items || []).map((item) => {
              const url = item.url || item.linkUrl;
              return url ? { ...item, url: normalizePortfolioHref(url) || String(url).trim() } : item;
            }),
          })) }
          : block.content,
      position,
    })),
    organisations: (draft.organisations || []).map((item, displayOrder) => ({ ...item, url: normalizePortfolioHref(item.url) || String(item.url || "").trim(), displayOrder })),
    collaborators: (draft.collaborators || []).map(({ _identityEditable, ...item }, displayOrder) => ({
      ...item,
      // Published collaborator identities are immutable. Preserve their legacy
      // URL spelling exactly so an unrelated draft save does not look like an
      // identity edit. New or explicitly edited identities have already been
      // forked and can be safely normalised.
      primaryUrl: _identityEditable
        ? normalizePortfolioHref(item.primaryUrl) || String(item.primaryUrl || "").trim()
        : String(item.primaryUrl || ""),
      secondaryUrl: _identityEditable
        ? normalizePortfolioHref(item.secondaryUrl) || String(item.secondaryUrl || "").trim()
        : String(item.secondaryUrl || ""),
      displayOrder,
    })),
    links: (draft.links || []).map((item, displayOrder) => ({ ...item, url: normalizePortfolioHref(item.url) || String(item.url || "").trim(), displayOrder })),
  };
}
