import type { APIRoute } from "astro";
import { getPublishedPortfolioIndex } from "../lib/portfolio/services";
import { buildSitemapXml, createXmlResponse, formatCanonicalUrl } from "../lib/sitemapHelper";

export const prerender = false;

export const GET: APIRoute = async ({ site }) => {
  const base = site || new URL("https://abodid.com");
  const rawProjects = await getPublishedPortfolioIndex();
  const projects = rawProjects.filter((project) => project.searchVisible !== false);

  const entries = [
    {
      url: formatCanonicalUrl(base, "/work"),
    },
    ...projects.map((project) => ({
      url: formatCanonicalUrl(base, `/work/${project.slug}`),
      lastmod: (project as any).updatedAt || (project as any).updated_at || (project as any).createdAt || null,
    })),
  ];

  const xml = buildSitemapXml(entries);
  return createXmlResponse(xml, 300);
};
