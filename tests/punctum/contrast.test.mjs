import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "vitest";

const stylesheetUrl = new URL("../../src/styles/punctum.css", import.meta.url);
const stylesheet = await readFile(stylesheetUrl, "utf8");

function themeBlock(selector) {
  const start = stylesheet.indexOf(`${selector} {`);
  assert.notEqual(start, -1, `Missing theme selector: ${selector}`);

  const bodyStart = stylesheet.indexOf("{", start) + 1;
  const end = stylesheet.indexOf("\n}", bodyStart);
  return stylesheet.slice(bodyStart, end);
}

function token(block, name) {
  const match = block.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})\\s*;`));
  assert.ok(match, `Missing hexadecimal token --${name}`);
  return match[1];
}

function declaration(block, name) {
  const match = block.match(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})\\s*;`));
  assert.ok(match, `Missing hexadecimal declaration ${name}`);
  return match[1];
}

function relativeLuminance(hex) {
  const channels = hex
    .slice(1)
    .match(/.{2}/g)
    .map((value) => Number.parseInt(value, 16) / 255)
    .map((value) =>
      value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
    );

  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrastRatio(foreground, background) {
  const foregroundLuminance = relativeLuminance(foreground);
  const backgroundLuminance = relativeLuminance(background);
  return (
    (Math.max(foregroundLuminance, backgroundLuminance) + 0.05) /
    (Math.min(foregroundLuminance, backgroundLuminance) + 0.05)
  );
}

const themes = {
  light: themeBlock("html:has(body.punctum-page)"),
  dark: themeBlock('html[data-punctum-theme="dark"]:has(body.punctum-page)'),
};

const checks = [
  ["ink", "bg", 7],
  ["ink", "surface", 7],
  ["muted", "bg", 4.5],
  ["muted", "surface", 4.5],
  ["accent", "bg", 4.5],
  ["button-ink", "yellow", 4.5],
  ["focus", "bg", 3],
  ["border", "bg", 3],
  ["disabled-text", "disabled-bg", 4.5],
  ["notice-text", "notice-bg", 4.5],
  ["success-text", "success-bg", 4.5],
  ["error-text", "error-bg", 4.5],
];

for (const [themeName, block] of Object.entries(themes)) {
  test(`${themeName} Punctum palette meets its contrast targets`, () => {
    for (const [foregroundName, backgroundName, minimum] of checks) {
      const foreground = token(block, `punctum-${foregroundName}`);
      const background = token(block, `punctum-${backgroundName}`);
      const ratio = contrastRatio(foreground, background);

      assert.ok(
        ratio >= minimum,
        `${foregroundName}/${backgroundName} is ${ratio.toFixed(2)}:1; expected at least ${minimum}:1`,
      );
    }
  });
}

test("the generation-limit softbox keeps its text comfortably legible", () => {
  const card = themeBlock(".punctum-world-result__failure-card");
  const body = themeBlock(".punctum-world-result__failure-card > p");
  const background = declaration(card, "background");
  const heading = declaration(card, "color");
  const paragraph = declaration(body, "color");

  assert.ok(contrastRatio(heading, background) >= 7);
  assert.ok(contrastRatio(paragraph, background) >= 4.5);
});
