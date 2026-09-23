export const DESIGN_TOKEN_GROUPS = [
  {
    id: "colour",
    label: "Colors",
    description: "The shared chromatic language used by the public site, editorial pages, cards and calls to action.",
    sections: [
      {
        label: "Pop Editorial palette",
        tokens: [
          ["--pop-blue", "Cobalt", "#2444ca"],
          ["--pop-pink", "Hot pink", "#ff7eb5"],
          ["--pop-yellow", "Acid yellow", "#ffe44f"],
          ["--pop-lime", "Lime", "#caff48"],
          ["--pop-orange", "Orange", "#ff875c"],
          ["--pop-purple", "Purple", "#5524c7"],
          ["--pop-cyan", "Cyan", "#62e6ff"],
          ["--pop-cream", "Warm cream", "#fff8e8"],
          ["--pop-white", "White", "#ffffff"],
          ["--pop-ink", "Ink", "#15130f"],
        ].map(([name, label, defaultValue]) => ({ name, label, defaultValue, type: "color" })),
      },
      {
        label: "Site surfaces",
        tokens: [
          ["--dark-page-bg", "Dark canvas", "#040404"],
          ["--dark-surface-bg", "Dark surface", "#0a0a0a"],
          ["--dark-text-primary", "Dark-mode text", "#f8fafc"],
          ["--light-page-bg", "Light canvas", "#f8fafc"],
          ["--light-surface-bg", "Light surface", "#ffffff"],
          ["--light-text-primary", "Light-mode text", "#0f172a"],
        ].map(([name, label, defaultValue]) => ({ name, label, defaultValue, type: "color" })),
      },
    ],
  },
  {
    id: "typography",
    label: "Typography",
    description: "Responsive sizes, weights, line heights and tracking shared by text pages, Obsidian, research, cards and editorial surfaces.",
    sections: [
      {
        label: "Display / masthead",
        tokens: typographyRole("display", { min: 3, fluid: 6.7, max: 7, weight: 620, line: 0.9, track: -0.065 }),
      },
      {
        label: "Page title",
        tokens: typographyRole("page-title", { min: 2.5, fluid: 4.8, max: 5, weight: 620, line: 0.98, track: -0.05 }),
      },
      {
        label: "Section title",
        tokens: typographyRole("section-title", { min: 2.4, fluid: 4, max: 4, weight: 620, line: 0.98, track: -0.05 }),
      },
      {
        label: "Card title",
        tokens: typographyRole("card-title", { min: 1.4, fluid: 2.2, max: 1.9, weight: 720, line: 1.15, track: -0.04 }),
      },
      {
        label: "Body copy",
        tokens: typographyRole("body", { min: 0.94, fluid: 1.12, max: 1.1, weight: 450, line: 1.5, track: 0 }),
      },
      {
        label: "Long-form reading",
        tokens: typographyRole("reading", { min: 1.05, fluid: 1.45, max: 1.35, weight: 450, line: 1.6, track: 0 }),
      },
      {
        label: "Metadata / eyebrow",
        tokens: [
          numberToken("--ds-label-size", "Size", 0.72, 0.6, 1, 0.01, "rem"),
          numberToken("--ds-label-weight", "Weight", 750, 300, 900, 10),
          numberToken("--ds-label-line", "Line height", 1.35, 0.9, 2, 0.01),
          numberToken("--ds-label-track", "Letter spacing", 0.08, -0.1, 0.2, 0.005, "em"),
        ],
      },
    ],
  },
  {
    id: "layout",
    label: "Layout",
    description: "The shared spacing rhythm that controls page edges, section breathing room and the seams between elements.",
    sections: [
      {
        label: "Spacing",
        tokens: [
          numberToken("--ds-grid-gap", "Grid seam", 8, 0, 32, 1, "px"),
          numberToken("--ds-gutter-min", "Page gutter · minimum", 16, 8, 48, 1, "px"),
          numberToken("--ds-gutter-fluid", "Page gutter · fluid", 3, 1, 8, 0.1, "vw"),
          numberToken("--ds-gutter-max", "Page gutter · maximum", 56, 24, 120, 1, "px"),
          numberToken("--ds-section-block-min", "Section space · minimum", 64, 24, 120, 2, "px"),
          numberToken("--ds-section-block-fluid", "Section space · fluid", 6.5, 2, 14, 0.1, "vw"),
          numberToken("--ds-section-block-max", "Section space · maximum", 112, 48, 200, 2, "px"),
        ],
      },
    ],
  },
  {
    id: "components",
    label: "Components",
    description: "The shape language shared by panels, cards, buttons, controls and inset media across the site.",
    sections: [
      {
        label: "Corners & inset",
        tokens: [
          numberToken("--ds-radius-panel", "Panel radius", 24, 0, 48, 1, "px"),
          numberToken("--ds-radius-card", "Card radius", 18, 0, 40, 1, "px"),
          numberToken("--ds-radius-control", "Control radius", 14, 0, 28, 1, "px"),
          numberToken("--ds-radius-media", "Media radius", 14, 0, 32, 1, "px"),
          numberToken("--ds-card-inset", "Card media inset", 10, 0, 32, 1, "px"),
        ],
      },
    ],
  },
];

