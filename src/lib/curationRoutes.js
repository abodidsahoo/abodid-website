export const CURATION_HOSTNAME = "curation.abodid.com";
export const PRIMARY_ORIGIN = "https://abodid.com";
export const CURATION_ORIGIN = PRIMARY_ORIGIN;

const PRIMARY_SITE_HOSTNAMES = new Set([
  "abodid.com",
  "www.abodid.com",
]);

const normalizeHostname = (hostname = "") =>
  hostname.trim().toLowerCase().replace(/:\d+$/, "");

export const isCurationHostname = (hostname) => {
  const norm = normalizeHostname(hostname);
  return norm === CURATION_HOSTNAME || norm === "curation.localhost";
};

export const isPrimarySiteHostname = (hostname) =>
  PRIMARY_SITE_HOSTNAMES.has(normalizeHostname(hostname));

export const curationPath = Object.freeze({
  home: "/resources",
  login: "/login",
  dashboard: "/resources/dashboard",
  saved: "/resources/saved",
  submit: "/resources/submit",
  authCallback: "/resources/auth/callback",
  admin: "/resources/admin",
  adminReview: "/resources/admin/review",
  adminAnalytics: "/resources/admin/analytics",
  adminUsers: "/resources/admin/users",
  resource: (id) => `/resources/${encodeURIComponent(String(id))}`,
  editResource: (id) => `/resources/${encodeURIComponent(String(id))}/edit`,
  curator: (username) => `/resources/u/${encodeURIComponent(String(username))}`,
});

export const curationUrl = (pathname = "/resources") => {
  const cleanPath = pathname.startsWith("/resources")
    ? pathname
    : `/resources${pathname === "/" ? "" : pathname}`;
  return new URL(cleanPath, `${PRIMARY_ORIGIN}/`).toString();
};

/**
 * Convert a legacy /resources path or subdomain path to internal /resources path.
 */
export const legacyResourcePathToCurationPath = (pathname) => {
  if (!pathname || pathname === "/" || pathname === "/resources" || pathname === "/resources/") return "/resources";
  if (pathname === "/resources/curator" || pathname === "/curator") return curationPath.admin;
  if (pathname.startsWith("/resources/")) return pathname;

  const suffix = pathname.startsWith("/") ? pathname : `/${pathname}`;
  if (suffix.startsWith("/auth/")) return `/resources${suffix}`;
  if (suffix === "/dashboard" || suffix === "/saved" || suffix === "/submit") {
    return `/resources${suffix}`;
  }
  if (suffix === "/admin" || suffix.startsWith("/admin/")) return `/resources${suffix}`;
  if (suffix.startsWith("/u/")) return `/resources${suffix}`;

  const editMatch = suffix.match(/^\/resource\/([^/]+)\/edit$/) || suffix.match(/^\/([^/]+)\/edit$/);
  if (editMatch) return curationPath.editResource(decodeURIComponent(editMatch[1]));

  const resourceMatch = suffix.match(/^\/resource\/([^/]+)$/) || suffix.match(/^\/([^/]+)$/);
  if (resourceMatch) return curationPath.resource(decodeURIComponent(resourceMatch[1]));

  return `/resources${suffix}`;
};

/** Map a public curation URL to the existing internal Astro route. */
export const curationPathToInternalPath = (pathname) => {
  if (pathname === "/" || pathname === "/resources") return "/resources";
  if (pathname === "/robots.txt") return "/curation-robots.txt";
  if (pathname === "/sitemap.xml") return "/curation-sitemap.xml";
  if (pathname === "/dashboard" || pathname === "/resources/dashboard") return "/resources/dashboard";
  if (pathname === "/saved" || pathname === "/resources/saved") return "/resources/saved";
  if (pathname === "/submit" || pathname === "/resources/submit") return "/resources/submit";
  if (pathname === "/auth/callback" || pathname === "/resources/auth/callback") return "/resources/auth/callback";
  if (pathname === "/admin" || pathname === "/resources/admin") return "/resources/admin";
  if (pathname === "/admin/review" || pathname === "/resources/admin/review") return "/resources/admin/review";
  if (pathname === "/admin/analytics" || pathname === "/resources/admin/analytics") return "/resources/admin/analytics";
  if (pathname === "/admin/users" || pathname === "/resources/admin/users") return "/resources/admin/users";

  const editMatch = pathname.match(/^\/(?:resources\/)?(?:resource\/)?([^/]+)\/edit$/);
  if (editMatch) return `/resources/${editMatch[1]}/edit`;

  const resourceMatch = pathname.match(/^\/(?:resources\/)?(?:resource\/)?([^/]+)$/);
  if (resourceMatch) return `/resources/${resourceMatch[1]}`;

  const curatorMatch = pathname.match(/^\/(?:resources\/)?u\/([^/]+)$/);
  if (curatorMatch) return `/resources/u/${curatorMatch[1]}`;

  return null;
};

export const getLegacyResourceRedirect = () => {
  // Main site /resources routes are native and never redirect away
  return null;
};

export const getCurationCanonicalRedirect = (url) => {
  if (!isCurationHostname(url.hostname)) return null;
  const targetPath = legacyResourcePathToCurationPath(url.pathname);
  return `${PRIMARY_ORIGIN}${targetPath}${url.search}`;
};

/**
 * Keep post-auth navigation safe. This rejects protocol-relative,
 * absolute, and off-site destinations.
 */
export const safeCurationReturnTo = (value, fallback = curationPath.dashboard) => {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) {
    return fallback;
  }

  try {
    const parsed = new URL(value, `${PRIMARY_ORIGIN}/`);
    if (parsed.origin !== PRIMARY_ORIGIN) return fallback;
    const targetPath = parsed.pathname.startsWith("/resources")
      ? parsed.pathname
      : legacyResourcePathToCurationPath(parsed.pathname);
    return `${targetPath}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
};

export const isCurationOnlyPath = (pathname = "") => {
  if (pathname.startsWith("/resources")) return true;
  if (pathname === "/login" || pathname.startsWith("/login/")) return true;
  if (
    pathname.startsWith("/_astro/") ||
    pathname.startsWith("/_image") ||
    pathname.startsWith("/api/") ||
    pathname === "/favicon.ico" ||
    pathname === "/favicon.svg"
  ) {
    return true;
  }
  return false;
};

export const getCurationSubdomainRedirect = (url) => {
  if (!isCurationHostname(url.hostname)) return null;
  const targetPath = legacyResourcePathToCurationPath(url.pathname);
  return `${PRIMARY_ORIGIN}${targetPath}${url.search}`;
};


