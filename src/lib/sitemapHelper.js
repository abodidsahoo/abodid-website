import { getCanonicalPageUrl } from "./urlNormalization.js";

/**
 * Escapes XML special characters.
 * @param {string} value
 * @returns {string}
 */
export function escapeXml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

/**
 * Normalizes a URL to ensure canonical origin and no trailing slash (except root `/`).
 * @param {string | URL} baseUrl
 * @param {string} pathname
 * @returns {string}
 */
export function formatCanonicalUrl(baseUrl, pathname) {
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
 * Formats a Date or ISO string into a valid W3C Datetime string (ISO 8601).
 * Returns null if the value is invalid or cannot be parsed.
 * @param {string | Date | null | undefined} value
 * @returns {string | null}
 */
export function formatLastmod(value) {
  if (!value) return null;
  try {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toISOString();
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
 * @param {Array<{ url: string; lastmod?: string | Date | null }>} entries
 * @returns {string}
 */
export function buildSitemapXml(entries) {
  const seen = new Set();
  const uniqueEntries = [];

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
 * @param {string} xml
 * @param {number} [maxAge=3600]
 * @returns {Response}
 */
export function createXmlResponse(xml, maxAge = 3600) {
  return new Response(xml, {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": `public, max-age=${maxAge}, s-maxage=${maxAge * 2}, stale-while-revalidate=86400`,
    },
  });
}
