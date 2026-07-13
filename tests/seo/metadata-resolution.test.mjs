import assert from "node:assert/strict";
import test from "node:test";

import {
  formatSeoTitle,
  getSeoReadiness,
  mergeManagedSeoPages,
  normalizeSeoPagePath,
  resolvePageSeo,
} from "../../src/lib/seoMetadata.js";

test("normalizes paths used as metadata keys", () => {
  assert.equal(normalizeSeoPagePath("services/"), "/services");
  assert.equal(normalizeSeoPagePath("/"), "/");
});

test("published admin metadata overrides page defaults", () => {
  const resolved = resolvePageSeo({
    defaults: {
      title: "Hard-coded title",
      description: "Hard-coded description",
      image: "/default.jpg",
    },
    metadata: {
      is_active: true,
      meta_title: "Admin title",
      meta_description: "Admin description",
      og_image_url: "/social.jpg",
      og_image_alt: "Social preview",
      robots_index: false,
    },
  });

  assert.equal(resolved.title, "Admin title");
  assert.equal(resolved.description, "Admin description");
  assert.equal(resolved.image, "/social.jpg");
  assert.equal(resolved.imageAlt, "Social preview");
  assert.equal(resolved.noindex, true);
  assert.equal(resolved.hasPublishedOverride, true);
});

test("inactive metadata falls back to page defaults", () => {
  const resolved = resolvePageSeo({
    defaults: { title: "Page title", description: "Page description" },
    metadata: {
      is_active: false,
      meta_title: "Draft title",
      meta_description: "Draft description",
      robots_index: false,
    },
  });

  assert.equal(resolved.title, "Page title");
  assert.equal(resolved.description, "Page description");
  assert.equal(resolved.noindex, false);
  assert.equal(resolved.hasPublishedOverride, false);
});

test("formats titles without repeating the site name", () => {
  assert.equal(formatSeoTitle("Services"), "Services | Abodid Sahoo");
  assert.equal(formatSeoTitle("About | Abodid Sahoo"), "About | Abodid Sahoo");
});

test("merges configured records into the managed page inventory", () => {
  const pages = mergeManagedSeoPages([
    {
      id: "home-id",
      page_path: "/",
      page_title: "Homepage",
      meta_title: "Abodid Sahoo",
    },
    { id: "custom-id", page_path: "/custom/", page_title: "Custom" },
  ]);

  assert.equal(pages.find((page) => page.page_path === "/")?.id, "home-id");
  assert.equal(
    pages.find((page) => page.page_path === "/custom")?.id,
    "custom-id",
  );
});

test("requires a focus phrase and social alt text for readiness", () => {
  const readiness = getSeoReadiness({
    id: "page-id",
    is_active: true,
    meta_title: "Page",
    meta_description: "Description",
    focus_keyword: "creative technology",
    og_image_url: "https://example.com/og.jpg",
    og_image_alt: "Creative technology project preview",
  });

  assert.deepEqual(readiness, {
    state: "ready",
    searchReady: true,
    socialReady: true,
  });
});
