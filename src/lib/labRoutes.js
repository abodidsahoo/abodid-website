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
