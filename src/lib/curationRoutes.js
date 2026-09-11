export const CURATION_HOSTNAME = "curation.abodid.com";
export const CURATION_ORIGIN = `https://${CURATION_HOSTNAME}`;

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
  home: "/",
  login: "/login",
  dashboard: "/dashboard",
  saved: "/saved",
  submit: "/submit",
  authCallback: "/auth/callback",
  admin: "/admin",
  adminReview: "/admin/review",
  adminAnalytics: "/admin/analytics",
  adminUsers: "/admin/users",
  resource: (id) => `/resource/${encodeURIComponent(String(id))}`,
  editResource: (id) => `/resource/${encodeURIComponent(String(id))}/edit`,
  curator: (username) => `/u/${encodeURIComponent(String(username))}`,
});

export const curationUrl = (pathname = "/") =>
  new URL(pathname, `${CURATION_ORIGIN}/`).toString();

/**
 * Convert the legacy /resources namespace to its public curation subdomain path.
 * Unknown descendants are preserved so historic links never collapse to the home page.
 */
export const legacyResourcePathToCurationPath = (pathname) => {
  if (pathname === "/resources" || pathname === "/resources/") return "/";
  if (!pathname.startsWith("/resources/")) return null;

  const suffix = pathname.slice("/resources".length);

  if (suffix === "/curator") return curationPath.admin;
  if (suffix.startsWith("/auth/")) return suffix;
  if (suffix === "/dashboard" || suffix === "/saved" || suffix === "/submit") {
    return suffix;
  }
  if (suffix === "/admin" || suffix.startsWith("/admin/")) return suffix;
  if (suffix.startsWith("/u/")) return suffix;

  const editMatch = suffix.match(/^\/([^/]+)\/edit$/);
  if (editMatch) return curationPath.editResource(decodeURIComponent(editMatch[1]));

  const resourceMatch = suffix.match(/^\/([^/]+)$/);
  if (resourceMatch) return curationPath.resource(decodeURIComponent(resourceMatch[1]));

  return suffix;
};

/** Map a public curation URL to the existing internal Astro route. */
export const curationPathToInternalPath = (pathname) => {
  if (pathname === "/") return "/resources";
  if (pathname === "/robots.txt") return "/curation-robots.txt";
  if (pathname === "/sitemap.xml") return "/curation-sitemap.xml";
  if (pathname === curationPath.dashboard) return "/resources/dashboard";
  if (pathname === curationPath.saved) return "/resources/saved";
  if (pathname === curationPath.submit) return "/resources/submit";
  if (pathname === curationPath.authCallback) return "/resources/auth/callback";
  if (pathname === curationPath.admin) return "/resources/admin";
  if (pathname === curationPath.adminReview) return "/resources/admin/review";
  if (pathname === curationPath.adminAnalytics) return "/resources/admin/analytics";
  if (pathname === curationPath.adminUsers) return "/resources/admin/users";

  const editMatch = pathname.match(/^\/resource\/([^/]+)\/edit$/);
  if (editMatch) return `/resources/${editMatch[1]}/edit`;

  const resourceMatch = pathname.match(/^\/resource\/([^/]+)$/);
  if (resourceMatch) return `/resources/${resourceMatch[1]}`;

  const curatorMatch = pathname.match(/^\/u\/([^/]+)$/);
  if (curatorMatch) return `/resources/u/${curatorMatch[1]}`;

  return null;
};

export const getLegacyResourceRedirect = (url) => {
  if (!isPrimarySiteHostname(url.hostname)) return null;
  const pathname = legacyResourcePathToCurationPath(url.pathname);
  if (!pathname) return null;

  const destination = new URL(pathname, `${CURATION_ORIGIN}/`);
  destination.search = url.search;
  return destination.toString();
};

export const getCurationCanonicalRedirect = (url) => {
  if (!isCurationHostname(url.hostname) || !url.pathname.startsWith("/resources")) {
    return null;
  }

  const pathname = legacyResourcePathToCurationPath(url.pathname);
  if (!pathname) return null;
  const destination = new URL(pathname, `${CURATION_ORIGIN}/`);
  destination.search = url.search;
  return destination.toString();
};

/**
 * Keep post-auth navigation on the curation origin. This rejects protocol-relative,
 * absolute, encoded-host, and legacy main-site destinations.
 */
export const safeCurationReturnTo = (value, fallback = curationPath.dashboard) => {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) {
    return fallback;
  }

  try {
    const parsed = new URL(value, `${CURATION_ORIGIN}/`);
    if (parsed.origin !== CURATION_ORIGIN) return fallback;
    const migratedPath = legacyResourcePathToCurationPath(parsed.pathname);
    if (migratedPath) {
      parsed.pathname = migratedPath;
    }
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
};

export const isCurationOnlyPath = (pathname = "") => {
  if (curationPathToInternalPath(pathname)) return true;
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
  if (isCurationOnlyPath(url.pathname)) return null;
  return `https://abodid.com${url.pathname}${url.search}`;
};

