import test from "node:test";
import assert from "node:assert/strict";
import {
  balancePortfolioImageRows,
  BLOCK_LABELS,
  createEmptyCollaborator,
  createEmptyBlock,
  getPortfolioBlockSummary,
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

test("project block summaries support compact newsletter-style cards", () => {
  assert.equal(getPortfolioBlockSummary({ blockType: "heading", content: { text: "A new section" } }), "A new section");
  assert.equal(getPortfolioBlockSummary({ blockType: "image_gallery", content: { media: [{ url: "one" }, { url: "two" }] } }), "2 images");
  assert.equal(getPortfolioBlockSummary({ blockType: "body_text", visible: false, content: { text: "Private" } }), "Hidden from the public project");
});

test("portfolio block names and defaults expose the expanded authoring set", () => {
  assert.equal(BLOCK_LABELS.single_image, "Single Image");
  assert.equal(BLOCK_LABELS.image_grid, "Multi-image grid");
  assert.equal(BLOCK_LABELS.image_gallery, "Multi-image grid");
  assert.equal(BLOCK_LABELS.outcome, "Outcome");
  assert.equal(BLOCK_LABELS.collaborator, "Collaborator");
  assert.equal(BLOCK_LABELS.organisation, "Organisation");
  assert.equal(BLOCK_LABELS.external_link, "External link");
  assert.equal(BLOCK_LABELS.divider, "Divider");
  assert.equal(BLOCK_LABELS.spacer, "Spacer");
  assert.equal(createEmptyBlock("two_columns").content.columns.length, 2);
  assert.deepEqual(createEmptyBlock("two_columns").content.columns[0].items.map((item) => item.type), ["heading", "text"]);
  assert.deepEqual(createEmptyBlock("link").content, { text: "", url: "" });
  assert.deepEqual(createEmptyBlock("outcome").content, { heading: "", text: "" });
  assert.deepEqual(createEmptyBlock("collaborator").content, { name: "", role: "", url: "" });
  assert.deepEqual(createEmptyBlock("organisation").content, { name: "", location: "", url: "" });
  assert.deepEqual(createEmptyBlock("external_link").content, { label: "", url: "" });
  assert.equal(createEmptyBlock("external_link").settings.width, "standard");
  assert.equal(createEmptyBlock("external_link").settings.spacing, "compact");
  assert.equal(createEmptyBlock("image_grid").settings.columns, 2);
  assert.equal(createEmptyBlock("image_grid").settings.displayMode, "grid");
  assert.equal(createEmptyBlock("image_grid").settings.imageSize, "medium");
  assert.equal(createEmptyBlock("spacer").content.height, 64);
});

test("floating multi-image rows stay balanced without orphan images", () => {
  assert.deepEqual(balancePortfolioImageRows(4), [2, 2]);
  assert.deepEqual(balancePortfolioImageRows(7), [2, 3, 2]);
  assert.deepEqual(balancePortfolioImageRows(8), [3, 2, 3]);
  for (let count = 4; count <= 30; count += 1) {
    const rows = balancePortfolioImageRows(count);
    assert.equal(rows.reduce((total, rowSize) => total + rowSize, 0), count);
    assert.equal(rows.every((rowSize) => rowSize === 2 || rowSize === 3), true);
  }
});

test("portfolio links and two-column links validate and normalise", () => {
  assert.deepEqual(validateBlock({ blockType: "link", content: { text: "Unsafe", url: "javascript:alert(1)" } }), ["Link URL is invalid"]);
  assert.deepEqual(validateBlock({ blockType: "external_link", content: { label: "Unsafe", url: "javascript:alert(1)" } }), ["Link URL is invalid"]);
  assert.deepEqual(validateBlock({ blockType: "collaborator", content: { name: "Unsafe", url: "javascript:alert(1)" } }), ["Link URL is invalid"]);
  assert.deepEqual(validateBlock({ blockType: "two_columns", content: { columns: [{ items: [{ type: "link", url: "https://example.com" }] }, { items: [{ type: "button", url: "javascript:alert(1)" }] }] } }), ["Column 2 button URL is invalid"]);
  const payload = toSavePayload({
    taxonomies: [], organisations: [], collaborators: [], links: [],
    blocks: [
      { blockType: "link", content: { text: "Work", url: "example.com/work" } },
      { blockType: "organisation", content: { name: "Studio", location: "London", url: "studio.example.com" } },
      { blockType: "two_columns", content: { columns: [{ items: [{ type: "link", url: "example.com/one" }] }, { items: [{ type: "button", url: "/two" }] }] } },
    ],
  });
  assert.equal(payload.blocks[0].content.url, "https://example.com/work");
  assert.equal(payload.blocks[1].content.url, "https://studio.example.com/");
  assert.equal(payload.blocks[2].content.columns[0].items[0].url, "https://example.com/one");
  assert.equal(payload.blocks[2].content.columns[1].items[0].url, "/two");
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
  const typed = updateCollaboratorDraft(added, { name: "New collaborator", primaryUrl: "new.example.com" }, () => "unused-id");
  assert.equal(typed.id, "new-collaborator");

  const loaded = { id: "published-collaborator", name: "Original name", roleLabel: "Director", primaryUrl: "legacy.example.com", secondaryUrl: "", organisation: "" };
  const roleEdit = updateCollaboratorDraft(loaded, { roleLabel: "Producer" }, () => "unused-id");
  assert.equal(roleEdit.id, "published-collaborator");
  const roleEditPayload = toSavePayload({ blocks: [], taxonomies: [], organisations: [], collaborators: [roleEdit], links: [] });
  assert.equal(roleEditPayload.collaborators[0].primaryUrl, "legacy.example.com");
  assert.equal(markCollaboratorsPublished([roleEdit])[0].primaryUrl, "legacy.example.com");

  const identityEdit = updateCollaboratorDraft(loaded, { name: "Updated name" }, () => "forked-collaborator");
  assert.equal(identityEdit.id, "forked-collaborator");
  assert.equal(identityEdit._identityEditable, true);
  const continuedEdit = updateCollaboratorDraft(identityEdit, { organisation: "Studio" }, () => "unused-id");
  assert.equal(continuedEdit.id, "forked-collaborator");

  const payload = toSavePayload({ blocks: [], taxonomies: [], organisations: [], collaborators: [continuedEdit], links: [] });
  assert.equal(payload.collaborators[0].id, "forked-collaborator");
  assert.equal(payload.collaborators[0].primaryUrl, "https://legacy.example.com/");
  assert.equal(Object.hasOwn(payload.collaborators[0], "_identityEditable"), false);
  const published = markCollaboratorsPublished([continuedEdit])[0];
  assert.equal(published.primaryUrl, "https://legacy.example.com/");
  assert.equal(Object.hasOwn(published, "_identityEditable"), false);

  const addedPayload = toSavePayload({ blocks: [], taxonomies: [], organisations: [], collaborators: [typed], links: [] });
  assert.equal(addedPayload.collaborators[0].primaryUrl, "https://new.example.com/");
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
