const ROUTES = {
  research: { label: "Research", href: "/research" },
  vault: { label: "Obsidian Vault", href: "/obsidian-vault" },
  vaultDirectory: { label: "Vault directory", href: "/obsidian-vault/directory" },
  writing: { label: "Writing", href: "/blog" },
  work: { label: "Portfolio", href: "/work" },
  photography: { label: "Photography", href: "/photography" },
  studio: { label: "Design Studio", href: "/admin" },
};

const surfaceDefinitions = {
  "--color-primary": ["Primary colour", "blue", "Navigation, site canvas and structural bands. Uses the background colour for text.", [ROUTES.work, ROUTES.research]],
  "--color-secondary": ["Secondary colour", "pink", "Editorial introductions, writing sections and supporting panels. Uses the text colour.", [ROUTES.research, ROUTES.writing]],
  "--color-button": ["Button colour", "yellow", "Primary buttons, active controls, badges and highlighted cards. Uses the text colour.", [ROUTES.research, ROUTES.vault]],
  "--color-accent": ["Accent colour", "lime", "Occasional action panels, hover states and navigation cards. Uses the text colour.", [ROUTES.research, ROUTES.vault]],
  "--color-additional-1": ["Additional Colour 1", "orange", "Supporting cards, notices and secondary accent blocks. Uses the text colour.", [ROUTES.research, ROUTES.studio]],
  "--color-additional-2": ["Additional Colour 2", "purple", "Enquiry forms, closing bands and focus outlines. Uses the background colour for text.", [ROUTES.research, ROUTES.vault]],
  "--color-additional-3": ["Additional Colour 3", "cyan", "Optional cards and supporting highlights. Uses the text colour.", [ROUTES.research, ROUTES.work]],
  "--color-background": ["Background colour", "cream", "Reading panels, form fields and text on primary or Additional Colour 2 surfaces.", [ROUTES.research, ROUTES.vault]],
  "--color-surface": ["Raised surface colour", "white", "Utility controls and neutral cards. Uses the text colour.", [ROUTES.research, ROUTES.studio]],
  "--color-text": ["Text colour", "cream", "Shared text, icons and keylines on the lighter surfaces.", [ROUTES.research, ROUTES.vault]],
  "--color-button-text": ["Button text colour", "yellow", "Labels and icons on shared action buttons. Hover and pressed states follow the button colour.", [ROUTES.work, ROUTES.studio]],
  "--color-primary-text": ["Primary surface text colour", "blue", "Labels and copy on primary and deep supporting surfaces.", [ROUTES.work, ROUTES.research]],
  "--color-success": ["Success colour", "cream", "Shared success indicators and form feedback.", [ROUTES.studio]],
  "--color-error": ["Error colour", "cream", "Shared validation and failure indicators.", [ROUTES.studio]],
};

const usage = Object.fromEntries(Object.entries(surfaceDefinitions).map(([name, [title, surface, summary, routes]]) => [name, {
  title,
  summary,
  previewKind: "surface",
  surface,
  routes,
  selector: `[data-pop-surface="${surface}"]`,
  html: `<article data-pop-surface="${surface}">\n  <h2>Editorial title</h2>\n  <p>Supporting copy inherits the safe foreground.</p>\n</article>`,
  css: `[data-pop-surface="${surface}"] {\n  background: var(${name});\n  color: var(--surface-fg);\n}`,
}]));

const themeTokens = {
  "--dark-page-bg": ["Dark canvas", "The outer canvas used when the site is in dark mode.", "dark", ROUTES.studio],
  "--dark-surface-bg": ["Dark raised surface", "Panels and cards raised above the dark canvas.", "dark", ROUTES.studio],
  "--dark-text-primary": ["Dark-mode primary text", "The main readable foreground used on dark canvas and surfaces.", "dark", ROUTES.studio],
  "--light-page-bg": ["Light canvas", "The outer canvas used when the site is in light mode.", "light", ROUTES.vaultDirectory],
  "--light-surface-bg": ["Light raised surface", "Panels and cards raised above the light canvas.", "light", ROUTES.vaultDirectory],
  "--light-text-primary": ["Light-mode primary text", "The main readable foreground used on light canvas and surfaces.", "light", ROUTES.vaultDirectory],
};

