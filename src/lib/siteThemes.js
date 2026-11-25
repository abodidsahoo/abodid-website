import { SITE_CORNER_FIELDS } from "./designTokens.js";

export const SITE_THEME_FIELDS = "id,name,background,foreground,corners,header_footer_style";
export const SITE_THEME_PREVIEW_EVENT = "site-theme:preview";
export const SITE_THEME_PUBLISHED_EVENT = "site-theme:published";
export const DESIGN_TOKEN_CACHE_KEY = "abodid-published-design-tokens-v1";

export const ORIGINAL_SITE_THEME = {
  id: "00000000-0000-4000-8000-000000000001",
  name: "Original",
  background: null,
  foreground: null,
  corners: { style: "rounded", radii: {} },
  header_footer_style: "boxed",
};

export function normaliseHeaderFooterStyle(style) {
  return style === "lines" ? "lines" : "boxed";
}

export function normaliseThemeCorners(corners) {
  const radii = {};
  for (const { name, min, max } of SITE_CORNER_FIELDS) {
    const value = corners?.radii?.[name];
    if (value === "" || value == null) continue;
    const radius = Number(value);
    if (Number.isFinite(radius)) radii[name] = Math.min(max, Math.max(min, radius));
  }
  return { style: corners?.style === "sharp" ? "sharp" : "rounded", radii };
}

export function sameSiteTheme(first, second) {
  first ??= ORIGINAL_SITE_THEME;
  second ??= ORIGINAL_SITE_THEME;
  return ["id", "name", "background", "foreground"].every((field) => first[field] === second[field])
    && normaliseHeaderFooterStyle(first.header_footer_style) === normaliseHeaderFooterStyle(second.header_footer_style)
    && JSON.stringify(normaliseThemeCorners(first.corners)) === JSON.stringify(normaliseThemeCorners(second.corners));
}

const independentlyStyledRoutes = [
  "/admin",
  "/archive",
  "/podcast",
  "/creative-database",
  "/curation/creative-database",
  "/architecture/punctum",
  "/lab/art-in-every-corner",
  "/lab/audio-visualiser",
  "/lab/glyph-loom",
  "/lab/image-flick",
  "/lab/obsidian-tags-interactive-explorer",
  "/lab/punctum",
  "/lab/sequence-room",
  "/research/glyph-loom",
  "/research/invisible-punctum",
  "/research/invisible-punctum-experiment",
  "/research/tensorflow-gesture-controls",
  "/research/tensorflow-hidden-composition",
  "/august-2026",
  "/home-next",
  "/july-backup",
  "/moodboard-old",
];

export function usesSiteTheme(pathname) {
  return !independentlyStyledRoutes.some((route) => pathname === route || pathname.startsWith(route + "/"));
}
