export const LAB_HOSTNAME = "lab.abodid.com";
export const LAB_ORIGIN = `https://${LAB_HOSTNAME}`;

const PRIMARY_SITE_HOSTNAMES = new Set(["abodid.com", "www.abodid.com"]);

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

  for (const publicBase of ["/punctum", "/image-flick", "/photo-board"]) {
    const internalBase = `/lab${publicBase}`;
    if (pathname === internalBase || pathname.startsWith(`${internalBase}/`)) {
      const publicPath = pathname.slice("/lab".length);
      return `${LAB_ORIGIN}${publicPath}${url.search}`;
    }
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
  if (url.pathname === "/punctum" || url.pathname.startsWith("/punctum/")) {
    return `/lab${url.pathname}`;
  }
  if (url.pathname === "/image-flick" || url.pathname.startsWith("/image-flick/")) {
    return `/lab${url.pathname}`;
  }
  if (url.pathname === "/photo-board" || url.pathname.startsWith("/photo-board/")) {
    return `/lab${url.pathname}`;
  }
  return null;
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
  if (labDestination({ hostname: LAB_HOSTNAME, pathname })) return true;
  if (pathname === "/robots.txt" || pathname === "/sitemap.xml") return true;
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

export const getLabSubdomainRedirect = (url) => {
  if (!isLabHostname(url.hostname)) return null;
  if (isLabOnlyPath(url.pathname)) return null;
  return `https://abodid.com${url.pathname}${url.search}`;
};
