export type TypographyUnit = "rem" | "em";
export type ButtonStyle = "outline" | "accent" | "dark_accent";
export type ThemeMode = "dark" | "light";
export type FeatureTypographySlotId =
    | "typewriterMain"
    | "typewriterText"
    | "typewriterBio"
    | "landingPhotoCta"
    | "landingPhotoOverlayTitle"
    | "landingPhotoOverlayMeta"
    | "landingWritingTitle"
    | "landingWritingDate"
    | "landingWritingCategory"
    | "landingWritingAction"
    | "landingStackPrimaryButton"
    | "landingStackSecondaryButton"
    | "landingStackPeelButton"
    | "landingStackMainText"
    | "landingNavCardTitle"
    | "landingNavCardLink"
    | "newsletterTitle"
    | "newsletterBody"
    | "newsletterInput"
    | "newsletterButton"
    | "newsletterSecondaryLink"
    | "obsidianNoteTitle"
    | "obsidianTag"
    | "obsidianNoteBody";
export type TypographyTokenId =
    | "h1"
    | "h2"
    | "h3"
    | "h4"
    | "h5"
    | "h6"
    | "paragraph"
    | "small"
    | "custom1"
    | "custom2"
    | "custom3"
    | "custom4";
export type TypographyColorToken =
    | "textPrimary"
    | "textSecondary"
    | "textTertiary"
    | "primary"
    | "secondary"
    | "tertiary"
    | "accent"
    | "custom1"
    | "custom2"
    | "custom3"
    | "custom";
export type TextOverrideColorToken =
    | "primary"
    | "secondary"
    | "tertiary"
    | "accent"
    | "custom1"
    | "custom2"
    | "custom3"
    | "custom";

export interface TextStyleOverrideSetting {
    id: string;
    selector: string;
    route: string;
    enabled: boolean;
    fontId: string;
    size: number;
    unit: TypographyUnit;
    weight: number;
    lineHeight: number;
    letterSpacing: number;
    colorToken: TextOverrideColorToken;
    customColor: string;
}

export interface ThemeModeColorSettings {
    pageBackground: string;
    surfaceBackground: string;
    surfaceHoverBackground: string;
    textPrimary: string;
    textSecondary: string;
    textTertiary: string;
    borderSubtle: string;
    borderStrong: string;
    headerBackground: string;
    headerText: string;
    headerBorder: string;
    footerBackground: string;
    footerText: string;
    footerBorder: string;
    link: string;
    linkHover: string;
    selection: string;
}

export interface TypographyTokenStyleSetting {
    weight: number;
    lineHeight: number;
    letterSpacing: number;
    colorToken: TypographyColorToken;
    customColor: string;
}

export interface FeatureTypographySetting {
    fontId: string;
    size: number;
    unit: TypographyUnit;
    weight: number;
    lineHeight: number;
    letterSpacing: number;
    colorToken: TypographyColorToken;
    customColor: string;
}

export interface SiteDesignSettings {
    typography: {
        unit: TypographyUnit;
        h1: number;
        h2: number;
        h3: number;
        h4: number;
        h5: number;
        h6: number;
        paragraph: number;
        small: number;
        custom1: number;
        custom2: number;
        custom3: number;
        custom4: number;
    };
    fonts: {
        h1: string;
        h2: string;
        h3: string;
        h4: string;
        h5: string;
        h6: string;
        paragraph: string;
        ui: string;
        serif: string;
        custom1: string;
        custom2: string;
        custom3: string;
        custom4: string;
    };
    colors: {
        primary: string;
        secondary: string;
        tertiary: string;
        accent: string;
        custom1: string;
        custom2: string;
        custom3: string;
    };
    modeColors: {
        dark: ThemeModeColorSettings;
        light: ThemeModeColorSettings;
    };
    links: {
        underline: boolean;
        hoverUnderline: boolean;
        hoverColorEnabled: boolean;
        hoverColorToken: TextOverrideColorToken;
    };
    buttons: {
        style: ButtonStyle;
    };
    radius: {
        base: number;
    };
    preferences: {
        autoSave: boolean;
    };
    typeStyles: Record<TypographyTokenId, TypographyTokenStyleSetting>;
    featureTypography: Record<FeatureTypographySlotId, FeatureTypographySetting>;
    textOverrides: Record<string, TextStyleOverrideSetting>;
    experimentalTypeLabels: {
        custom1: string;
        custom2: string;
        custom3: string;
        custom4: string;
    };
}

export const FONT_OPTIONS = [
    { id: "satoshi", label: "Satoshi", stack: '"Satoshi-Variable", "Poppins", sans-serif' },
    { id: "poppins", label: "Poppins", stack: '"Poppins", sans-serif' },
    { id: "inter", label: "Inter", stack: '"Inter", "Helvetica Neue", Arial, sans-serif' },
    { id: "montserrat", label: "Montserrat", stack: '"Montserrat", sans-serif' },
    { id: "space_mono", label: "Space Mono", stack: '"Space Mono", "Inconsolata", monospace' },
    { id: "inconsolata", label: "Inconsolata", stack: '"Inconsolata", monospace' },
    { id: "crimson", label: "Crimson Pro", stack: '"Crimson Pro", Georgia, serif' },
    { id: "pixelify", label: "Pixelify Sans", stack: '"Pixelify Sans", cursive' },
    { id: "vt323", label: "VT323", stack: '"VT323", monospace' },
];

export const BUTTON_STYLE_OPTIONS = [
    {
        id: "outline",
        label: "Style 1 · Outline",
        description: "Thin border with clean text.",
    },
    {
        id: "accent",
        label: "Style 2 · Accent Fill",
        description: "Bright accent-filled button.",
    },
    {
        id: "dark_accent",
        label: "Style 3 · Dark Accent",
        description: "Dark, contrast-driven accent style.",
    },
];

const DEFAULT_DARK_MODE_COLORS: ThemeModeColorSettings = {
    pageBackground: "#050505",
    surfaceBackground: "#0f0f0f",
    surfaceHoverBackground: "#1a1a1a",
    textPrimary: "#ffffff",
    textSecondary: "#a0a0a0",
    textTertiary: "#555555",
    borderSubtle: "#222222",
    borderStrong: "#444444",
    headerBackground: "#050505",
    headerText: "#ffffff",
    headerBorder: "#2e2e2e",
    footerBackground: "#000000",
    footerText: "#ffffff",
    footerBorder: "#2e2e2e",
    link: "#ea2a10",
    linkHover: "#ff4d30",
    selection: "#ff4d30",
};

