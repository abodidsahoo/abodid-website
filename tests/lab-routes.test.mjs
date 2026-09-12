import assert from "node:assert/strict";
import test from "node:test";

import {
  getLabCanonicalRedirect,
  getLabSubdomainRedirect,
  isLabHostname,
  labDestination,
  labPublicPath,
  labUrl,
  legacyLabRedirectLocation,
} from "../src/lib/labRoutes.js";

const destinationFor = (pathname) =>
  legacyLabRedirectLocation(new URL(pathname, "https://abodid.com"));

test("moves the former experiment routes into the lab", () => {
  assert.equal(destinationFor("/research/lab"), "https://lab.abodid.com/");
  assert.equal(destinationFor("/punctum"), "https://lab.abodid.com/punctum");
  assert.equal(destinationFor("/research/punctum/experiment"), "https://lab.abodid.com/punctum/experiment");
  assert.equal(destinationFor("/research/gesture-image-preview/launch"), "https://lab.abodid.com/image-flick");
  assert.equal(destinationFor("/research/polaroid-hub/the-hub"), "https://lab.abodid.com/photo-board");
});

test("preserves nested Punctum paths and query parameters", () => {
  assert.equal(
    destinationFor("/research/punctum/results/photo-one?session=abc"),
    "https://lab.abodid.com/punctum/results/photo-one?session=abc",
  );
});

test("does not redirect unrelated research routes", () => {
  assert.equal(destinationFor("/research/glyph-loom"), null);
  assert.equal(destinationFor("/lab/punctum"), "https://lab.abodid.com/punctum");
  assert.equal(
    legacyLabRedirectLocation(new URL("https://preview.example/lab")),
    null,
  );
});

test("keeps public Lab URLs free of the internal /lab route prefix", () => {
  assert.equal(labPublicPath("/lab"), "/");
  assert.equal(labPublicPath("/lab/punctum/results"), "/punctum/results");
  assert.equal(labUrl("/lab/image-flick"), "https://lab.abodid.com/image-flick");
  assert.equal(
    getLabCanonicalRedirect(new URL("https://lab.abodid.com/lab/punctum?from=old")),
    "https://lab.abodid.com/punctum?from=old",
  );
});

test("routes lab subdomain to appropriate lab pages", () => {
  assert.equal(isLabHostname("lab.abodid.com"), true);
  assert.equal(isLabHostname("lab.abodid.com:4321"), true);
  assert.equal(isLabHostname("abodid.com"), false);

  assert.equal(labDestination(new URL("https://lab.abodid.com/")), "/lab");
  assert.equal(labDestination(new URL("https://lab.abodid.com/robots.txt")), "/lab-robots.txt");
  assert.equal(labDestination(new URL("https://lab.abodid.com/sitemap.xml")), "/lab-sitemap.xml");
  assert.equal(labDestination(new URL("https://lab.abodid.com/punctum")), "/lab/punctum");
  assert.equal(labDestination(new URL("https://lab.abodid.com/punctum/about")), "/lab/punctum/about");
  assert.equal(labDestination(new URL("https://lab.abodid.com/image-flick")), "/lab/image-flick");
  assert.equal(labDestination(new URL("https://lab.abodid.com/photo-board")), "/lab/photo-board");
  assert.equal(labDestination(new URL("https://abodid.com/")), null);
});

test("redirects non-lab routes on lab subdomain to primary site", () => {
  assert.equal(
    getLabSubdomainRedirect(new URL("https://lab.abodid.com/research")),
    "https://abodid.com/research",
  );
  assert.equal(
    getLabSubdomainRedirect(new URL("https://lab.abodid.com/about")),
    "https://abodid.com/about",
  );
  assert.equal(
    getLabSubdomainRedirect(new URL("https://lab.abodid.com/work")),
    "https://abodid.com/work",
  );
  assert.equal(
    getLabSubdomainRedirect(new URL("https://lab.abodid.com/photography")),
    "https://abodid.com/photography",
  );
  assert.equal(
    getLabSubdomainRedirect(new URL("https://lab.abodid.com/")),
    null,
  );
  assert.equal(
    getLabSubdomainRedirect(new URL("https://lab.abodid.com/punctum")),
    null,
  );
  assert.equal(
    getLabSubdomainRedirect(new URL("https://lab.abodid.com/image-flick")),
    null,
  );
  assert.equal(
    getLabSubdomainRedirect(new URL("https://lab.abodid.com/photo-board")),
    null,
  );
});
