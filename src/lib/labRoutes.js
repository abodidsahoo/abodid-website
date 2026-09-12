export const LAB_HOSTNAME = "lab.abodid.com";
export const LAB_ORIGIN = `https://${LAB_HOSTNAME}`;

const PRIMARY_SITE_HOSTNAMES = new Set(["abodid.com", "www.abodid.com"]);

const PRIMARY_SITE_PATHS = [
  "/about",
  "/blog",
  "/contact",
  "/cv",
  "/films",
  "/life",
  "/manifesto",
  "/obsidian-vault",
  "/photography",
  "/press",
  "/research",
  "/services",
  "/studio",
  "/work",
];

const SHARED_PATHS = [
  "/_astro",
  "/_image",
  "/api",
  "/assets",
  "/audio",
  "/fonts",
  "/icons",
  "/images",
  "/scripts",
  "/sounds",
];

const legacyLabRoutes = [
  ["/research/lab", "/"],
  ["/research/punctum", "/punctum"],
  ["/punctum", "/punctum"],
  ["/research/gesture-image-preview", "/image-flick"],
  ["/research/polaroid-hub", "/photo-board"],
];

const withoutTrailingSlash = (pathname) =>
  pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;

export const legacyLabRedirectLocation = (url) => {
  if (!PRIMARY_SITE_HOSTNAMES.has(normalizeHostname(url.hostname))) return null;

  const pathname = withoutTrailingSlash(url.pathname);

  if (pathname === "/lab") {
    return `${LAB_ORIGIN}/${url.search}`;
  }

  if (pathname.startsWith("/lab/")) {
    const publicPath = pathname.slice("/lab".length);
    return `${LAB_ORIGIN}${publicPath}${url.search}`;
  }

  for (const [legacyBase, publicBase] of legacyLabRoutes) {
    if (pathname !== legacyBase && !pathname.startsWith(`${legacyBase}/`)) continue;

    let suffix = pathname.slice(legacyBase.length);

    if (legacyBase === "/research/gesture-image-preview" && suffix === "/launch") {
      suffix = "";
    }

    if (legacyBase === "/research/polaroid-hub" && suffix === "/the-hub") {
      suffix = "";
    }

    return `${LAB_ORIGIN}${publicBase}${suffix}${url.search}`;
  }

  return null;
};

const normalizeHostname = (hostname = "") =>
  hostname.trim().toLowerCase().replace(/:\d+$/, "");

export const isLabHostname = (hostname) => {
  const norm = normalizeHostname(hostname);
  return norm === LAB_HOSTNAME || norm === "lab.localhost";
};

export const labDestination = (url) => {
  if (!isLabHostname(url.hostname)) return null;
  if (url.pathname === "/") return "/lab";
  if (url.pathname === "/robots.txt") return "/lab-robots.txt";
  if (url.pathname === "/sitemap.xml") return "/lab-sitemap.xml";
  if (isSharedPath(url.pathname) || isPrimarySitePath(url.pathname)) return null;

  // Every route stored under src/pages/lab is automatically exposed at the
  // same path on the Lab subdomain. New experiments do not need an allowlist.
  return `/lab${url.pathname}`;
};

export const labPublicPath = (pathname = "/") => {
  const normalized = withoutTrailingSlash(pathname) || "/";
  if (normalized === "/lab") return "/";
  if (normalized.startsWith("/lab/")) return normalized.slice("/lab".length);
  return normalized;
};

export const labUrl = (pathname = "/") =>
  new URL(labPublicPath(pathname), `${LAB_ORIGIN}/`).toString();

export const getLabCanonicalRedirect = (url) => {
  if (!isLabHostname(url.hostname)) return null;
  if (url.pathname !== "/lab" && !url.pathname.startsWith("/lab/")) return null;

  const destination = new URL(labPublicPath(url.pathname), `${LAB_ORIGIN}/`);
  destination.search = url.search;
  return destination.toString();
};

export const isLabOnlyPath = (pathname = "") => {
  if (pathname === "/robots.txt" || pathname === "/sitemap.xml") return true;
  return !isPrimarySitePath(pathname);
};

export const getLabSubdomainRedirect = (url) => {
  if (!isLabHostname(url.hostname)) return null;
  if (!isPrimarySitePath(url.pathname)) return null;
  return `https://abodid.com${url.pathname}${url.search}`;
};

const matchesPathBase = (pathname, base) =>
  pathname === base || pathname.startsWith(`${base}/`);

const isPrimarySitePath = (pathname = "") =>
  PRIMARY_SITE_PATHS.some((base) => matchesPathBase(pathname, base));

const isSharedPath = (pathname = "") =>
  pathname === "/favicon.ico" ||
  pathname === "/favicon.svg" ||
  pathname === "/llms.txt" ||
  SHARED_PATHS.some((base) => matchesPathBase(pathname, base)) ||
  /\.[a-z0-9]{1,8}$/i.test(pathname);