const DEFAULT_LIGHT_MODE_COLORS: ThemeModeColorSettings = {
    pageBackground: "#ffffff",
    surfaceBackground: "#ffffff",
    surfaceHoverBackground: "#f4f4f4",
    textPrimary: "#000000",
    textSecondary: "#333333",
    textTertiary: "#555555",
    borderSubtle: "#e0e0e0",
    borderStrong: "#000000",
    headerBackground: "#ffffff",
    headerText: "#000000",
    headerBorder: "#d8d8d8",
    footerBackground: "#ffffff",
    footerText: "#111111",
    footerBorder: "#d8d8d8",
    link: "#ea2a10",
    linkHover: "#ff4d30",
    selection: "#ea2a10",
};

const TYPOGRAPHY_TOKENS: TypographyTokenId[] = [
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "paragraph",
    "small",
    "custom1",
    "custom2",
    "custom3",
    "custom4",
];

const DEFAULT_TYPE_STYLES: Record<TypographyTokenId, TypographyTokenStyleSetting> = {
    h1: { weight: 800, lineHeight: 1.08, letterSpacing: -0.03, colorToken: "textPrimary", customColor: "#ffffff" },
    h2: { weight: 600, lineHeight: 1.08, letterSpacing: -0.02, colorToken: "textPrimary", customColor: "#ffffff" },
    h3: { weight: 600, lineHeight: 1.08, letterSpacing: -0.01, colorToken: "textPrimary", customColor: "#ffffff" },
    h4: { weight: 600, lineHeight: 1.1, letterSpacing: 0, colorToken: "textPrimary", customColor: "#ffffff" },
    h5: { weight: 600, lineHeight: 1.12, letterSpacing: 0, colorToken: "textPrimary", customColor: "#ffffff" },
    h6: { weight: 600, lineHeight: 1.15, letterSpacing: 0, colorToken: "textPrimary", customColor: "#ffffff" },
    paragraph: { weight: 400, lineHeight: 1.75, letterSpacing: 0, colorToken: "textPrimary", customColor: "#ffffff" },
    small: { weight: 400, lineHeight: 1.4, letterSpacing: 0, colorToken: "textSecondary", customColor: "#a0a0a0" },
    custom1: { weight: 800, lineHeight: 1.02, letterSpacing: -0.03, colorToken: "textPrimary", customColor: "#ffffff" },
    custom2: { weight: 500, lineHeight: 1.25, letterSpacing: 0.08, colorToken: "textPrimary", customColor: "#ffffff" },
    custom3: { weight: 600, lineHeight: 1.1, letterSpacing: -0.01, colorToken: "textPrimary", customColor: "#ffffff" },
    custom4: { weight: 400, lineHeight: 1.55, letterSpacing: 0, colorToken: "textPrimary", customColor: "#ffffff" },
};

const FEATURE_TYPOGRAPHY_SLOTS: FeatureTypographySlotId[] = [
    "typewriterMain",
    "typewriterText",
    "typewriterBio",
    "landingPhotoCta",
    "landingPhotoOverlayTitle",
    "landingPhotoOverlayMeta",
    "landingWritingTitle",
    "landingWritingDate",
    "landingWritingCategory",
    "landingWritingAction",
    "landingStackPrimaryButton",
    "landingStackSecondaryButton",
    "landingStackPeelButton",
    "landingStackMainText",
    "landingNavCardTitle",
    "landingNavCardLink",
    "newsletterTitle",
    "newsletterBody",
    "newsletterInput",
    "newsletterButton",
    "newsletterSecondaryLink",
    "obsidianNoteTitle",
    "obsidianTag",
    "obsidianNoteBody",
];