for (const [name, [title, summary, theme, route]] of Object.entries(themeTokens)) {
  usage[name] = {
    title,
    summary,
    previewKind: "theme",
    theme,
    routes: [route, ROUTES.studio],
    selector: theme === "dark" ? ':root:not([data-theme="light"])' : ':root[data-theme="light"]',
    html: `<section class="site-surface">\n  <h2>Interface panel</h2>\n  <p>Theme-aware supporting text.</p>\n</section>`,
    css: `.site-surface {\n  background: var(--bg-surface);\n  color: var(--text-primary);\n}`,
  };
}

const typeRoles = {
  display: {
    title: "Display / masthead",
    summary: "The largest editorial voice for major landing-page statements.",
    routes: [ROUTES.research, ROUTES.vault],
    selector: ".rp-hero h1, .vault-heading-panel h1",
    sample: "Research is a way of paying attention.",
    tag: "h1",
  },
  "page-title": {
    title: "Page title",
    summary: "The primary heading used when a page needs a clear title below the masthead scale.",
    routes: [ROUTES.vaultDirectory, ROUTES.writing],
    selector: ".vault-directory h1, .paper-hero h1",
    sample: "A directory of connected ideas",
    tag: "h1",
  },
  "section-title": {
    title: "Section title",
    summary: "The heading that separates major chapters within a page.",
    routes: [ROUTES.research, ROUTES.vault],
    selector: ".rp-proof-strip h2, .vault-panel h2",
    sample: "What the work makes visible",
    tag: "h2",
  },
  "card-title": {
    title: "Card title",
    summary: "The compact editorial heading used inside research, writing and resource cards.",
    routes: [ROUTES.research, ROUTES.vaultDirectory],
    selector: ".rp-card h3, .vault-note-card h2",
    sample: "Archives can become living interfaces",
    tag: "h3",
  },
  body: {
    title: "Body copy",
    summary: "The default supporting text used in cards, introductions and interface explanations.",
    routes: [ROUTES.research, ROUTES.writing],
    selector: ".rp-card__premise, .blog-card-summary",
    sample: "A clear supporting paragraph should remain relaxed, readable and subordinate to its heading.",
    tag: "p",
  },
  reading: {
    title: "Long-form reading",
    summary: "A more generous text setting for essays, research papers and Obsidian notes.",
    routes: [ROUTES.vault, ROUTES.research],
    selector: ".vault-note-content, .paper-reading-copy p",
    sample: "Long-form reading needs enough line height and a measured width so sustained attention feels effortless rather than compressed.",
    tag: "p",
  },
  label: {
    title: "Metadata / eyebrow",
    summary: "Compact uppercase context used for dates, categories, counts and editorial labels.",
    routes: [ROUTES.research, ROUTES.vault],
    selector: ".rp-eyebrow, .vault-eyebrow",
    sample: "Research note · September 2026",
    tag: "span",
  },
};

for (const [role, definition] of Object.entries(typeRoles)) {
  const names = role === "label"
    ? ["--ds-label-size", "--ds-label-weight", "--ds-label-line", "--ds-label-track"]
    : ["min", "fluid", "max", "weight", "line", "track"].map((part) => `--ds-${role}-${part}`);
  for (const name of names) {
    usage[name] = {
      ...definition,
      previewKind: "type",
      role,
      html: `<${definition.tag} class="type-${role}">${definition.sample}</${definition.tag}>`,
      css: `.type-${role} {\n  font-size: var(--type-role-${role}-size);\n  font-weight: var(--type-role-${role}-weight);\n  line-height: var(--type-role-${role}-line);\n  letter-spacing: var(--type-role-${role}-track);\n}`,
    };
  }
}

