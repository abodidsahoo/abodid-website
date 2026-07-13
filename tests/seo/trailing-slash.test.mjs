import assert from "node:assert/strict";
import test from "node:test";

import {
  getCanonicalPageUrl,
  normalizePagePath,
} from "../../src/lib/urlNormalization.js";

test("keeps the site root slash", () => {
  assert.equal(normalizePagePath("/"), "/");
  assert.equal(getCanonicalPageUrl("https://abodid.com", "/"), "https://abodid.com/");
});

test("removes one or more trailing slashes from page routes", () => {
  assert.equal(normalizePagePath("/services/"), "/services");
  assert.equal(normalizePagePath("/work/invisible-punctum///"), "/work/invisible-punctum");
});

test("does not alter file or API URLs that have no trailing slash", () => {
  assert.equal(normalizePagePath("/rss.xml"), "/rss.xml");
  assert.equal(normalizePagePath("/api/og"), "/api/og");
});

test("builds absolute no-slash canonical URLs", () => {
  assert.equal(
    getCanonicalPageUrl("https://abodid.com", "/research/obsidian-vault/"),
    "https://abodid.com/research/obsidian-vault",
  );
});
