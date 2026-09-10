import assert from "node:assert/strict";
import test from "node:test";

import {
  createNoteIndexRecord,
  extractExplicitTags,
  extractFirstExplicitTag,
  extractVaultNoteMetadata,
  stripLegacyVaultMetadata,
} from "../../src/lib/vault-rag.js";

test("extracts note type, date, and topic tags from YAML frontmatter", () => {
  const markdown = `---
title: A useful quotation
date: 2026-09-10
note_type: "[[quotes]]"
tags:
  - creativity
  - "[[writing|Writing]]"
---

The note body starts here.`;

  const metadata = extractVaultNoteMetadata(markdown);
  assert.deepEqual(metadata.noteTypes, ["quotes"]);
  assert.deepEqual(metadata.tags, ["creativity", "writing"]);
  assert.equal(metadata.content.trim(), "The note body starts here.");
  assert.ok(metadata.date);

  const record = createNoteIndexRecord({
    filePath: "6 - Main Notes/a-useful-quotation.md",
    markdown,
  });

  assert.deepEqual(record.tags, ["creativity", "writing"]);
  assert.ok(record.wiki_links.includes("quotes"));
  assert.ok(record.wiki_links.includes("creativity"));
  assert.ok(record.wiki_links.includes("writing"));
});

test("extracts tags only from an explicit Tags: line", () => {
  const markdown = [
    "Note Type: [[my-thoughts]]",
    "Tags: [[learning]], [[learning-methodology]], [[efficiency]]",
    "",
    "A body link to [[another-note]].",
  ].join("\n");

  assert.deepEqual(extractExplicitTags(markdown), [
    "learning",
    "learning-methodology",
    "efficiency",
  ]);
  assert.equal(extractFirstExplicitTag(markdown), "learning");
});

test("keeps legacy note metadata out of the article while older index rows catch up", () => {
  const markdown = [
    "2025-03-20  07:57",
    "Note Type: [[quotes]]",
    "Tags: [[chess]], [[win]]",
    "",
    "This chess analogy is the actual note body.",
  ].join("\n");

  const metadata = extractVaultNoteMetadata(markdown);
  assert.equal(metadata.date, "2025-03-20  07:57");
  assert.deepEqual(metadata.noteTypes, ["quotes"]);
  assert.deepEqual(metadata.tags, ["chess", "win"]);
  assert.equal(
    stripLegacyVaultMetadata(metadata.content),
    "This chess analogy is the actual note body.",
  );
});

test("supports bold and Dataview-style Tags metadata", () => {
  assert.deepEqual(
    extractExplicitTags("**Tags:** [[Film Theory]], [[Research|research alias]]"),
    ["Film Theory", "Research"],
  );
  assert.deepEqual(extractExplicitTags("- Tags:: [[one#section]], [[two.md]]"), [
    "one",
    "two",
  ]);
});

test("leaves first_tag empty when an explicit Tags: line is unavailable", () => {
  const markdown = "Note Type: [[essay]]\n\nA note connected to [[research]].";
  const record = createNoteIndexRecord({
    filePath: "6 - Main Notes/untagged-note.md",
    markdown,
    sourceSha: "github-sha",
  });

  assert.deepEqual(record.tags, []);
  assert.equal(record.first_tag, null);
  assert.equal(record.source_sha, "github-sha");
  assert.equal(record.markdown_content, markdown);
});