Object.assign(usage, {
  "--ds-grid-gap": {
    title: "Grid seam",
    summary: "The narrow structural seam separating adjacent cards and panels.",
    previewKind: "grid-gap",
    routes: [ROUTES.research, ROUTES.photography],
    selector: ".rp-grid, .pe-curated-grid",
    html: `<div class="card-grid">\n  <article>Card one</article>\n  <article>Card two</article>\n</div>`,
    css: `.card-grid {\n  display: grid;\n  gap: var(--design-grid-gap);\n}`,
  },
  "--ds-gutter-min": layoutUsage("Page gutter", "The smallest safe distance between the viewport edge and page content.", "gutter"),
  "--ds-gutter-fluid": layoutUsage("Page gutter", "How quickly the page edge spacing grows with the viewport.", "gutter"),
  "--ds-gutter-max": layoutUsage("Page gutter", "The largest edge spacing allowed on wide screens.", "gutter"),
  "--ds-section-block-min": layoutUsage("Section spacing", "The minimum vertical breathing room inside an editorial section.", "section-space"),
  "--ds-section-block-fluid": layoutUsage("Section spacing", "How quickly section breathing room grows with the viewport.", "section-space"),
  "--ds-section-block-max": layoutUsage("Section spacing", "The maximum vertical breathing room on wide screens.", "section-space"),
  "--ds-radius-panel": componentUsage("Panel radius", "The outside corner shape for major colored sections and large workspace panels.", "panel-radius", ".rp-panel", [ROUTES.research, ROUTES.studio], "--design-radius-panel"),
  "--ds-radius-card": componentUsage("Card radius", "The corner shape for repeatable cards inside a larger section.", "card-radius", ".rp-card", [ROUTES.research, ROUTES.vaultDirectory], "--design-radius-card"),
  "--ds-radius-control": componentUsage("Control radius", "The corner shape shared by buttons, inputs and compact controls.", "control-radius", ".rp-button", [ROUTES.research, ROUTES.studio], "--design-radius-control"),
  "--ds-radius-media": componentUsage("Media radius", "The inner corner shape for images and videos placed inside cards.", "media-radius", ".rp-case__media", [ROUTES.research, ROUTES.photography], "--design-radius-media"),
  "--ds-card-inset": componentUsage("Card media inset", "The space between a card edge and its inset image or video.", "card-inset", ".rp-case__gallery figure", [ROUTES.research, ROUTES.work], "--design-card-inset"),
});

function layoutUsage(title, summary, previewKind) {
  const variable = previewKind === "gutter" ? "--design-page-gutter" : "--design-section-block";
  const selector = previewKind === "gutter" ? ".rp-projects" : ".rp-proof-strip";
  return {
    title,
    summary,
    previewKind,
    routes: [ROUTES.research, ROUTES.vault],
    selector,
    html: `<section class="editorial-section">\n  <h2>Section title</h2>\n  <p>Section content</p>\n</section>`,
    css: `.editorial-section {\n  padding-inline: var(--design-page-gutter);\n  padding-block: var(--design-section-block);\n}`,
    variable,
  };
}

function componentUsage(title, summary, previewKind, selector, routes, variable) {
  return {
    title,
    summary,
    previewKind,
    routes,
    selector,
    html: `<article class="specimen-card">\n  <div class="specimen-card__media"></div>\n  <h3>Editorial card</h3>\n</article>`,
    css: `.specimen-card {\n  border-radius: var(${variable});\n}`,
  };
}

export const DESIGN_TOKEN_USAGE = usage;

export function getDesignTokenUsage(name) {
  return DESIGN_TOKEN_USAGE[name] || {
    title: "Design token",
    summary: "This value is shared by the design system.",
    previewKind: "surface",
    surface: "cream",
    routes: [ROUTES.studio],
    selector: ":root",
    html: "<!-- Shared design token -->",
    css: `:root {\n  ${name}: value;\n}`,
  };
}