/**
 * Pop Editorial surface contracts.
 *
 * Components choose a named surface; the foreground is not independently
 * styled. This keeps colour pairings predictable and lets Design Studio block
 * an unsafe palette before it is published.
 */
export const POP_SURFACE_CONTRACTS = [
  { id: "cream", label: "Cream", surfaceToken: "--pop-cream", foregroundToken: "--pop-ink", tone: "light" },
  { id: "white", label: "White", surfaceToken: "--pop-white", foregroundToken: "--pop-ink", tone: "light" },
  { id: "pink", label: "Pink", surfaceToken: "--pop-pink", foregroundToken: "--pop-ink", tone: "light" },
  { id: "yellow", label: "Yellow", surfaceToken: "--pop-yellow", foregroundToken: "--pop-ink", tone: "light" },
  { id: "lime", label: "Lime", surfaceToken: "--pop-lime", foregroundToken: "--pop-ink", tone: "light" },
  { id: "orange", label: "Orange", surfaceToken: "--pop-orange", foregroundToken: "--pop-ink", tone: "light" },
  { id: "cyan", label: "Cyan", surfaceToken: "--pop-cyan", foregroundToken: "--pop-ink", tone: "light" },
  { id: "blue", label: "Cobalt", surfaceToken: "--pop-blue", foregroundToken: "--pop-cream", tone: "deep" },
  { id: "purple", label: "Purple", surfaceToken: "--pop-purple", foregroundToken: "--pop-cream", tone: "deep" },
];

export const MINIMUM_TEXT_CONTRAST = 4.5;

function numberToken(name, label, defaultValue, min, max, step, unit = "") {
  return { name, label, defaultValue: String(defaultValue), type: "number", min, max, step, unit };
}

function typographyRole(role, values) {
  return [
    numberToken(`--ds-${role}-min`, "Minimum size", values.min, 0.6, 8, 0.05, "rem"),
    numberToken(`--ds-${role}-fluid`, "Fluid size", values.fluid, 0.5, 14, 0.1, "vw"),
    numberToken(`--ds-${role}-max`, "Maximum size", values.max, 0.8, 10, 0.05, "rem"),
    numberToken(`--ds-${role}-weight`, "Weight", values.weight, 300, 900, 10),
    numberToken(`--ds-${role}-line`, "Line height", values.line, 0.75, 2, 0.01),
    numberToken(`--ds-${role}-track`, "Letter spacing", values.track, -0.12, 0.2, 0.005, "em"),
  ];
}

export const DESIGN_TOKEN_FIELDS = DESIGN_TOKEN_GROUPS.flatMap((group) =>
  group.sections.flatMap((section) => section.tokens),
);

export const DESIGN_TOKEN_NAMES = DESIGN_TOKEN_FIELDS.map((token) => token.name);

export const DEFAULT_DESIGN_TOKENS = Object.fromEntries(
  DESIGN_TOKEN_FIELDS.map((token) => [token.name, String(token.defaultValue)]),
);

export function normaliseDesignTokens(candidate = {}) {
  const fields = new Map(DESIGN_TOKEN_FIELDS.map((field) => [field.name, field]));
  const result = { ...DEFAULT_DESIGN_TOKENS };

  for (const [name, rawValue] of Object.entries(candidate || {})) {
    const field = fields.get(name);
    if (!field) continue;

    if (field.type === "color") {
      const value = String(rawValue).trim();
      if (/^#[0-9a-f]{6}$/i.test(value)) result[name] = value.toLowerCase();
      continue;
    }

    const numericValue = Number(rawValue);
    if (!Number.isFinite(numericValue)) continue;
    result[name] = String(Math.min(field.max, Math.max(field.min, numericValue)));
  }

  return result;
}

export function contrastRatio(first, second) {
  const luminance = (hex) => {
    if (!/^#[0-9a-f]{6}$/i.test(String(hex))) return 0;
    const channels = String(hex).slice(1).match(/.{2}/g).map((part) => parseInt(part, 16) / 255);
    const [red, green, blue] = channels.map((value) => (
      value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
    ));
    return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
  };

  const a = luminance(first);
  const b = luminance(second);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

export function evaluateSurfaceContracts(candidate = {}, minimum = MINIMUM_TEXT_CONTRAST) {
  const tokens = normaliseDesignTokens(candidate);
  return POP_SURFACE_CONTRACTS.map((contract) => {
    const background = tokens[contract.surfaceToken];
    const foreground = tokens[contract.foregroundToken];
    const ratio = contrastRatio(foreground, background);
    return { ...contract, background, foreground, ratio, passes: ratio >= minimum };
  });
}
