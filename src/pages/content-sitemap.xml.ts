import type { APIRoute } from "astro";
import {
  getAllPosts,
  getAllPhotography,
  getResearchProjects,
  getFilms,
  getResearchPapers,
} from "../lib/api";
import {
  buildSitemapXml,
  createXmlResponse,
  formatCanonicalUrl,
  type SitemapEntry,
} from "../lib/sitemapHelper";

export const prerender = false;

export const GET: APIRoute = async ({ site }) => {
  const base = site || new URL("https://abodid.com");

  const [posts, photos, research, films, papers] = await Promise.all([
    getAllPosts().catch(() => []),
    getAllPhotography().catch(() => []),
    getResearchProjects().catch(() => []),
    getFilms().catch(() => []),
    getResearchPapers().catch(() => []),
  ]);

  const entries: SitemapEntry[] = [];

  // Blog posts
  for (const post of posts) {
    if (post.published !== false && post.slug) {
      entries.push({
        url: formatCanonicalUrl(base, `/blog/${post.slug}`),
        lastmod: (post as any).updated_at || post.published_at || (post as any).pubDate,
      });
    }
  }

  // Photography projects
  for (const photo of photos) {
    if (photo.published !== false && photo.slug) {
      entries.push({
        url: formatCanonicalUrl(base, `/photography/${photo.slug}`),
        lastmod: (photo as any).updated_at || (photo as any).created_at || (photo as any).date,
      });
    }
  }

  // Research projects
  for (const proj of research) {
    if (proj.published !== false && (proj as any).visible !== false && proj.slug) {
      entries.push({
        url: formatCanonicalUrl(base, `/research/${proj.slug}`),
        lastmod: (proj as any).updated_at || (proj as any).created_at,
      });
    }
  }

  // Films
  for (const film of films) {
    if (film.published !== false && film.slug) {
      entries.push({
        url: formatCanonicalUrl(base, `/films/${film.slug}`),
        lastmod: film.updated_at || film.video_published_at || (film as any).created_at,
      });
    }
  }

  // Curated Research Papers
  for (const paper of papers) {
    if (paper.published !== false && paper.slug) {
      entries.push({
        url: formatCanonicalUrl(base, `/research-papers/${paper.slug}`),
        lastmod: paper.updated_at || paper.published_at || (paper as any).created_at,
      });
    }
  }

  const xml = buildSitemapXml(entries);
  return createXmlResponse(xml, 300);
};
