import { directoryPaths } from '../data/siteDirectory.js';

/**
 * Single source of truth for crawlability, sitemap exclusion, and default noindex rules.
 */

export const EXCLUDED_PATH_PATTERNS = [
  /^\/land(?:\/|$)/,
  /^\/paper-renamer(?:\/|$)/,
  /^\/archive(?:\/|$)/,
  /^\/outreach(?:\/|$)/,
  /^\/one-photo\/responses(?:\/|$)/,
  /^\/club\/welcome(?:\/|$)/,
  /^\/opportunity-card-modal-qa(?:\/|$)/,
  /^\/media-delivery-test(?:\/|$)/,
  /^\/moodboard(?:-old| backup)(?:\/|$)/,
  /^\/research-old(?:\/|$)/,
  /^\/opportunities\/(?:auth|extension)(?:\/|$)/,
  /^\/resources\/(?:login|submit)(?:\/|$)/,
  /^\/(?:header|footer)-preview(?:\/|$)/,
  /^\/work\/layout-preview\/?$/,
  /^\/admin(?:\/|$)/,
  /^\/api(?:\/|$)/,
  /^\/login\/?$/,
  /^\/unauthorized\/?$/,
  /^\/unsubscribe\/?$/,
  /^\/payments\/?$/,
  /^\/club\/payment-/,
  /^\/collaboration\/measurements\/?$/,
  /^\/(?:du|nift)-workshop-responses\/?$/,
  /^\/feedback(?:\/|$)/,
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

/** Permanent destinations are shared with the visitor-facing directory. */
export const SITEMAP_HUB_PATHS = new Set(directoryPaths);

// These families contain published detail pages. Request-time collections are
// supplied by the content/work/vault sitemaps, which enforce publication flags.
const SITEMAP_CONTENT_PATH_PATTERNS = [
  /^\/(?:work|photography|films|research-papers)\/[^/]+$/,
  /^\/blog\/.+/,
  /^\/obsidian-vault\/(?!assets(?:\/|$)|tag(?:\/|$)).+/,
  /^\/system-manual\/.+/,
  /^\/resources\/(?!u(?:\/|$))[^/]+$/,
];

/**
 * Extracts a normalized pathname from a full URL or relative path.
 * @param {string} pageOrPath
 * @returns {string}
 */
export function extractPathname(pageOrPath) {
  try {
    return new URL(pageOrPath).pathname;
  } catch {
    const withoutQuery = pageOrPath.split("?")[0].split("#")[0];
    return withoutQuery.startsWith("/") ? withoutQuery : `/${withoutQuery}`;
  }
}

/**
 * Checks if a pathname matches any excluded pattern.
 * @param {string} pathname
 * @returns {boolean}
 */
export function isPathExcluded(pathname) {
  const cleanPath = extractPathname(pathname);
  return EXCLUDED_PATH_PATTERNS.some((pattern) => pattern.test(cleanPath));
}

/**
 * Filter predicate for @astrojs/sitemap.
 * @param {string} pageOrPath
 * @returns {boolean}
 */
export function shouldIncludeInSitemap(pageOrPath) {
  const rawPathname = extractPathname(pageOrPath);
  const pathname = rawPathname === "/" ? "/" : rawPathname.replace(/\/+$/, "");
  return !isPathExcluded(pathname) && (
    SITEMAP_HUB_PATHS.has(pathname)
    || SITEMAP_CONTENT_PATH_PATTERNS.some((pattern) => pattern.test(pathname))
  );
}

/**
 * Checks if a path should receive a default `noindex` directive.
 * @param {string} pathname
 * @returns {boolean}
 */
export function shouldNoindex(pathname) {
  return isPathExcluded(pathname);
}
