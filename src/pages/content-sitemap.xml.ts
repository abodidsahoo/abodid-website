import type { APIRoute } from "astro";
import {
  buildSitemapXml,
  createXmlResponse,
  formatCanonicalUrl,
} from "../lib/sitemapHelper";

export const prerender = true;

export const GET: APIRoute = async ({ site }) => {
  const base = site || new URL("https://abodid.com");
  const entries = [
    "/blog",
    "/photography",
    "/research",
    "/research-papers",
    "/films",
  ].map((path) => ({ url: formatCanonicalUrl(base, path) }));

  const xml = buildSitemapXml(entries);
  return createXmlResponse(xml, 86400);
};
