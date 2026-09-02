export const prerender = false;

import { getVaultNotes } from "../../lib/github.js";
import { findNotesReferencing } from "../../lib/vault.js";
import {
  createSupabaseServiceClient,
  sourceHrefForFilePath,
} from "../../lib/vault-rag.js";

const VAULT_PATH_PREFIX = "6 - Main Notes/";

function cleanFilePath(value) {
  const filePath = String(value || "").trim().slice(0, 400);
  if (!filePath.startsWith(VAULT_PATH_PREFIX) || !filePath.endsWith(".md")) {
    return "";
  }
  return filePath;
}

function cleanTag(value) {
  return String(value || "")
    .replace(/^#/, "")
    .replace(/\.md$/i, "")
    .trim()
    .slice(0, 160);
}

function isDifferentFile(candidate, currentFilePath) {
  return (
    String(candidate || "").toLowerCase() !==
    String(currentFilePath || "").toLowerCase()
  );
}

function pickRandom(items) {
  if (!items.length) return null;
  return items[Math.floor(Math.random() * items.length)] || null;
}

function uniqueNotes(rows, currentFilePath) {
  const seen = new Set();
  return (rows || []).filter((row) => {
    const filePath = row?.file_path || row?.path || "";
    const key = filePath.toLowerCase();
    if (!key || seen.has(key) || !isDifferentFile(filePath, currentFilePath)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

async function findByIndexedTag(supabase, tag, currentFilePath) {
  if (!tag) return null;

  const { data, error } = await supabase
    .from("obsidian_chunks")
    .select("file_path,note_title")
    .eq("is_public", true)
    .contains("tags", [tag])
    .limit(80);

  if (error) throw error;
  return pickRandom(uniqueNotes(data, currentFilePath));
}

async function findByVector(supabase, currentFilePath) {
  const { data: currentRows, error: currentError } = await supabase
    .from("obsidian_chunks")
    .select("embedding")
    .eq("file_path", currentFilePath)
    .eq("is_public", true)
    .not("embedding", "is", null)
    .order("chunk_index", { ascending: true })
    .limit(1);

  if (currentError) throw currentError;
  const embedding = currentRows?.[0]?.embedding;
  if (!embedding) return null;

  const { data, error } = await supabase.rpc("match_obsidian_chunks", {
    query_embedding: embedding,
    match_count: 24,
    match_threshold: 0.08,
    public_only: true,
    tag_filter: null,
    folder_filter: null,
    file_path_filter: null,
  });

  if (error) throw error;
  return uniqueNotes(data, currentFilePath)[0] || null;
}

async function findByGitHubTag(tag, currentFilePath) {
  if (!tag) return null;
  const notes = await findNotesReferencing(tag);
  const candidates = notes.filter((note) =>
    isDifferentFile(note.path, currentFilePath),
  );
  return pickRandom(candidates);
}

async function findRandomVaultNote(currentFilePath) {
  const notes = await getVaultNotes();
  const candidates = notes.filter((note) => {
    const filePath = note.path || `${VAULT_PATH_PREFIX}${note.name}`;
    return isDifferentFile(filePath, currentFilePath);
  });
  return pickRandom(candidates);
}

function hrefForNote(note) {
  const filePath = note?.file_path || note?.path;
  if (filePath) return sourceHrefForFilePath(filePath);

  const filename = note?.name || "";
  const slug = filename.replace(/\.md$/i, "");
  return slug
    ? `/research/obsidian-vault/${encodeURIComponent(slug)}`
    : null;
}

function redirectTo(href) {
  return new Response(null, {
    status: 302,
    headers: {
      Location: href,
      "Cache-Control": "no-store",
    },
  });
}

export async function GET({ url }) {
  const currentFilePath = cleanFilePath(url.searchParams.get("file"));
  const firstTag = cleanTag(url.searchParams.get("tag"));

  if (!currentFilePath) {
    return redirectTo("/research/obsidian-vault");
  }

  let relatedNote = null;
  let supabase = null;

  try {
    supabase = createSupabaseServiceClient();
    relatedNote = await findByIndexedTag(supabase, firstTag, currentFilePath);
  } catch (error) {
    console.warn("[vault-related-note] Indexed tag lookup unavailable:", error);
  }

  if (!relatedNote && firstTag) {
    try {
      relatedNote = await findByGitHubTag(firstTag, currentFilePath);
    } catch (error) {
      console.warn("[vault-related-note] GitHub tag lookup unavailable:", error);
    }
  }

  if (!relatedNote && supabase) {
    try {
      relatedNote = await findByVector(supabase, currentFilePath);
    } catch (error) {
      console.warn("[vault-related-note] Vector lookup unavailable:", error);
    }
  }

  if (!relatedNote) {
    try {
      relatedNote = await findRandomVaultNote(currentFilePath);
    } catch (error) {
      console.warn("[vault-related-note] Random fallback unavailable:", error);
    }
  }

  return redirectTo(
    hrefForNote(relatedNote) || "/research/obsidian-vault",
  );
}