const DEFAULT_FEATURE_TYPOGRAPHY: Record<FeatureTypographySlotId, FeatureTypographySetting> = {
    typewriterMain: {
        fontId: "satoshi",
        size: 3.5,
        unit: "rem",
        weight: 700,
        lineHeight: 1.1,
        letterSpacing: 0,
        colorToken: "textPrimary",
        customColor: "#ffffff",
    },
    typewriterText: {
        fontId: "satoshi",
        size: 1.35,
        unit: "em",
        weight: 700,
        lineHeight: 1.1,
        letterSpacing: 0,
        colorToken: "textPrimary",
        customColor: "#ffffff",
    },
    typewriterBio: {
        fontId: "crimson",
        size: 2.2,
        unit: "rem",
        weight: 300,
        lineHeight: 1.2,
        letterSpacing: 0,
        colorToken: "textSecondary",
        customColor: "#a0a0a0",
    },
    landingPhotoCta: {
        fontId: "space_mono",
        size: 0.8,
        unit: "rem",
        weight: 500,
        lineHeight: 1.2,
        letterSpacing: 0.05,
        colorToken: "textTertiary",
        customColor: "#9e9992",
    },
    landingPhotoOverlayTitle: {
        fontId: "space_mono",
        size: 1.4,
        unit: "rem",
        weight: 700,
        lineHeight: 1.1,
        letterSpacing: -0.02,
        colorToken: "textPrimary",
        customColor: "#ffffff",
    },
    landingPhotoOverlayMeta: {
        fontId: "space_mono",
        size: 0.8,
        unit: "rem",
        weight: 400,
        lineHeight: 1.2,
        letterSpacing: 0.1,
        colorToken: "custom",
        customColor: "#00f3ff",
    },
    landingWritingTitle: {
        fontId: "crimson",
        size: 1.5,
        unit: "rem",
        weight: 400,
        lineHeight: 1.2,
        letterSpacing: 0,
        colorToken: "textPrimary",
        customColor: "#ffffff",
    },
    landingWritingDate: {
        fontId: "space_mono",
        size: 0.75,
        unit: "rem",
        weight: 400,
        lineHeight: 1.2,
        letterSpacing: 0.05,
        colorToken: "textTertiary",
        customColor: "#555555",
    },
    landingWritingCategory: {
        fontId: "satoshi",
        size: 0.85,
        unit: "rem",
        weight: 400,
        lineHeight: 1.2,
        letterSpacing: 0,
        colorToken: "textSecondary",
        customColor: "#a0a0a0",
    },
    landingWritingAction: {
        fontId: "space_mono",
        size: 0.8,
        unit: "rem",
        weight: 500,
        lineHeight: 1.2,
        letterSpacing: 0.05,
        colorToken: "textTertiary",
        customColor: "#555555",
    },
    landingStackPrimaryButton: {
        fontId: "space_mono",
        size: 0.98,
        unit: "rem",
        weight: 600,
        lineHeight: 1,
        letterSpacing: 0.05,
        colorToken: "textPrimary",
        customColor: "#ffffff",
    },
    landingStackSecondaryButton: {
        fontId: "space_mono",
        size: 0.69,
        unit: "rem",
        weight: 500,
        lineHeight: 1.2,
        letterSpacing: 0.02,
        colorToken: "textPrimary",
        customColor: "#ffffff",
    },
    landingStackPeelButton: {
        fontId: "space_mono",
        size: 0.72,
        unit: "rem",
        weight: 500,
        lineHeight: 1.2,
        letterSpacing: 0.05,
        colorToken: "textPrimary",
        customColor: "#ffffff",
    },
    landingStackMainText: {
        fontId: "inconsolata",
        size: 0.95,
        unit: "rem",
        weight: 500,
        lineHeight: 1.62,
        letterSpacing: 0,
        colorToken: "textPrimary",
        customColor: "#ffffff",
    },
    landingNavCardTitle: {
        fontId: "space_mono",
        size: 1.1,
        unit: "rem",
        weight: 700,
        lineHeight: 1.2,
        letterSpacing: 0.1,
        colorToken: "textPrimary",
        customColor: "#ffffff",
    },
    landingNavCardLink: {
        fontId: "space_mono",
        size: 0.9,
        unit: "rem",
        weight: 400,
        lineHeight: 1.3,
        letterSpacing: 0.02,
        colorToken: "textSecondary",
        customColor: "#a0a0a0",
    },
    newsletterTitle: {
        fontId: "satoshi",
        size: 1.75,
        unit: "rem",
        weight: 700,
        lineHeight: 1.1,
        letterSpacing: -0.03,
        colorToken: "textPrimary",
        customColor: "#ffffff",
    },
    newsletterBody: {
        fontId: "space_mono",
        size: 0.95,
        unit: "rem",
        weight: 400,
        lineHeight: 1.6,
        letterSpacing: 0,
        colorToken: "textSecondary",
        customColor: "#a0a0a0",
    },
    newsletterInput: {
        fontId: "space_mono",
        size: 0.95,
        unit: "rem",
        weight: 400,
        lineHeight: 1.3,
        letterSpacing: 0,
        colorToken: "textPrimary",
        customColor: "#ffffff",
    },
    newsletterButton: {
        fontId: "space_mono",
        size: 0.85,
        unit: "rem",
        weight: 700,
        lineHeight: 1.2,
        letterSpacing: 0.05,
        colorToken: "textPrimary",
        customColor: "#ffffff",
    },
    newsletterSecondaryLink: {
        fontId: "space_mono",
        size: 0.85,
        unit: "rem",
        weight: 400,
        lineHeight: 1.2,
        letterSpacing: 0,
        colorToken: "textTertiary",
        customColor: "#555555",
    },
    obsidianNoteTitle: {
        fontId: "satoshi",
        size: 1,
        unit: "rem",
        weight: 500,
        lineHeight: 1.3,
        letterSpacing: 0,
        colorToken: "textSecondary",
        customColor: "#8a8a8a",
    },
    obsidianTag: {
        fontId: "satoshi",
        size: 0.85,
        unit: "rem",
        weight: 300,
        lineHeight: 1,
        letterSpacing: 0,
        colorToken: "textSecondary",
        customColor: "#a0a0a0",
    },
    obsidianNoteBody: {
        fontId: "crimson",
        size: 1.05,
        unit: "rem",
        weight: 400,
        lineHeight: 1.7,
        letterSpacing: 0,
        colorToken: "textSecondary",
        customColor: "#a0a0a0",
    },
};

const FEATURE_TYPOGRAPHY_VAR_PREFIX: Record<FeatureTypographySlotId, string> = {
    typewriterMain: "feature-typewriter-main",
    typewriterText: "feature-typewriter-text",
    typewriterBio: "feature-typewriter-bio",
    landingPhotoCta: "feature-photo-cta",
    landingPhotoOverlayTitle: "feature-photo-overlay-title",
    landingPhotoOverlayMeta: "feature-photo-overlay-meta",
    landingWritingTitle: "feature-writing-title",
    landingWritingDate: "feature-writing-date",
    landingWritingCategory: "feature-writing-category",
    landingWritingAction: "feature-writing-action",
    landingStackPrimaryButton: "feature-stack-primary-btn",
    landingStackSecondaryButton: "feature-stack-secondary-btn",
    landingStackPeelButton: "feature-stack-peel-btn",
    landingStackMainText: "feature-stack-main-text",
    landingNavCardTitle: "feature-nav-card-title",
    landingNavCardLink: "feature-nav-card-link",
    newsletterTitle: "feature-newsletter-title",
    newsletterBody: "feature-newsletter-body",
    newsletterInput: "feature-newsletter-input",
    newsletterButton: "feature-newsletter-button",
    newsletterSecondaryLink: "feature-newsletter-secondary-link",
    obsidianNoteTitle: "feature-obsidian-note-title",
    obsidianTag: "feature-obsidian-tag",
    obsidianNoteBody: "feature-obsidian-note-body",
};

export const DEFAULT_DESIGN_SETTINGS: SiteDesignSettings = {
    typography: {
        unit: "rem",
        h1: 4.8,
        h2: 3.2,
        h3: 2.2,
        h4: 1.8,
        h5: 1.4,
        h6: 1.1,
        paragraph: 1.06,
        small: 0.875,
        custom1: 5.6,
        custom2: 0.72,
        custom3: 2.8,
        custom4: 1.35,
    },
    fonts: {
        h1: "satoshi",
        h2: "satoshi",
        h3: "satoshi",
        h4: "satoshi",
        h5: "satoshi",
        h6: "satoshi",
        paragraph: "crimson",
        ui: "space_mono",
        serif: "crimson",
        custom1: "satoshi",
        custom2: "space_mono",
        custom3: "inconsolata",
        custom4: "crimson",
    },
    colors: {
        primary: "#ea2a10",
        secondary: "#f9f8f3",
        tertiary: "#9e9992",
        accent: "#ff4d30",
        custom1: "#ea2a10",
        custom2: "#f9f8f3",
        custom3: "#9e9992",
    },
    modeColors: {
        dark: DEFAULT_DARK_MODE_COLORS,
        light: DEFAULT_LIGHT_MODE_COLORS,
    },
    links: {
        underline: false,
        hoverUnderline: false,
        hoverColorEnabled: false,
        hoverColorToken: "accent",
    },
    buttons: {
        style: "outline",
    },
    radius: {
        base: 10,
    },
    preferences: {
        autoSave: false,
    },
    typeStyles: DEFAULT_TYPE_STYLES,
    featureTypography: DEFAULT_FEATURE_TYPOGRAPHY,
    textOverrides: {},
    experimentalTypeLabels: {
        custom1: "Experimental Display",
        custom2: "Micro Label",
        custom3: "Feature Label",
        custom4: "Editorial Highlight",
    },
};

