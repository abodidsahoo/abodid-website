import type { APIRoute } from "astro";
import { getAllPublicVaultNotes } from "../lib/vault-note-index.js";
import {
  buildSitemapXml,
  createXmlResponse,
  formatCanonicalUrl,
  type SitemapEntry,
} from "../lib/sitemapHelper";

export const prerender = false;

export const GET: APIRoute = async ({ site }) => {
  const base = site || new URL("https://abodid.com");
  const notes = await getAllPublicVaultNotes().catch(() => []);

  const entries: SitemapEntry[] = notes.map((note) => ({
    url: formatCanonicalUrl(
      base,
      `/research/obsidian-vault/${encodeURIComponent(note.slug)}`,
    ),
    lastmod: note.updated_at,
  }));

  const xml = buildSitemapXml(entries);
  return createXmlResponse(xml, 3600);
};
