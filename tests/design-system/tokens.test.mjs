import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_DESIGN_TOKENS,
  DESIGN_TOKEN_FIELDS,
  DESIGN_TOKEN_GROUPS,
  MINIMUM_TEXT_CONTRAST,
  evaluateSurfaceContracts,
  normaliseDesignTokens,
} from "../../src/lib/designTokens.js";
import { DESIGN_TOKEN_USAGE } from "../../src/lib/designTokenUsage.js";

test("the bundled Pop Editorial palette satisfies every surface contract", () => {
  const contracts = evaluateSurfaceContracts(DEFAULT_DESIGN_TOKENS);
  assert.equal(contracts.length, 9);
  assert.deepEqual(contracts.filter((contract) => !contract.passes), []);
  assert.ok(contracts.every((contract) => contract.ratio >= MINIMUM_TEXT_CONTRAST));
});

test("light and deep surfaces keep their required foreground roles", () => {
  const contracts = evaluateSurfaceContracts(DEFAULT_DESIGN_TOKENS);
  for (const contract of contracts) {
    assert.equal(
      contract.foregroundToken,
      contract.tone === "deep" ? "--pop-cream" : "--pop-ink",
    );
  }
});

test("an unsafe edited palette is rejected by the contrast contract", () => {
  const contracts = evaluateSurfaceContracts({
    ...DEFAULT_DESIGN_TOKENS,
    "--pop-blue": "#fff7e6",
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
