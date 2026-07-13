/**
 * Return the canonical path for a page route.
 * The site root keeps its required slash; every other page route drops
 * terminal slashes. Query strings are intentionally handled by callers.
 *
 * @param {string} pathname
 */
export function normalizePagePath(pathname) {
  if (!pathname || pathname === "/") return "/";
  return pathname.replace(/\/+$/, "") || "/";
}

/**
 * @param {string} siteUrl
 * @param {string} pathname
 */
export function getCanonicalPageUrl(siteUrl, pathname) {
  return new URL(normalizePagePath(pathname), siteUrl).toString();
}
