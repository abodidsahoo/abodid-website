import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_DESIGN_TOKENS,
  DESIGN_TOKEN_FIELDS,
  DESIGN_TOKEN_GROUPS,
  MINIMUM_TEXT_CONTRAST,
  evaluateSurfaceContracts,
  normaliseDesignTokens,
  mergeColourTokens,
  upgradeTypographyTokens,
  serialiseDesignTokens,
  TYPOGRAPHY_TOKEN_NAMES,
  TYPOGRAPHY_VERSION,
} from "../../src/lib/designTokens.js";
import { DESIGN_TOKEN_USAGE } from "../../src/lib/designTokenUsage.js";
import { normaliseThemeCorners, ORIGINAL_SITE_THEME, sameSiteTheme } from "../../src/lib/siteThemes.js";

test("the bundled Pop Editorial palette satisfies every surface contract", () => {
  const contracts = evaluateSurfaceContracts(DEFAULT_DESIGN_TOKENS);
  assert.equal(contracts.length, 13);
  assert.deepEqual(contracts.filter((contract) => !contract.passes), []);
  assert.ok(contracts.every((contract) => contract.ratio >= MINIMUM_TEXT_CONTRAST));
});

test("light and deep surfaces keep their required foreground roles", () => {
  const contracts = evaluateSurfaceContracts(DEFAULT_DESIGN_TOKENS);
  for (const contract of contracts) {
    assert.equal(
      contract.foregroundToken,
      contract.id.startsWith("button") || contract.id === "yellow" ? "--color-button-text" : contract.tone === "deep" ? "--color-primary-text" : "--color-text",
    );
  }
});

test("an unsafe edited palette is rejected by the contrast contract", () => {
  const contracts = evaluateSurfaceContracts({
    ...DEFAULT_DESIGN_TOKENS,
    "--color-primary": "#fff7e6",
  });
  const cobalt = contracts.find((contract) => contract.id === "blue");
  assert.equal(cobalt.passes, false);
  assert.ok(cobalt.ratio < MINIMUM_TEXT_CONTRAST);
});

test("normalisation ignores unknown tokens and clamps numeric primitives", () => {
  const tokens = normaliseDesignTokens({
    "--unknown-token": "red",
    "--ds-radius-card": "999",
  });
  assert.equal(tokens["--unknown-token"], undefined);
  assert.equal(tokens["--ds-radius-card"], "40");
});

test("Design Studio exposes four focused tabs and a real usage reference for every token", () => {
  assert.deepEqual(DESIGN_TOKEN_GROUPS.map((group) => group.id), [
    "colour",
    "typography",
    "layout",
    "components",
  ]);

  for (const token of DESIGN_TOKEN_FIELDS) {
    const reference = DESIGN_TOKEN_USAGE[token.name];
    assert.ok(reference, `${token.name} is missing a usage reference`);
    assert.ok(reference.previewKind);
    assert.ok(reference.selector);
    assert.ok(reference.routes.length > 0);
    assert.ok(reference.html);
    assert.ok(reference.css);
  }
});

test("legacy saved palettes migrate without changing numeric tokens or colour values", () => {
  const input = { "--pop-blue": "#a30021", "--pop-cream": "#f9f8f3", "--ds-body-weight": "570" };
  const tokens = normaliseDesignTokens(input);
  assert.equal(tokens["--color-primary"], "#a30021");
  assert.equal(tokens["--color-background"], "#f9f8f3");
  assert.equal(tokens["--ds-body-weight"], "570");
  assert.equal(tokens["--pop-blue"], undefined);
  assert.equal(normaliseDesignTokens({ ...input, "--color-primary": "#123456" })["--color-primary"], "#123456");
  assert.equal(normaliseDesignTokens({ ...input, "--color-primary": "invalid" })["--color-primary"], "#a30021");
});

test("publications support both current and previously deployed clients", async () => {
  const { LEGACY_COLOR_TOKENS, serialiseDesignTokens } = await import("../../src/lib/designTokens.js");
  const current = normaliseDesignTokens({ "--color-primary": "#a30021" });
  const saved = serialiseDesignTokens(current);
  for (const [legacy, name] of Object.entries(LEGACY_COLOR_TOKENS)) {
    assert.equal(saved[legacy], current[name]);
  }
  assert.deepEqual(normaliseDesignTokens(saved), current);
  const legacyOnly = Object.fromEntries(Object.entries(saved).filter(([name]) => !name.startsWith("--color-")));
  assert.deepEqual(normaliseDesignTokens(legacyOnly), current);
});

test("colour controls use roles and numbered additional colours", () => {
  const colourFields = DESIGN_TOKEN_GROUPS[0].sections[0].tokens;
  assert.deepEqual(colourFields.map(({label}) => label), [
    "Primary colour", "Secondary colour", "Button colour", "Accent colour",
    "Additional Colour 1", "Additional Colour 2", "Additional Colour 3",
    "Background colour", "Raised surface colour", "Text colour",
  ]);
  assert.ok(colourFields.every(({name}) => name.startsWith("--color-")));
});

test("older palettes inherit the text they previously used on action and primary surfaces", () => {
  const tokens = normaliseDesignTokens({ "--pop-ink": "#112233", "--pop-cream": "#f9f8f3" });
  assert.equal(tokens["--color-button-text"], "#112233");
  assert.equal(tokens["--color-primary-text"], "#f9f8f3");
});

