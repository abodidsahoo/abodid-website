export const prerender = false;

import { getRelatedVaultNote, getIndexedNoteBySlug } from "../../lib/vault-note-index.js";
import {
  VAULT_BASE_PATH,
  stripVaultNoteHref,
} from "../../lib/vault-paths.js";

function cleanFilePath(value) {
  const filePath = String(value || "").trim().slice(0, 400);
  if (
    (!filePath.startsWith("06-main-notes/") && !filePath.startsWith("6 - Main Notes/")) ||
    !filePath.endsWith(".md")
  ) {
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
  const wantsJson = url.searchParams.get("json") === "true";

  if (!currentFilePath) {
    return wantsJson
      ? new Response(JSON.stringify({ error: "Invalid file path" }), { status: 400 })
      : redirectTo(VAULT_BASE_PATH);
  }

  const rawSlug = currentFilePath.split("/").pop().replace(/\.md$/i, "");

  let tags = firstTag ? [firstTag] : [];
  try {
    const currentNote = await getIndexedNoteBySlug(rawSlug);
    if (currentNote?.tags?.length) {
      tags = currentNote.tags;
    }
  } catch (e) {
    // Ignore error
  }

  const related = await getRelatedVaultNote({
    slug: rawSlug,
    tags,
    firstTag,
    filePath: currentFilePath,
  });

  const targetHref = related?.href || VAULT_BASE_PATH;
  const displayTitle =
    related?.title ||
    (related?.slug ? related.slug.replace(/-/g, " ") : "Explore Another Note");
  const targetSlug = related?.slug || stripVaultNoteHref(targetHref);
  const targetFirstTag = related?.firstTag || "";
  const targetFilePath = targetSlug ? `06-main-notes/${targetSlug}.md` : "";

  if (wantsJson) {
    return new Response(
      JSON.stringify({
        href: targetHref,
        slug: targetSlug,
        displayTitle,
        firstTag: targetFirstTag,
        filePath: targetFilePath,
      }),
      {
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "public, max-age=60, s-maxage=300",
        },
      }
    );
  }

  return redirectTo(targetHref);
}
