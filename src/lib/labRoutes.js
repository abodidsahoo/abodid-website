export const LAB_HOSTNAME = "lab.abodid.com";
export const PRIMARY_ORIGIN = "https://abodid.com";
export const LAB_ORIGIN = `${PRIMARY_ORIGIN}/lab`;

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

const legacyLabRoutes = [
  ["/research/lab", ""],
  ["/research/punctum", "/punctum"],
  ["/punctum", "/punctum"],
  ["/research/gesture-image-preview", "/image-flick"],
  ["/research/polaroid-hub", "/photo-board"],
];

const withoutTrailingSlash = (pathname) =>
  pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;

const normalizeHostname = (hostname = "") =>
  hostname.trim().toLowerCase().replace(/:\d+$/, "");

export const isLabHostname = (hostname) => {
  const norm = normalizeHostname(hostname);
  return norm === LAB_HOSTNAME || norm === "lab.localhost";
};

export const labPublicPath = (pathname = "/") => {
  const normalized = withoutTrailingSlash(pathname) || "/";
  if (normalized === "/" || normalized === "/lab") return "/lab";
  if (normalized.startsWith("/lab/")) return normalized;
  return `/lab${normalized.startsWith("/") ? "" : "/"}${normalized}`;
};

export const labUrl = (pathname = "/") =>
  new URL(labPublicPath(pathname), `${PRIMARY_ORIGIN}/`).toString();

export const legacyLabRedirectLocation = (url) => {
  if (!PRIMARY_SITE_HOSTNAMES.has(normalizeHostname(url.hostname))) return null;

  const pathname = withoutTrailingSlash(url.pathname);

  // Do not redirect /lab or /lab/* on the primary site
  if (pathname === "/lab" || pathname.startsWith("/lab/")) {
    return null;
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

    const targetLabPath = `/lab${publicBase}${suffix}`;
    return `${PRIMARY_ORIGIN}${withoutTrailingSlash(targetLabPath)}${url.search}`;
  }

  return null;
};

export const getLabCanonicalRedirect = (url) => {
  if (!isLabHostname(url.hostname)) return null;
  const dest = getLabSubdomainRedirect(url);
  return dest;
};

export const getLabSubdomainRedirect = (url) => {
  if (!isLabHostname(url.hostname)) return null;
  const pathname = withoutTrailingSlash(url.pathname);
  if (pathname === "" || pathname === "/" || pathname === "/lab") {
    return `${PRIMARY_ORIGIN}/lab${url.search}`;
  }
  if (pathname === "/robots.txt" || pathname === "/sitemap.xml") {
    return `${PRIMARY_ORIGIN}${pathname}${url.search}`;
  }
  if (isPrimarySitePath(pathname)) {
    return `${PRIMARY_ORIGIN}${pathname}${url.search}`;
  }
  if (pathname.startsWith("/lab/")) {
    return `${PRIMARY_ORIGIN}${pathname}${url.search}`;
  }
  return `${PRIMARY_ORIGIN}/lab${pathname}${url.search}`;
};

export const labDestination = (url) => {
  if (!isLabHostname(url.hostname)) return null;
  return labPublicPath(url.pathname);
};

const matchesPathBase = (pathname, base) =>
  pathname === base || pathname.startsWith(`${base}/`);

const isPrimarySitePath = (pathname = "") =>
  PRIMARY_SITE_PATHS.some((base) => matchesPathBase(pathname, base));