const FONT_STACKS = FONT_OPTIONS.reduce<Record<string, string>>((acc, item) => {
    acc[item.id] = item.stack;
    return acc;
}, {});

const isObject = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value);

const clampNumber = (
    value: unknown,
    fallback: number,
    min: number,
    max: number,
): number => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(max, Math.max(min, parsed));
};

const normalizeHex = (value: unknown, fallback: string): string => {
    if (typeof value !== "string") return fallback;
    const cleaned = value.trim();
    if (/^#[0-9a-fA-F]{6}$/.test(cleaned)) return cleaned.toLowerCase();
    return fallback;
};

const normalizeFontId = (value: unknown, fallback: string): string => {
    if (typeof value !== "string") return fallback;
    return FONT_STACKS[value] ? value : fallback;
};

const normalizeBoolean = (value: unknown, fallback: boolean): boolean => {
    if (typeof value === "boolean") return value;
    return fallback;
};

const normalizeLabel = (value: unknown, fallback: string): string => {
    if (typeof value !== "string") return fallback;
    const cleaned = value.trim();
    if (!cleaned) return fallback;
    return cleaned.slice(0, 48);
};

const normalizeTypographyColorToken = (value: unknown): TypographyColorToken => {
    if (
        value === "textPrimary" ||
        value === "textSecondary" ||
        value === "textTertiary" ||
        value === "primary" ||
        value === "secondary" ||
        value === "tertiary" ||
        value === "accent" ||
        value === "custom1" ||
        value === "custom2" ||
        value === "custom3" ||
        value === "custom"
    ) {
        return value;
    }
    return "textPrimary";
};

const normalizeTextOverrideColorToken = (value: unknown): TextOverrideColorToken => {
    if (
        value === "primary" ||
        value === "secondary" ||
        value === "tertiary" ||
        value === "accent" ||
        value === "custom1" ||
        value === "custom2" ||
        value === "custom3" ||
        value === "custom"
    ) {
        return value;
    }
    return "accent";
};

const sanitizeSelector = (value: unknown): string => {
    if (typeof value !== "string") return "";
    const cleaned = value.trim();
    if (!cleaned) return "";
    if (cleaned.length > 240) return "";
    if (/[{};]/.test(cleaned)) return "";
    return cleaned;
};

const sanitizeRoute = (value: unknown): string => {
    if (typeof value !== "string") return "";
    const cleaned = value.trim();
    if (!cleaned.startsWith("/")) return "";
    return cleaned.slice(0, 160);
};

const normalizeTypographyStyles = (
    value: unknown,
): Record<TypographyTokenId, TypographyTokenStyleSetting> => {
    const raw = isObject(value) ? value : {};
    const result = {} as Record<TypographyTokenId, TypographyTokenStyleSetting>;

    TYPOGRAPHY_TOKENS.forEach((token) => {
        const tokenRaw = isObject(raw[token]) ? raw[token] : {};
        const fallback = DEFAULT_TYPE_STYLES[token];
        result[token] = {
            weight: Math.round(clampNumber(tokenRaw.weight, fallback.weight, 100, 900) / 100) * 100,
            lineHeight: clampNumber(tokenRaw.lineHeight, fallback.lineHeight, 0.8, 2.4),
            letterSpacing: clampNumber(tokenRaw.letterSpacing, fallback.letterSpacing, -0.2, 0.2),
            colorToken: normalizeTypographyColorToken(tokenRaw.colorToken),
            customColor: normalizeHex(tokenRaw.customColor, fallback.customColor),
        };
    });

    return result;
};

const normalizeFeatureTypography = (
    value: unknown,
    base: SiteDesignSettings,
): Record<FeatureTypographySlotId, FeatureTypographySetting> => {
    const raw = isObject(value) ? value : {};
    const result = {} as Record<FeatureTypographySlotId, FeatureTypographySetting>;

    FEATURE_TYPOGRAPHY_SLOTS.forEach((slot) => {
        const slotRaw = isObject(raw[slot]) ? raw[slot] : {};
        const fallback = base.featureTypography[slot];
        result[slot] = {
            fontId: normalizeFontId(slotRaw.fontId, fallback.fontId),
            size: clampNumber(slotRaw.size, fallback.size, 0.5, 10),
            unit: slotRaw.unit === "em" ? "em" : "rem",
            weight: Math.round(clampNumber(slotRaw.weight, fallback.weight, 100, 900) / 100) * 100,
            lineHeight: clampNumber(slotRaw.lineHeight, fallback.lineHeight, 0.8, 2.4),
            letterSpacing: clampNumber(slotRaw.letterSpacing, fallback.letterSpacing, -0.2, 0.2),
            colorToken: normalizeTypographyColorToken(slotRaw.colorToken),
            customColor: normalizeHex(slotRaw.customColor, fallback.customColor),
        };
    });

    return result;
};

const normalizeTextOverrides = (
    value: unknown,
    base: SiteDesignSettings,
): Record<string, TextStyleOverrideSetting> => {
    if (!isObject(value)) return {};

    const entries = Object.entries(value);
    const result: Record<string, TextStyleOverrideSetting> = {};
    for (const [rawId, rawOverride] of entries) {
        if (!isObject(rawOverride)) continue;
        const id = String(rawId || "").trim().slice(0, 96);
        if (!id) continue;

        const selector = sanitizeSelector(rawOverride.selector);
        if (!selector) continue;

        const route = sanitizeRoute(rawOverride.route);
        const enabled = normalizeBoolean(rawOverride.enabled, true);
        const fontId = normalizeFontId(rawOverride.fontId, base.fonts.ui);
        const unit: TypographyUnit = rawOverride.unit === "em" ? "em" : "rem";
        const size = clampNumber(rawOverride.size, base.typography.paragraph, 0.5, 8);
        const weight = Math.round(clampNumber(rawOverride.weight, 500, 100, 900) / 100) * 100;
        const lineHeight = clampNumber(rawOverride.lineHeight, base.typeStyles.paragraph.lineHeight, 0.8, 2.4);
        const letterSpacing = clampNumber(rawOverride.letterSpacing, base.typeStyles.paragraph.letterSpacing, -0.2, 0.2);
        const colorToken = normalizeTextOverrideColorToken(rawOverride.colorToken);
        const customColor = normalizeHex(rawOverride.customColor, base.colors.accent);

        result[id] = {
            id,
            selector,
            route,
            enabled,
            fontId,
            size,
            unit,
            weight,
            lineHeight,
            letterSpacing,
            colorToken,
            customColor,
        };
    }

    return result;
};

const darkenHex = (hex: string, percentage: number): string => {
    const clean = hex.replace("#", "");
    const amount = Math.max(0, Math.min(1, percentage));
    const r = Math.max(0, Math.min(255, Math.round(parseInt(clean.slice(0, 2), 16) * (1 - amount))));
    const g = Math.max(0, Math.min(255, Math.round(parseInt(clean.slice(2, 4), 16) * (1 - amount))));
    const b = Math.max(0, Math.min(255, Math.round(parseInt(clean.slice(4, 6), 16) * (1 - amount))));
    return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b
        .toString(16)
        .padStart(2, "0")}`;
};

const normalizeModeColors = (
    rawInput: unknown,
    fallback: ThemeModeColorSettings,
): ThemeModeColorSettings => {
    const raw = isObject(rawInput) ? rawInput : {};
    return {
        pageBackground: normalizeHex(raw.pageBackground, fallback.pageBackground),
        surfaceBackground: normalizeHex(raw.surfaceBackground, fallback.surfaceBackground),
        surfaceHoverBackground: normalizeHex(raw.surfaceHoverBackground, fallback.surfaceHoverBackground),
        textPrimary: normalizeHex(raw.textPrimary, fallback.textPrimary),
        textSecondary: normalizeHex(raw.textSecondary, fallback.textSecondary),
        textTertiary: normalizeHex(raw.textTertiary, fallback.textTertiary),
        borderSubtle: normalizeHex(raw.borderSubtle, fallback.borderSubtle),
        borderStrong: normalizeHex(raw.borderStrong, fallback.borderStrong),
        headerBackground: normalizeHex(raw.headerBackground, fallback.headerBackground),
        headerText: normalizeHex(raw.headerText, fallback.headerText),
        headerBorder: normalizeHex(raw.headerBorder, fallback.headerBorder),
        footerBackground: normalizeHex(raw.footerBackground, fallback.footerBackground),
        footerText: normalizeHex(raw.footerText, fallback.footerText),
        footerBorder: normalizeHex(raw.footerBorder, fallback.footerBorder),
        link: normalizeHex(raw.link, fallback.link),
        linkHover: normalizeHex(raw.linkHover, fallback.linkHover),
        selection: normalizeHex(raw.selection, fallback.selection),
    };
};

export const normalizeDesignSettings = (input: unknown): SiteDesignSettings => {
    const base = DEFAULT_DESIGN_SETTINGS;
    if (!isObject(input)) return base;

    const typographyRaw = isObject(input.typography) ? input.typography : {};
    const fontsRaw = isObject(input.fonts) ? input.fonts : {};
    const colorsRaw = isObject(input.colors) ? input.colors : {};
    const modeColorsRaw = isObject(input.modeColors) ? input.modeColors : {};
    const linksRaw = isObject(input.links) ? input.links : {};
    const buttonsRaw = isObject(input.buttons) ? input.buttons : {};
    const radiusRaw = isObject(input.radius) ? input.radius : {};
    const preferencesRaw = isObject(input.preferences) ? input.preferences : {};
    const typeStylesRaw = isObject(input.typeStyles) ? input.typeStyles : {};
    const featureTypographyRaw = isObject(input.featureTypography) ? input.featureTypography : {};
    const textOverridesRaw = isObject(input.textOverrides) ? input.textOverrides : {};
    const experimentalTypeLabelsRaw = isObject(input.experimentalTypeLabels) ? input.experimentalTypeLabels : {};

    const unit: TypographyUnit = typographyRaw.unit === "em" ? "em" : "rem";
    const buttonStyle: ButtonStyle =
        buttonsRaw.style === "accent" || buttonsRaw.style === "dark_accent" || buttonsRaw.style === "outline"
            ? (buttonsRaw.style as ButtonStyle)
            : base.buttons.style;

    const darkModeRaw = isObject(modeColorsRaw.dark) ? modeColorsRaw.dark : {};
    const lightModeRaw = isObject(modeColorsRaw.light) ? modeColorsRaw.light : {};

    const legacyDarkLink = normalizeHex(colorsRaw.link, base.modeColors.dark.link);
    const legacyDarkLinkHover = normalizeHex(colorsRaw.linkHover, base.modeColors.dark.linkHover);
    const legacyLightLink = normalizeHex(colorsRaw.link, base.modeColors.light.link);
    const legacyLightLinkHover = normalizeHex(colorsRaw.linkHover, base.modeColors.light.linkHover);
    const normalizedLinkHoverToken = normalizeTextOverrideColorToken(linksRaw.hoverColorToken);

    return {
        typography: {
            unit,
            h1: clampNumber(typographyRaw.h1, base.typography.h1, 1.5, 8),
            h2: clampNumber(typographyRaw.h2, base.typography.h2, 1.4, 7),
            h3: clampNumber(typographyRaw.h3, base.typography.h3, 1.2, 6),
            h4: clampNumber(typographyRaw.h4, base.typography.h4, 1, 5),
            h5: clampNumber(typographyRaw.h5, base.typography.h5, 0.9, 4),
            h6: clampNumber(typographyRaw.h6, base.typography.h6, 0.8, 3),
            paragraph: clampNumber(typographyRaw.paragraph, base.typography.paragraph, 0.75, 2),
            small: clampNumber(typographyRaw.small, base.typography.small, 0.65, 1.5),
            custom1: clampNumber(typographyRaw.custom1, base.typography.custom1, 1, 14),
            custom2: clampNumber(typographyRaw.custom2, base.typography.custom2, 0.5, 3),
            custom3: clampNumber(typographyRaw.custom3, base.typography.custom3, 0.8, 8),
            custom4: clampNumber(typographyRaw.custom4, base.typography.custom4, 0.7, 4),
        },
        fonts: {
            h1: normalizeFontId(fontsRaw.h1, base.fonts.h1),
            h2: normalizeFontId(fontsRaw.h2, base.fonts.h2),
            h3: normalizeFontId(fontsRaw.h3, base.fonts.h3),
            h4: normalizeFontId(fontsRaw.h4, base.fonts.h4),
            h5: normalizeFontId(fontsRaw.h5, base.fonts.h5),
            h6: normalizeFontId(fontsRaw.h6, base.fonts.h6),
            paragraph: normalizeFontId(fontsRaw.paragraph, base.fonts.paragraph),
            ui: normalizeFontId(fontsRaw.ui, base.fonts.ui),
            serif: normalizeFontId(fontsRaw.serif, base.fonts.serif),
            custom1: normalizeFontId(fontsRaw.custom1, base.fonts.custom1),
            custom2: normalizeFontId(fontsRaw.custom2, base.fonts.custom2),
            custom3: normalizeFontId(fontsRaw.custom3, base.fonts.custom3),
            custom4: normalizeFontId(fontsRaw.custom4, base.fonts.custom4),
        },
        colors: {
            primary: normalizeHex(colorsRaw.primary, base.colors.primary),
            secondary: normalizeHex(colorsRaw.secondary, base.colors.secondary),
            tertiary: normalizeHex(colorsRaw.tertiary, base.colors.tertiary),
            accent: normalizeHex(colorsRaw.accent, base.colors.accent),
            custom1: normalizeHex(colorsRaw.custom1, base.colors.custom1),
            custom2: normalizeHex(colorsRaw.custom2, base.colors.custom2),
            custom3: normalizeHex(colorsRaw.custom3, base.colors.custom3),
        },
        modeColors: {
            dark: normalizeModeColors(
                {
                    ...darkModeRaw,
                    link: darkModeRaw.link ?? legacyDarkLink,
                    linkHover: darkModeRaw.linkHover ?? legacyDarkLinkHover,
                },
                base.modeColors.dark,
            ),
            light: normalizeModeColors(
                {
                    ...lightModeRaw,
                    link: lightModeRaw.link ?? legacyLightLink,
                    linkHover: lightModeRaw.linkHover ?? legacyLightLinkHover,
                },
                base.modeColors.light,
            ),
        },
        links: {
            underline: normalizeBoolean(linksRaw.underline, base.links.underline),
            hoverUnderline: normalizeBoolean(linksRaw.hoverUnderline, base.links.hoverUnderline),
            hoverColorEnabled: normalizeBoolean(linksRaw.hoverColorEnabled, base.links.hoverColorEnabled),
            hoverColorToken:
                normalizedLinkHoverToken === "custom"
                    ? base.links.hoverColorToken
                    : normalizedLinkHoverToken,
        },
        buttons: {
            style: buttonStyle,
        },
        radius: {
            base: clampNumber(radiusRaw.base, base.radius.base, 0, 32),
        },
        preferences: {
            autoSave: normalizeBoolean(preferencesRaw.autoSave, base.preferences.autoSave),
        },
        typeStyles: normalizeTypographyStyles(typeStylesRaw),
        featureTypography: normalizeFeatureTypography(featureTypographyRaw, base),
        textOverrides: normalizeTextOverrides(textOverridesRaw, base),
        experimentalTypeLabels: {
            custom1: normalizeLabel(experimentalTypeLabelsRaw.custom1, base.experimentalTypeLabels.custom1),
            custom2: normalizeLabel(experimentalTypeLabelsRaw.custom2, base.experimentalTypeLabels.custom2),
            custom3: normalizeLabel(experimentalTypeLabelsRaw.custom3, base.experimentalTypeLabels.custom3),
            custom4: normalizeLabel(experimentalTypeLabelsRaw.custom4, base.experimentalTypeLabels.custom4),
        },
    };
};

const getButtonVars = (settings: SiteDesignSettings): Record<string, string> => {
    const accent = settings.colors.accent;
    const primary = settings.colors.primary;
    const darkCanvas = settings.modeColors.dark.pageBackground;
    const accentDark = darkenHex(accent, 0.32);

    if (settings.buttons.style === "accent") {
        return {
            "--btn-primary-bg": accent,
            "--btn-primary-text": darkCanvas,
            "--btn-primary-border": accent,
            "--btn-secondary-bg": "transparent",
            "--btn-secondary-text": accent,
            "--btn-secondary-border": accent,
        };
    }

    if (settings.buttons.style === "dark_accent") {
        return {
            "--btn-primary-bg": accentDark,
            "--btn-primary-text": "#ffffff",
            "--btn-primary-border": accentDark,
            "--btn-secondary-bg": "transparent",
            "--btn-secondary-text": primary,
            "--btn-secondary-border": accentDark,
        };
    }

    return {
        "--btn-primary-bg": "transparent",
        "--btn-primary-text": primary,
        "--btn-primary-border": primary,
        "--btn-secondary-bg": "transparent",
        "--btn-secondary-text": primary,
        "--btn-secondary-border": "var(--border-strong)",
    };
};

export const getFontStack = (fontId: string): string =>
    FONT_STACKS[fontId] || FONT_STACKS.satoshi;

const resolveTypographyTokenColor = (
    token: TypographyColorToken,
    customColor: string,
): string => {
    if (token === "textPrimary") return "var(--text-primary)";
    if (token === "textSecondary") return "var(--text-secondary)";
    if (token === "textTertiary") return "var(--text-tertiary)";
    if (token === "primary") return "var(--theme-color-primary)";
    if (token === "secondary") return "var(--theme-color-secondary)";
    if (token === "tertiary") return "var(--theme-color-tertiary)";
    if (token === "accent") return "var(--theme-color-accent)";
    if (token === "custom1") return "var(--custom-color-1)";
    if (token === "custom2") return "var(--custom-color-2)";
    if (token === "custom3") return "var(--custom-color-3)";
    return customColor;
};

const resolveBrandColorTokenHex = (
    token: TextOverrideColorToken,
    settings: SiteDesignSettings,
): string => {
    if (token === "primary") return settings.colors.primary;
    if (token === "secondary") return settings.colors.secondary;
    if (token === "tertiary") return settings.colors.tertiary;
    if (token === "accent") return settings.colors.accent;
    if (token === "custom1") return settings.colors.custom1;
    if (token === "custom2") return settings.colors.custom2;
    if (token === "custom3") return settings.colors.custom3;
    return settings.colors.accent;
};

export const designSettingsToCssVariables = (
    settingsInput: unknown,
): Record<string, string> => {
    const settings = normalizeDesignSettings(settingsInput);
    const unit = settings.typography.unit;
    const typeStyles = settings.typeStyles;
    const featureTypography = settings.featureTypography;
    const forcedHoverColor = settings.links.hoverColorEnabled
        ? resolveBrandColorTokenHex(settings.links.hoverColorToken, settings)
        : null;
    const featureTypographyVars = FEATURE_TYPOGRAPHY_SLOTS.reduce<Record<string, string>>((acc, slot) => {
        const config = featureTypography[slot];
        const prefix = FEATURE_TYPOGRAPHY_VAR_PREFIX[slot];
        acc[`--${prefix}-font`] = getFontStack(config.fontId);
        acc[`--${prefix}-size`] = `${config.size}${config.unit}`;
        acc[`--${prefix}-weight`] = `${config.weight}`;
        acc[`--${prefix}-line-height`] = `${config.lineHeight}`;
        acc[`--${prefix}-letter-spacing`] = `${config.letterSpacing}em`;
        acc[`--${prefix}-color`] = resolveTypographyTokenColor(config.colorToken, config.customColor);
        return acc;
    }, {});

    return {
        "--font-h1": getFontStack(settings.fonts.h1),
        "--font-h2": getFontStack(settings.fonts.h2),
        "--font-h3": getFontStack(settings.fonts.h3),
        "--font-h4": getFontStack(settings.fonts.h4),
        "--font-h5": getFontStack(settings.fonts.h5),
        "--font-h6": getFontStack(settings.fonts.h6),
        "--font-body": getFontStack(settings.fonts.paragraph),
        "--font-serif": getFontStack(settings.fonts.serif),
        "--font-ui": getFontStack(settings.fonts.ui),
        "--font-custom-1": getFontStack(settings.fonts.custom1),
        "--font-custom-2": getFontStack(settings.fonts.custom2),
        "--font-custom-3": getFontStack(settings.fonts.custom3),
        "--font-custom-4": getFontStack(settings.fonts.custom4),
        "--step-h1": `${settings.typography.h1}${unit}`,
        "--step-h2": `${settings.typography.h2}${unit}`,
        "--step-h3": `${settings.typography.h3}${unit}`,
        "--step-h4": `${settings.typography.h4}${unit}`,
        "--step-h5": `${settings.typography.h5}${unit}`,
        "--step-h6": `${settings.typography.h6}${unit}`,
        "--step-body": `${settings.typography.paragraph}${unit}`,
        "--step-small": `${settings.typography.small}${unit}`,
        "--step-custom-1": `${settings.typography.custom1}${unit}`,
        "--step-custom-2": `${settings.typography.custom2}${unit}`,
        "--step-custom-3": `${settings.typography.custom3}${unit}`,
        "--step-custom-4": `${settings.typography.custom4}${unit}`,
        "--type-h1-weight": `${typeStyles.h1.weight}`,
        "--type-h1-line-height": `${typeStyles.h1.lineHeight}`,
        "--type-h1-letter-spacing": `${typeStyles.h1.letterSpacing}em`,
        "--type-h1-color": resolveTypographyTokenColor(typeStyles.h1.colorToken, typeStyles.h1.customColor),
        "--type-h2-weight": `${typeStyles.h2.weight}`,
        "--type-h2-line-height": `${typeStyles.h2.lineHeight}`,
        "--type-h2-letter-spacing": `${typeStyles.h2.letterSpacing}em`,
        "--type-h2-color": resolveTypographyTokenColor(typeStyles.h2.colorToken, typeStyles.h2.customColor),
        "--type-h3-weight": `${typeStyles.h3.weight}`,
        "--type-h3-line-height": `${typeStyles.h3.lineHeight}`,
        "--type-h3-letter-spacing": `${typeStyles.h3.letterSpacing}em`,
        "--type-h3-color": resolveTypographyTokenColor(typeStyles.h3.colorToken, typeStyles.h3.customColor),
        "--type-h4-weight": `${typeStyles.h4.weight}`,
        "--type-h4-line-height": `${typeStyles.h4.lineHeight}`,
        "--type-h4-letter-spacing": `${typeStyles.h4.letterSpacing}em`,
        "--type-h4-color": resolveTypographyTokenColor(typeStyles.h4.colorToken, typeStyles.h4.customColor),
        "--type-h5-weight": `${typeStyles.h5.weight}`,
        "--type-h5-line-height": `${typeStyles.h5.lineHeight}`,
        "--type-h5-letter-spacing": `${typeStyles.h5.letterSpacing}em`,
        "--type-h5-color": resolveTypographyTokenColor(typeStyles.h5.colorToken, typeStyles.h5.customColor),
        "--type-h6-weight": `${typeStyles.h6.weight}`,
        "--type-h6-line-height": `${typeStyles.h6.lineHeight}`,
        "--type-h6-letter-spacing": `${typeStyles.h6.letterSpacing}em`,
        "--type-h6-color": resolveTypographyTokenColor(typeStyles.h6.colorToken, typeStyles.h6.customColor),
        "--type-paragraph-weight": `${typeStyles.paragraph.weight}`,
        "--type-paragraph-line-height": `${typeStyles.paragraph.lineHeight}`,
        "--type-paragraph-letter-spacing": `${typeStyles.paragraph.letterSpacing}em`,
        "--type-paragraph-color": resolveTypographyTokenColor(typeStyles.paragraph.colorToken, typeStyles.paragraph.customColor),
        "--type-small-weight": `${typeStyles.small.weight}`,
        "--type-small-line-height": `${typeStyles.small.lineHeight}`,
        "--type-small-letter-spacing": `${typeStyles.small.letterSpacing}em`,
        "--type-small-color": resolveTypographyTokenColor(typeStyles.small.colorToken, typeStyles.small.customColor),
        "--type-custom1-weight": `${typeStyles.custom1.weight}`,
        "--type-custom1-line-height": `${typeStyles.custom1.lineHeight}`,
        "--type-custom1-letter-spacing": `${typeStyles.custom1.letterSpacing}em`,
        "--type-custom1-color": resolveTypographyTokenColor(typeStyles.custom1.colorToken, typeStyles.custom1.customColor),
        "--type-custom2-weight": `${typeStyles.custom2.weight}`,
        "--type-custom2-line-height": `${typeStyles.custom2.lineHeight}`,
        "--type-custom2-letter-spacing": `${typeStyles.custom2.letterSpacing}em`,
        "--type-custom2-color": resolveTypographyTokenColor(typeStyles.custom2.colorToken, typeStyles.custom2.customColor),
        "--type-custom3-weight": `${typeStyles.custom3.weight}`,
        "--type-custom3-line-height": `${typeStyles.custom3.lineHeight}`,
        "--type-custom3-letter-spacing": `${typeStyles.custom3.letterSpacing}em`,
        "--type-custom3-color": resolveTypographyTokenColor(typeStyles.custom3.colorToken, typeStyles.custom3.customColor),
        "--type-custom4-weight": `${typeStyles.custom4.weight}`,
        "--type-custom4-line-height": `${typeStyles.custom4.lineHeight}`,
        "--type-custom4-letter-spacing": `${typeStyles.custom4.letterSpacing}em`,
        "--type-custom4-color": resolveTypographyTokenColor(typeStyles.custom4.colorToken, typeStyles.custom4.customColor),
        ...featureTypographyVars,
        "--theme-color-primary": settings.colors.primary,
        "--theme-color-secondary": settings.colors.secondary,
        "--theme-color-tertiary": settings.colors.tertiary,
        "--theme-color-accent": settings.colors.accent,
        "--accent-primary": settings.colors.accent,
        "--custom-color-1": settings.colors.custom1,
        "--custom-color-2": settings.colors.custom2,
        "--custom-color-3": settings.colors.custom3,
        "--font-display": getFontStack(settings.fonts.h1),
        "--font-mono": getFontStack(settings.fonts.ui),
        "--link-underline": settings.links.underline ? "underline" : "none",
        "--link-hover-underline": settings.links.hoverUnderline ? "underline" : "none",
        "--radius-base": `${settings.radius.base}px`,
        "--dark-page-bg": settings.modeColors.dark.pageBackground,
        "--dark-surface-bg": settings.modeColors.dark.surfaceBackground,
        "--dark-surface-hover-bg": settings.modeColors.dark.surfaceHoverBackground,
        "--dark-text-primary": settings.modeColors.dark.textPrimary,
        "--dark-text-secondary": settings.modeColors.dark.textSecondary,
        "--dark-text-tertiary": settings.modeColors.dark.textTertiary,
        "--dark-border-subtle": settings.modeColors.dark.borderSubtle,
        "--dark-border-strong": settings.modeColors.dark.borderStrong,
        "--dark-header-bg": settings.modeColors.dark.headerBackground,
        "--dark-header-text": settings.modeColors.dark.headerText,
        "--dark-header-border": settings.modeColors.dark.headerBorder,
        "--dark-footer-bg": settings.modeColors.dark.footerBackground,
        "--dark-footer-text": settings.modeColors.dark.footerText,
        "--dark-footer-border": settings.modeColors.dark.footerBorder,
        "--dark-link-color": settings.modeColors.dark.link,
        "--dark-link-hover-color": forcedHoverColor || settings.modeColors.dark.linkHover,
        "--dark-selection-bg": settings.modeColors.dark.selection,
        "--light-page-bg": settings.modeColors.light.pageBackground,
        "--light-surface-bg": settings.modeColors.light.surfaceBackground,
        "--light-surface-hover-bg": settings.modeColors.light.surfaceHoverBackground,
        "--light-text-primary": settings.modeColors.light.textPrimary,
        "--light-text-secondary": settings.modeColors.light.textSecondary,
        "--light-text-tertiary": settings.modeColors.light.textTertiary,
        "--light-border-subtle": settings.modeColors.light.borderSubtle,
        "--light-border-strong": settings.modeColors.light.borderStrong,
        "--light-header-bg": settings.modeColors.light.headerBackground,
        "--light-header-text": settings.modeColors.light.headerText,
        "--light-header-border": settings.modeColors.light.headerBorder,
        "--light-footer-bg": settings.modeColors.light.footerBackground,
        "--light-footer-text": settings.modeColors.light.footerText,
        "--light-footer-border": settings.modeColors.light.footerBorder,
        "--light-link-color": settings.modeColors.light.link,
        "--light-link-hover-color": forcedHoverColor || settings.modeColors.light.linkHover,
        "--light-selection-bg": settings.modeColors.light.selection,
        ...getButtonVars(settings),
    };
};

export const designSettingsToCssText = (settingsInput: unknown): string => {
    const settings = normalizeDesignSettings(settingsInput);
    const vars = designSettingsToCssVariables(settings);
    const variableText = Object.entries(vars)
        .map(([key, value]) => `${key}: ${value};`)
        .join(" ");
    const textOverrides = designSettingsToTextOverrideCss(settings);
    const baseCss = `:root, [data-theme="light"], [data-theme="dark"] { ${variableText} }`;
    return textOverrides ? `${baseCss} ${textOverrides}` : baseCss;
};

const escapeCssAttributeValue = (value: string): string =>
    value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');

const resolveTextOverrideColor = (
    token: TextOverrideColorToken,
    settings: SiteDesignSettings,
    customColor: string,
): string => {
    if (token === "primary") return settings.colors.primary;
    if (token === "secondary") return settings.colors.secondary;
    if (token === "tertiary") return settings.colors.tertiary;
    if (token === "accent") return settings.colors.accent;
    if (token === "custom1") return settings.colors.custom1;
    if (token === "custom2") return settings.colors.custom2;
    if (token === "custom3") return settings.colors.custom3;
    return customColor;
};

export const designSettingsToTextOverrideCss = (settingsInput: unknown): string => {
    const settings = normalizeDesignSettings(settingsInput);
    const overrides = Object.values(settings.textOverrides || {});
    if (!overrides.length) return "";

    const rules: string[] = [];
    for (const override of overrides) {
        if (!override.enabled) continue;
        if (!override.selector) continue;
        const selectorParts = override.selector
            .split(",")
            .map((part) => part.trim())
            .filter(Boolean);
        if (!selectorParts.length) continue;

        const scopedSelectors = selectorParts.map((part) => {
            if (override.route) {
                return `body[data-page-path="${escapeCssAttributeValue(override.route)}"] ${part}`;
            }
            return part;
        });

        const colorValue = resolveTextOverrideColor(override.colorToken, settings, override.customColor);
        rules.push(
            `${scopedSelectors.join(", ")} { font-family: ${getFontStack(
                override.fontId,
            )} !important; font-size: ${override.size}${override.unit} !important; font-weight: ${
                override.weight
            } !important; line-height: ${override.lineHeight} !important; letter-spacing: ${
                override.letterSpacing
            }em !important; color: ${colorValue} !important; }`,
        );
    }

    return rules.join(" ");
};
