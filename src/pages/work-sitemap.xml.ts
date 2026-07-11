import type { APIRoute } from "astro";
import { getPublishedPortfolioIndex } from "../lib/portfolio/services";

export const prerender = false;

const escapeXml = (value: string) => value
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&apos;");

export const GET: APIRoute = async ({ site }) => {
  const projects = (await getPublishedPortfolioIndex()).filter((project) => project.searchVisible !== false);
  const base = site || new URL("https://abodid.com");
  const urls = [new URL("/work", base), ...projects.map((project) => new URL(`/work/${project.slug}`, base))];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((url) => `  <url><loc>${escapeXml(url.toString())}</loc></url>`).join("\n")}\n</urlset>`;
  return new Response(xml, { headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=300" } });
};

