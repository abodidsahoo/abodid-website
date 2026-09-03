import { getCanonicalPageUrl } from "./urlNormalization.js";

export interface SitemapEntry {
  url: string;
  lastmod?: string | Date | null;
}

/**
 * Escapes XML special characters.
 */
export function escapeXml(value: string): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

/**
 * Normalizes a URL to ensure canonical origin and no trailing slash (except root `/`).
 */
export function formatCanonicalUrl(baseUrl: string | URL, pathname: string): string {
  const baseStr = typeof baseUrl === "string" ? baseUrl : baseUrl.origin;
  const canonical = getCanonicalPageUrl(baseStr, pathname);
  // Ensure no trailing slash on subpaths
  try {
    const parsed = new URL(canonical);
    if (parsed.pathname !== "/" && parsed.pathname.endsWith("/")) {
      parsed.pathname = parsed.pathname.replace(/\/+$/, "");
      return parsed.toString();
    }
    return parsed.toString();
  } catch {
    return canonical.replace(/\/+$/, "") || "/";
  }
}

/**
 * Formats a Date or ISO string into a valid W3C Datetime string (YYYY-MM-DD or ISO 8601).
 * Returns null if the value is invalid or cannot be parsed.
 */
export function formatLastmod(value?: string | Date | null): string | null {
  if (!value) return null;
  try {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toISOString().split("T")[0]; // YYYY-MM-DD
  } catch {
    return null;
  }
}

/**
 * Builds a valid XML sitemap string conforming to the sitemap protocol.
 * Features:
 * - Canonical deduplication by URL
 * - XML character escaping
 * - Strict trailing slash removal on subpaths
 * - Optional accurate <lastmod>
 * - No <priority> or <changefreq>
 */
export function buildSitemapXml(entries: SitemapEntry[]): string {
  const seen = new Set<string>();
  const uniqueEntries: Array<{ loc: string; lastmod: string | null }> = [];

  for (const entry of entries) {
    if (!entry || !entry.url) continue;

    // Normalize URL
    let loc = entry.url.trim();
    try {
      const parsed = new URL(loc);
      if (parsed.pathname !== "/" && parsed.pathname.endsWith("/")) {
        parsed.pathname = parsed.pathname.replace(/\/+$/, "");
        loc = parsed.toString();
      }
    } catch {
      loc = loc.replace(/\/+$/, "");
    }

    if (!seen.has(loc)) {
      seen.add(loc);
      uniqueEntries.push({
        loc,
        lastmod: formatLastmod(entry.lastmod),
      });
    }
  }

  const urlElements = uniqueEntries.map((item) => {
    const lines = [`    <loc>${escapeXml(item.loc)}</loc>`];
    if (item.lastmod) {
      lines.push(`    <lastmod>${item.lastmod}</lastmod>`);
    }
    return `  <url>\n${lines.join("\n")}\n  </url>`;
  });

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urlElements,
    "</urlset>",
  ].join("\n");
}

/**
 * Creates an Astro APIRoute Response for sitemaps with standard headers.
 */
export function createXmlResponse(xml: string, maxAge = 3600): Response {
  return new Response(xml, {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": `public, max-age=${maxAge}, s-maxage=${maxAge * 2}, stale-while-revalidate=86400`,
    },
  });
}
