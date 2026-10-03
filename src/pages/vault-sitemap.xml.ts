import type { APIRoute } from "astro";
import {
  buildSitemapXml,
  createXmlResponse,
  formatCanonicalUrl,
} from "../lib/sitemapHelper";

export const prerender = true;

export const GET: APIRoute = async ({ site }) => {
  const base = site || new URL("https://abodid.com");
  const entries = [{ url: formatCanonicalUrl(base, "/obsidian-vault") }];

  const xml = buildSitemapXml(entries);
  return createXmlResponse(xml, 86400);
};
