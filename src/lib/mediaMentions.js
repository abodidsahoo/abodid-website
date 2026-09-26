export const EMPTY_MEDIA_MENTION = Object.freeze({
  id: null,
  title: "",
  publication: "",
  url: "",
  published_at: "",
  categories: [],
  image_url: "",
  image_alt: "",
  published: false,
  sort_order: 0,
});

export const normalizeMentionCategories = (value) => {
  const entries = Array.isArray(value) ? value : String(value || "").split(",");
  const seen = new Set();

  return entries
    .map((entry) => String(entry || "").replace(/^#+/, "").replace(/\s+/g, " ").trim())
    .filter((entry) => {
      const key = entry.toLowerCase();
      if (!entry || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
};

export const normalizeMediaMention = (row = {}) => ({
  ...EMPTY_MEDIA_MENTION,
  ...row,
  id: row.id || null,
  title: String(row.title || ""),
  publication: String(row.publication || ""),
  url: String(row.url || ""),
  published_at: row.published_at ? String(row.published_at).slice(0, 10) : "",
  categories: normalizeMentionCategories(row.categories),
  image_url: String(row.image_url || ""),
  image_alt: String(row.image_alt || ""),
  published: Boolean(row.published),
  sort_order: Number.isFinite(Number(row.sort_order)) ? Number(row.sort_order) : 0,
});

export const isSafeMentionUrl = (value) => {
  const url = String(value || "").trim();
  if (/^\/[A-Za-z0-9]/.test(url)) return true;

  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
};

export const validateMediaMention = (mention) => {
  if (!String(mention?.title || "").trim()) return "Add a title.";
  if (!String(mention?.publication || "").trim()) return "Add the publication or collaborator.";
  if (!isSafeMentionUrl(mention?.url)) return "Add a complete https:// link or an internal path beginning with /.";
  if (!String(mention?.published_at || "").trim()) return "Add the publication date.";
  return "";
};

export const mediaMentionPayload = (mention, fallbackOrder = 0, published = mention?.published) => ({
  title: String(mention?.title || "").trim(),
  publication: String(mention?.publication || "").trim(),
  url: String(mention?.url || "").trim(),
  published_at: mention?.published_at,
  categories: normalizeMentionCategories(mention?.categories),
  image_url: String(mention?.image_url || "").trim() || null,
  image_alt: String(mention?.image_alt || "").trim(),
  published: Boolean(published),
  sort_order: Number.isFinite(Number(mention?.sort_order))
    ? Number(mention.sort_order)
    : fallbackOrder,
});
