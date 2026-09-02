import {
  createSupabaseServiceClient,
  normalizeWikiLinkTarget,
  sourceHrefForFilePath,
} from "./vault-rag.js";

const MAX_TAG_RESULTS = 500;

export async function findIndexedNotesByWikiLink(tagName) {
  const normalizedTag = normalizeWikiLinkTarget(tagName);
  if (!normalizedTag) return [];

  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("obsidian_notes")
    .select("note_title,file_path")
    .eq("is_public", true)
    .contains("wiki_links", [normalizedTag])
    .order("note_title", { ascending: true })
    .limit(MAX_TAG_RESULTS);

  if (error) throw error;

  return (data || [])
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
}
