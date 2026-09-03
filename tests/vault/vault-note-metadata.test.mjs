import assert from "node:assert/strict";
import test from "node:test";

import {
  createNoteIndexRecord,
  extractExplicitTags,
  extractFirstExplicitTag,
} from "../../src/lib/vault-rag.js";

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
