import test from "node:test";
import assert from "node:assert/strict";
import {
  makeStorageFilename,
  matchesStrictAnd,
  normalizeTaxonomyTerm,
  parseFilters,
  serializeFilters,
  validateBlock,
  validateProjectForPublish,
} from "../../src/lib/portfolio/schema.js";

const project = {
  yearStart: 2026,
  taxonomies: [
    { groupType: "primary", slug: "research", label: "Research" },
    { groupType: "primary", slug: "photography", label: "Photography" },
    { groupType: "role", slug: "researcher", label: "Researcher" },
  ],
  organisations: [{ name: "Cambridge", slug: "cambridge" }],
};

test("strict AND filtering requires every selected term", () => {
  assert.equal(matchesStrictAnd(project, { primary: ["research", "photography"] }), true);
  assert.equal(matchesStrictAnd(project, { primary: ["research", "film"] }), false);
  assert.equal(matchesStrictAnd(project, { primary: ["research"], organisation: ["cambridge"], role: ["researcher"] }), true);
});

test("filters round-trip through the URL", () => {
  const selected = { primary: ["photography", "research"], organisation: ["cambridge"] };
  assert.deepEqual(parseFilters(`?${serializeFilters(selected)}`), selected);
});

test("taxonomy normalisation is stable", () => {
  assert.deepEqual(normalizeTaxonomyTerm("  Creative Technology ", "technology"), {
    label: "Creative Technology", slug: "creative-technology", groupType: "technology",
  });
});

test("storage filename preserves the original base and adds a suffix", () => {
  assert.equal(makeStorageFilename("Cambridge Workshop Photograph.JPG", "a1b2c3"), "cambridge-workshop-photograph-a1b2c3.jpg");
});

test("block validation requires alt text for meaningful media", () => {
  assert.deepEqual(validateBlock({ blockType: "single_image", content: { media: { url: "https://example.com/a.jpg", alt: "" } } }), ["Image alt text is required"]);
  assert.deepEqual(validateBlock({ blockType: "single_image", content: { media: { url: "https://example.com/a.jpg", decorative: true } } }), []);
});

test("full publication validates the required spine", () => {
  const errors = validateProjectForPublish({ title: "A", oneLineDescription: "B", yearStart: 2026, coverUrl: "/cover.jpg", coverAlt: "Cover", context: "", specificContribution: "", blocks: [] });
  assert.ok(errors.includes("Research Question is required"));
  assert.ok(errors.includes("Specific contribution is required"));
});

test("limited WIP publication protects private body requirements", () => {
  const errors = validateProjectForPublish({ title: "A", oneLineDescription: "B", yearStart: 2026, coverUrl: "/cover.jpg", coverAlt: "Cover", workInProgress: true, limitedPublic: true, blocks: [] });
  assert.deepEqual(errors, []);
});
