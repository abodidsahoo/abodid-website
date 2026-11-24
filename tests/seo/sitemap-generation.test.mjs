import test from "node:test";
import assert from "node:assert/strict";
import {
  escapeXml,
  formatCanonicalUrl,
  formatLastmod,
  buildSitemapXml,
  createXmlResponse,
} from "../../src/lib/sitemapHelper.js";
import {
  isPathExcluded,
  shouldIncludeInSitemap,
  shouldNoindex,
} from "../../src/lib/searchVisibility.js";

test("sitemapHelper: escapeXml escapes special XML characters", () => {
  const raw = `Tom & Jerry <"Cartoons"> 'Classic'`;
  const escaped = escapeXml(raw);
  assert.equal(
    escaped,
    "Tom &amp; Jerry &lt;&quot;Cartoons&quot;&gt; &apos;Classic&apos;",
  );
});

test("sitemapHelper: formatCanonicalUrl trims trailing slashes on subpaths", () => {
  const base = new URL("https://abodid.com");
  assert.equal(formatCanonicalUrl(base, "/work/"), "https://abodid.com/work");
  assert.equal(
    formatCanonicalUrl(base, "/films/my-film/"),
    "https://abodid.com/films/my-film",
  );
  assert.equal(formatCanonicalUrl(base, "/"), "https://abodid.com/");
  assert.equal(formatCanonicalUrl(base, ""), "https://abodid.com/");
});

test("sitemapHelper: formatLastmod returns ISO string or null", () => {
  assert.equal(
    formatLastmod("2026-09-03T12:00:00Z"),
    "2026-09-03T12:00:00.000Z",
  );
  assert.equal(formatLastmod(new Date("2026-01-15T00:00:00Z")), "2026-01-15T00:00:00.000Z");
  assert.equal(formatLastmod("invalid-date-string"), null);
  assert.equal(formatLastmod(null), null);
  assert.equal(formatLastmod(undefined), null);
});

test("sitemapHelper: buildSitemapXml enforces rules: no priority, no changefreq, deduplication", () => {
  const entries = [
    { url: "https://abodid.com/work/project-a", lastmod: "2026-09-01T00:00:00Z" },
    { url: "https://abodid.com/work/project-a", lastmod: "2026-09-02T00:00:00Z" }, // Duplicate URL
    { url: "https://abodid.com/work/project-b" },
  ];

  const xml = buildSitemapXml(entries);

  // Must have XML declaration and urlset
  assert.ok(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>'));
  assert.ok(xml.includes('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'));

  // Deduplication: project-a should only appear once
  const projectACount = (xml.match(/https:\/\/abodid\.com\/work\/project-a/g) || []).length;
  assert.equal(projectACount, 1);

  // No priority or changefreq
  assert.ok(!xml.includes("<priority>"));
  assert.ok(!xml.includes("<changefreq>"));

  // Valid lastmod included
  assert.ok(xml.includes("<lastmod>2026-09-01T00:00:00.000Z</lastmod>"));
});

test("sitemapHelper: createXmlResponse returns valid Response with XML content-type", () => {
  const xml = '<?xml version="1.0" encoding="UTF-8"?><urlset></urlset>';
  const response = createXmlResponse(xml, 600);

  assert.equal(response.status, 200);
  assert.equal(
    response.headers.get("Content-Type"),
    "application/xml; charset=utf-8",
  );
  assert.ok(
    response.headers.get("Cache-Control")?.includes("max-age=600"),
  );
});

test("searchVisibility: correctly excludes private and test routes", () => {
  assert.equal(isPathExcluded("/admin"), true);
  assert.equal(isPathExcluded("/admin/projects"), true);
  assert.equal(isPathExcluded("/api/vault-search"), true);
  assert.equal(isPathExcluded("/club/payment-success"), true);
  assert.equal(isPathExcluded("/landing-grid-test"), true);
  assert.equal(isPathExcluded("/hand-tracking-test"), true);
  assert.equal(isPathExcluded("/july-backup"), true);

  // Public routes should NOT be excluded
  assert.equal(isPathExcluded("/work"), false);
  assert.equal(isPathExcluded("/work/spatial-memory"), false);
  assert.equal(isPathExcluded("/films"), false);
  assert.equal(isPathExcluded("/films/the-sculptor"), false);
  assert.equal(isPathExcluded("/photography"), false);
  assert.equal(isPathExcluded("/blog/obsidian-workflows"), false);
  assert.equal(isPathExcluded("/obsidian-vault/my-note"), false);
  assert.equal(isPathExcluded("/research-papers/memory-and-place"), false);
});

test("searchVisibility: shouldIncludeInSitemap and shouldNoindex consistency", () => {
  assert.equal(shouldIncludeInSitemap("https://abodid.com/admin"), false);
  assert.equal(shouldIncludeInSitemap("https://abodid.com/api/test"), false);
  assert.equal(shouldIncludeInSitemap("https://abodid.com/work"), true);
  assert.equal(shouldIncludeInSitemap("https://abodid.com/work/spatial-memory"), true);
  assert.equal(shouldIncludeInSitemap("https://abodid.com/photography/a-series"), true);
  assert.equal(shouldIncludeInSitemap("https://abodid.com/obsidian-vault/a-note"), true);
  assert.equal(shouldIncludeInSitemap("https://abodid.com/research/"), true);

  assert.equal(shouldNoindex("/admin"), true);
  assert.equal(shouldNoindex("/work"), false);
});

test("searchVisibility: new public destinations and content are discoverable without promoting tools or aliases", () => {
  for (const path of [
    "/sitemap", "/newsletter", "/creative-tech-toolkit", "/moodboard",
    "/consulting", "/workshops/obsidian", "/lab/moodboard-capture-pipeline",
    "/lab/art-in-every-corner", "/films/a-published-film", "/blog/a-new-essay",
    "/research-papers/a-paper", "/system-manual/01-overview/introduction",
  ]) assert.equal(shouldIncludeInSitemap(`https://abodid.com${path}`), true, path);

  for (const path of [
    "/land", "/header-preview", "/footer-preview", "/media-delivery-test",
    "/opportunities/auth/callback", "/resources/login", "/resources/submit",
    "/resources/saved", "/resources/an-id/edit", "/work/layout-preview",
    "/obsidian-vault/assets/image.png", "/obsidian-vault/tag/old-alias",
    "/feeds/blog.xml", "/photography-portfolio/series.json", "/archive/homepages/2025",
  ]) assert.equal(shouldIncludeInSitemap(`https://abodid.com${path}`), false, path);
});
