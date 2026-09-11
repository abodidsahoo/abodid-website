const legacyLabRoutes = [
  ["/research/lab", "/lab"],
  ["/research/punctum", "/lab/punctum"],
  ["/punctum", "/lab/punctum"],
  ["/research/gesture-image-preview", "/lab/image-flick"],
  ["/research/polaroid-hub", "/lab/photo-board"],
];

const withoutTrailingSlash = (pathname) =>
  pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;

export const legacyLabRedirectLocation = (url) => {
  const pathname = withoutTrailingSlash(url.pathname);

  for (const [legacyBase, labBase] of legacyLabRoutes) {
    if (pathname !== legacyBase && !pathname.startsWith(`${legacyBase}/`)) continue;

    let suffix = pathname.slice(legacyBase.length);

    if (legacyBase === "/research/gesture-image-preview" && suffix === "/launch") {
      suffix = "";
    }

    if (legacyBase === "/research/polaroid-hub" && suffix === "/the-hub") {
      suffix = "";
    }

    return `${labBase}${suffix}${url.search}`;
  }

  return null;
};

export const LAB_HOSTNAME = "lab.abodid.com";

const normalizeHostname = (hostname = "") =>
  hostname.trim().toLowerCase().replace(/:\d+$/, "");

export const isLabHostname = (hostname) => {
  const norm = normalizeHostname(hostname);
  return norm === LAB_HOSTNAME || norm === "lab.localhost";
};

export const labDestination = (url) => {
  if (!isLabHostname(url.hostname)) return null;
  if (url.pathname === "/") return "/lab";
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

