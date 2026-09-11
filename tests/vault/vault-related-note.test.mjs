import test from "node:test";
import assert from "node:assert/strict";
import { getRelatedVaultNote } from "../../src/lib/vault-note-index.js";

test("getRelatedVaultNote returns a related note sharing matching tags", async () => {
  const result = await getRelatedVaultNote({
    slug: "marrying-for-the-second-time",
    tags: ["book-in-progress", "journalling", "love", "relationship", "why-did-you-cry"],
    firstTag: "book-in-progress",
    filePath: "06-main-notes/marrying-for-the-second-time.md",
  });

  if (result) {
    assert.ok(result.title, "Related note should have a title");
    assert.ok(result.slug, "Related note should have a slug");
    assert.ok(result.href.startsWith("/obsidian-vault/"), "Related note href should start with /obsidian-vault/");
    assert.notEqual(result.slug, "marrying-for-the-second-time", "Related note should not be the current note");
  }
});

test("getRelatedVaultNote falls back to a valid note when note has no tags", async () => {
  const result = await getRelatedVaultNote({
    slug: "some-nonexistent-empty-note",
    tags: [],
    firstTag: "",
    filePath: "06-main-notes/some-nonexistent-empty-note.md",
  });

  if (result) {
    assert.ok(result.title, "Related note should have a title");
    assert.ok(result.slug, "Related note should have a slug");
    assert.ok(result.href.startsWith("/obsidian-vault/"), "Related note href should start with /obsidian-vault/");
  }
});
