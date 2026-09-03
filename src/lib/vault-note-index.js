import {
  createSupabaseServiceClient,
  normalizeWikiLinkTarget,
  sourceHrefForFilePath,
} from "./vault-rag.js";

const MAX_TAG_RESULTS = 500;
const NOTE_INDEX_CACHE_TTL_MS = 5 * 60 * 1000;
const noteIndexCache = new Map();
const pendingLookups = new Map();
const noteContentCache = new Map();
const pendingNoteLookups = new Map();
let supabaseClient = null;

function getSupabaseClient() {
  if (!supabaseClient) supabaseClient = createSupabaseServiceClient();
  return supabaseClient;
}

export async function findIndexedNotesByWikiLink(tagName) {
  const normalizedTag = normalizeWikiLinkTarget(tagName);
  if (!normalizedTag) return [];

  const cached = noteIndexCache.get(normalizedTag);
  if (cached && cached.expiresAt > Date.now()) return cached.notes;
  if (pendingLookups.has(normalizedTag)) return pendingLookups.get(normalizedTag);

  const lookup = (async () => {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("obsidian_notes")
      .select("note_title,file_path")
      .eq("is_public", true)
      .contains("wiki_links", [normalizedTag])
      .order("note_title", { ascending: true })
      .limit(MAX_TAG_RESULTS);

    if (error) throw error;

    const notes = (data || [])
      .map((note) => {
        const href = sourceHrefForFilePath(note.file_path);
        const filename = note.file_path.split("/").pop() || "";
        const slug = filename.replace(/\.md$/i, "");

        return {
          name: filename,
          title: note.note_title || slug.replace(/-/g, " "),
          slug,
          href,
        };
      })
      .filter((note) => note.href);

    noteIndexCache.set(normalizedTag, {
      expiresAt: Date.now() + NOTE_INDEX_CACHE_TTL_MS,
      notes,
    });
    return notes;
  })();

  pendingLookups.set(normalizedTag, lookup);

  try {
    return await lookup;
  } finally {
    pendingLookups.delete(normalizedTag);
  }
}

export async function getIndexedNoteBySlug(slug) {
  const normalizedSlug = String(slug || "")
    .replace(/\.md$/i, "")
    .trim();
  if (!normalizedSlug) return null;

  const cached = noteContentCache.get(normalizedSlug);
  if (cached && cached.expiresAt > Date.now()) return cached.note;
  if (pendingNoteLookups.has(normalizedSlug)) {
    return pendingNoteLookups.get(normalizedSlug);
  }

  const lookup = (async () => {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("obsidian_notes")
      .select(
        "note_title,file_path,slug,markdown_content,tags,first_tag,content_hash,source_sha",
      )
      .eq("is_public", true)
      .eq("slug", normalizedSlug)
      .maybeSingle();

    if (error) throw error;
    const note = data?.source_sha ? data : null;
    noteContentCache.set(normalizedSlug, {
      expiresAt: Date.now() + NOTE_INDEX_CACHE_TTL_MS,
      note,
    });
    return note;
  })();

  pendingNoteLookups.set(normalizedSlug, lookup);

    try {
    return await lookup;
  } finally {
    pendingNoteLookups.delete(normalizedSlug);
  }
}

export async function getAllPublicVaultNotes() {
  const supabase = getSupabaseClient();
  try {
    const { data, error } = await supabase
      .from("obsidian_notes")
      .select("note_title,file_path,slug,updated_at,created_at,tags")
      .eq("is_public", true)
      .ilike("file_path", "6 - Main Notes/%")
      .order("note_title", { ascending: true })
      .limit(2000);

    if (!error && Array.isArray(data) && data.length > 0) {
      return data.map((note) => {
        const filename = note.file_path.split("/").pop() || "";
        const slug = note.slug || filename.replace(/\.md$/i, "");
        return {
          name: filename,
          title: note.note_title || slug.replace(/-/g, " "),
          slug,
          href: `/research/obsidian-vault/${encodeURIComponent(slug)}`,
          updated_at: note.updated_at || note.created_at || null,
          tags: Array.isArray(note.tags) ? note.tags : [],
        };
      });
    }
  } catch (err) {
    console.warn("[vault-notes] Supabase lookup failed, falling back to GitHub:", err);
  }

  // Fallback to GitHub
  try {
    const { getVaultNotes } = await import("./github.js");
    const files = await getVaultNotes();
    return (files || []).map((file) => {
      const slug = file.name.replace(/\.md$/i, "");
      return {
        name: file.name,
        title: slug.replace(/-/g, " "),
        slug,
        href: `/research/obsidian-vault/${encodeURIComponent(slug)}`,
        updated_at: null,
        tags: [],
      };
    });
  } catch (err) {
    console.error("[vault-notes] Fallback to GitHub failed:", err);
    return [];
  }
}
