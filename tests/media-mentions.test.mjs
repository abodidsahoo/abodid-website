import assert from "node:assert/strict";
import test from "node:test";
import {
  isSafeMentionUrl,
  mediaMentionPayload,
  normalizeMediaMention,
  normalizeMentionCategories,
  validateMediaMention,
} from "../src/lib/mediaMentions.js";

test("normalizes and deduplicates mention categories", () => {
  assert.deepEqual(
    normalizeMentionCategories(["Press", " press ", "#Film", "Music   Video"]),
    ["Press", "Film", "Music Video"],
  );
});

test("accepts web URLs and internal paths but rejects unsafe destinations", () => {
  assert.equal(isSafeMentionUrl("https://example.com/story"), true);
  assert.equal(isSafeMentionUrl("/films/show-me-the-way"), true);
  assert.equal(isSafeMentionUrl("javascript:alert(1)"), false);
  assert.equal(isSafeMentionUrl("example.com/story"), false);
});

test("normalizes database rows for the editor", () => {
  const mention = normalizeMediaMention({
    title: "Feature",
    published_at: "2026-09-26T11:30:00.000Z",
    categories: null,
    sort_order: "4",
  });

  assert.equal(mention.published_at, "2026-09-26");
  assert.equal(mention.sort_order, 4);
  assert.deepEqual(mention.categories, []);
});

test("builds the minimal database payload", () => {
  const payload = mediaMentionPayload({
    title: "  Feature  ",
    publication: "  Example  ",
    url: " https://example.com/story ",
    published_at: "2026-09-26",
    categories: ["Press", "press"],
    image_url: "",
    image_alt: "  Portrait  ",
    sort_order: 2,
  }, 9, true);

  assert.deepEqual(payload, {
    title: "Feature",
    publication: "Example",
    url: "https://example.com/story",
    published_at: "2026-09-26",
    categories: ["Press"],
    image_url: null,
    image_alt: "Portrait",
    published: true,
    sort_order: 2,
  });
});

test("requires the fields needed by the public card", () => {
  assert.equal(validateMediaMention({}), "Add a title.");
  assert.equal(validateMediaMention({ title: "Feature" }), "Add the publication or collaborator.");
  assert.equal(validateMediaMention({ title: "Feature", publication: "Example", url: "bad" }), "Add a complete https:// link or an internal path beginning with /.");
});
