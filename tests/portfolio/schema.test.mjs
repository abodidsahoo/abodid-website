import test from "node:test";
import assert from "node:assert/strict";
import {
  createEmptyCollaborator,
  makeStorageFilename,
  markCollaboratorsPublished,
  matchesStrictAnd,
  normalizePortfolioHref,
  normalizeTaxonomyTerm,
  orderPortfolioRevisionHistory,
  parseFilters,
  serializeFilters,
  toSavePayload,
  toPublicPortfolioProjection,
  updateCollaboratorDraft,
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

test("external portfolio links receive a safe absolute protocol", () => {
  assert.equal(normalizePortfolioHref("www.google.com"), "https://www.google.com/");
  assert.equal(normalizePortfolioHref("google.com/search?q=portfolio"), "https://google.com/search?q=portfolio");
  assert.equal(normalizePortfolioHref("https//example.com/work"), "https://example.com/work");
  assert.equal(normalizePortfolioHref("http:/example.com/work"), "http://example.com/work");
});

test("internal portfolio links stay internal and unsafe protocols are rejected", () => {
  assert.equal(normalizePortfolioHref("/research/invisible-punctum"), "/research/invisible-punctum");
  assert.equal(normalizePortfolioHref("javascript:alert(1)"), "");
});

test("alt text is optional for image publication", () => {
  assert.deepEqual(validateBlock({ blockType: "single_image", content: { media: { url: "https://example.com/a.jpg", alt: "" } } }), []);
  assert.deepEqual(validateProjectForPublish({ title: "A", oneLineDescription: "B", yearStart: 2026, coverUrl: "/cover.jpg", coverAlt: "", context: "Question", specificContribution: "Contribution", blocks: [] }), []);
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

test("responsive preview mirrors the limited WIP public projection", () => {
  const projected = toPublicPortfolioProjection({
    workInProgress: true,
    limitedPublic: true,
    context: "Private question",
    specificContribution: "Private contribution",
    location: "Private location",
    duration: "Private duration",
    outcomeHeading: "Private outcome",
    outcomeText: "Private result",
    collaborators: [{ name: "Private collaborator" }],
    links: [{ label: "Private link", url: "https://example.com" }],
    blocks: [{ id: "visible", visible: true }, { id: "hidden", visible: false }],
  });
  assert.equal(projected.context, "");
  assert.equal(projected.specificContribution, "");
  assert.equal(projected.location, "");
  assert.equal(projected.duration, "");
  assert.equal(projected.outcomeText, "");
  assert.deepEqual(projected.collaborators, []);
  assert.deepEqual(projected.links, []);
  assert.deepEqual(projected.blocks.map((block) => block.id), ["visible"]);
});

test("collaborator identity is stable across saves and forks only when published identity fields change", () => {
  const added = createEmptyCollaborator("new-collaborator");
  const typed = updateCollaboratorDraft(added, { name: "New collaborator" }, () => "unused-id");
  assert.equal(typed.id, "new-collaborator");

  const loaded = { id: "published-collaborator", name: "Original name", roleLabel: "Director", primaryUrl: "", secondaryUrl: "", organisation: "" };
  const roleEdit = updateCollaboratorDraft(loaded, { roleLabel: "Producer" }, () => "unused-id");
  assert.equal(roleEdit.id, "published-collaborator");

  const identityEdit = updateCollaboratorDraft(loaded, { name: "Updated name" }, () => "forked-collaborator");
  assert.equal(identityEdit.id, "forked-collaborator");
  assert.equal(identityEdit._identityEditable, true);
  const continuedEdit = updateCollaboratorDraft(identityEdit, { organisation: "Studio" }, () => "unused-id");
  assert.equal(continuedEdit.id, "forked-collaborator");

  const payload = toSavePayload({ blocks: [], taxonomies: [], organisations: [], collaborators: [continuedEdit], links: [] });
  assert.equal(payload.collaborators[0].id, "forked-collaborator");
  assert.equal(Object.hasOwn(payload.collaborators[0], "_identityEditable"), false);
  assert.equal(Object.hasOwn(markCollaboratorsPublished([continuedEdit])[0], "_identityEditable"), false);
});

test("revision history keeps the current live revision first and includes archived publications", () => {
  const revisions = [
    { id: "archived-v1", state: "archived", revision_number: 2 },
    { id: "current-v2", state: "published", revision_number: 4 },
    { id: "archived-v3", state: "archived", revision_number: 6 },
  ];
  assert.deepEqual(
    orderPortfolioRevisionHistory(revisions, "current-v2").map((revision) => revision.id),
    ["current-v2", "archived-v3", "archived-v1"],
  );
});