test("a new button palette uses its own readable label colour in every action state", () => {
  const tokens = { ...DEFAULT_DESIGN_TOKENS, "--color-button": "#a30021", "--color-button-text": "#fff8e8" };
  const states = evaluateSurfaceContracts(tokens).filter((contract) => contract.id === "yellow" || contract.id.startsWith("button"));
  assert.equal(states.length, 3);
  assert.ok(states.every((state) => state.passes));
  assert.ok(states.every((state) => state.foreground === "#fff8e8"));
  assert.ok(states.every((state) => state.background !== DEFAULT_DESIGN_TOKENS["--color-button"]));
});

test("colour-only defaults, history and publishing preserve all numeric design values", () => {
  const baseline = { ...DEFAULT_DESIGN_TOKENS, "--ds-body-weight": "570", "--ds-radius-card": "29" };
  const draft = { ...DEFAULT_DESIGN_TOKENS, "--color-primary": "#a30021" };
  const merged = mergeColourTokens(baseline, draft);
  assert.equal(merged["--ds-body-weight"], "570");
  assert.equal(merged["--ds-radius-card"], "29");
  assert.equal(merged["--color-primary"], "#a30021");
});

test("publication catches a pressed-state failure even when the base colour passes", () => {
  const contracts = evaluateSurfaceContracts({ ...DEFAULT_DESIGN_TOKENS, "--color-primary": "#5555ff" });
  assert.equal(contracts.find((contract) => contract.id === "blue").passes, true);
  assert.equal(contracts.find((contract) => contract.id === "primary-active").passes, false);
});

test("theme corners preserve saved rounding through sharp mode and legacy Original restores component defaults", () => {
  const corners = normaliseThemeCorners({ style: "sharp", radii: { "--ds-radius-card": "12", "--ds-radius-media": "", "--ds-radius-control": 999, "--unknown-token": "red" } });
  assert.deepEqual(corners, { style: "sharp", radii: { "--ds-radius-card": 12, "--ds-radius-control": 28 } });
  assert.equal(sameSiteTheme(null, ORIGINAL_SITE_THEME), true);
  assert.equal(sameSiteTheme(null, { ...ORIGINAL_SITE_THEME, corners }), false);
  assert.equal(sameSiteTheme(
    { ...ORIGINAL_SITE_THEME, corners },
    { ...ORIGINAL_SITE_THEME, corners: { style: "sharp", radii: { "--ds-radius-control": 28, "--ds-radius-card": 12 } } },
  ), true);
});

test("the header and footer layout is independent of the theme palette and corners", () => {
  const { header_footer_style, ...legacyOriginal } = ORIGINAL_SITE_THEME;
  assert.equal(header_footer_style, "boxed");
  assert.equal(sameSiteTheme(legacyOriginal, ORIGINAL_SITE_THEME), true);
  assert.equal(sameSiteTheme(legacyOriginal, { ...legacyOriginal, header_footer_style: "lines" }), false);
});

test("legacy typography adopts the shared scale without rewriting saved colours or layout", () => {
  const saved = { "--pop-blue": "#123456", "--ds-body-min": "0.94", "--ds-body-weight": "570", "--ds-radius-card": "29" };
  const upgraded = upgradeTypographyTokens(saved);
  assert.equal(upgraded["--color-primary"], "#123456");
  assert.equal(upgraded["--ds-radius-card"], "29");
  for (const name of TYPOGRAPHY_TOKEN_NAMES) assert.equal(upgraded[name], DEFAULT_DESIGN_TOKENS[name]);
  assert.equal(saved["--ds-body-weight"], "570");
});

test("versioned typography edits survive publication and reload", () => {
  const saved = serialiseDesignTokens({ ...DEFAULT_DESIGN_TOKENS, "--ds-body-min": "1.25", "--ds-body-max": "1.25" });
  assert.equal(saved.__typographyVersion, TYPOGRAPHY_VERSION);
  assert.equal(upgradeTypographyTokens(saved)["--ds-body-max"], "1.25");
  assert.deepEqual(upgradeTypographyTokens(saved), normaliseDesignTokens(saved));
});

test("typography fallbacks match the editable schema and remain within readable ratios", async () => {
  const { readFile } = await import("node:fs/promises");
  const css = await readFile(new URL("../../src/styles/design-system.css", import.meta.url), "utf8");
  for (const name of TYPOGRAPHY_TOKEN_NAMES) {
    assert.equal(css.match(new RegExp(`${name}: ([^;]+);`))?.[1], DEFAULT_DESIGN_TOKENS[name], name);
    if (name.endsWith("-weight")) assert.ok([350, 450, 600, 750].includes(Number(DEFAULT_DESIGN_TOKENS[name])));
  }
  for (const role of ["display", "page-title", "section-title", "card-title", "lead", "body", "reading"]) {
    const min = Number(DEFAULT_DESIGN_TOKENS[`--ds-${role}-min`]);
    const max = Number(DEFAULT_DESIGN_TOKENS[`--ds-${role}-max`]);
    assert.ok(max >= min && max / min <= 2.5, role);
  }
});
