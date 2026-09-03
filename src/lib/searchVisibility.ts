/**
 * Single source of truth for crawlability, sitemap exclusion, and default noindex rules.
 */

export const EXCLUDED_PATH_PATTERNS: RegExp[] = [
  /^\/admin(?:\/|$)/,
  /^\/api(?:\/|$)/,
  /^\/login\/?$/,
  /^\/unauthorized\/?$/,
  /^\/unsubscribe\/?$/,
  /^\/payments\/?$/,
  /^\/club\/payment-/,
  /^\/collaboration\/measurements\/?$/,
  /^\/du-workshop-responses\/?$/,
  /^\/feedback\/?$/,
  /^\/hand-tracking-test\/?$/,
  /^\/landing-grid-test\/?$/,
  /^\/blur-phrase-centered\/?$/,
  /^\/home-next\/?$/,
  /^\/archive\/homepages(?:\/|$)/,
  /^\/bsa-qrcode\/?$/,
  /^\/research\/admin(?:\/|$)/,
  /^\/resources\/admin(?:\/|$)/,
  /^\/resources\/auth(?:\/|$)/,
  /^\/resources\/curator\/?$/,
  /^\/resources\/dashboard\/?$/,
  /^\/resources\/saved\/?$/,
  /^\/resources\/.*\/edit\/?$/,
  /^\/research\/visual-moodboard\/?$/,
  /^\/workshops\/video-editing-storytelling-class-1\/?$/,
  /^\/workshops\/video-editing-storytelling-class-2\/?$/,
  /^\/july-backup\/?$/,
  /^\/404\/?$/,
  /^\/500\/?$/,
];

/**
 * Extracts a normalized pathname from a full URL or relative path.
 */
export function extractPathname(pageOrPath: string): string {
  try {
    return new URL(pageOrPath).pathname;
  } catch {
    const withoutQuery = pageOrPath.split("?")[0].split("#")[0];
    return withoutQuery.startsWith("/") ? withoutQuery : `/${withoutQuery}`;
  }
}

/**
 * Checks if a pathname matches any excluded pattern.
 */
export function isPathExcluded(pathname: string): boolean {
  const cleanPath = extractPathname(pathname);
  return EXCLUDED_PATH_PATTERNS.some((pattern) => pattern.test(cleanPath));
}

/**
 * Filter predicate for @astrojs/sitemap.
 */
export function shouldIncludeInSitemap(pageOrPath: string): boolean {
  return !isPathExcluded(pageOrPath);
}

/**
 * Determines whether a page should receive a default noindex meta tag based on its URL pattern.
 */
export function shouldNoindex(pathname: string): boolean {
  return isPathExcluded(pathname);
}
