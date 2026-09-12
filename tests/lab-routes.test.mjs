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

test("moves the former experiment routes into the lab on main site", () => {
  assert.equal(destinationFor("/research/lab"), "https://abodid.com/lab");
  assert.equal(destinationFor("/punctum"), "https://abodid.com/lab/punctum");
  assert.equal(destinationFor("/research/punctum/experiment"), "https://abodid.com/lab/punctum/experiment");
  assert.equal(destinationFor("/research/gesture-image-preview/launch"), "https://abodid.com/lab/image-flick");
  assert.equal(destinationFor("/research/polaroid-hub/the-hub"), "https://abodid.com/lab/photo-board");
});

test("preserves nested Punctum paths and query parameters", () => {
  assert.equal(
    destinationFor("/research/punctum/results/photo-one?session=abc"),
    "https://abodid.com/lab/punctum/results/photo-one?session=abc",
  );
});

test("does not redirect main-site /lab routes", () => {
  assert.equal(destinationFor("/lab"), null);
  assert.equal(destinationFor("/lab/punctum"), null);
  assert.equal(destinationFor("/lab/image-flick"), null);
  assert.equal(destinationFor("/lab/photo-board"), null);
  assert.equal(destinationFor("/research/glyph-loom"), null);
  assert.equal(
    legacyLabRedirectLocation(new URL("https://preview.example/lab")),
    null,
  );
});

test("formats lab URLs with /lab prefix on primary domain", () => {
  assert.equal(labPublicPath("/lab"), "/lab");
  assert.equal(labPublicPath("/lab/punctum/results"), "/lab/punctum/results");
  assert.equal(labPublicPath("/punctum"), "/lab/punctum");
  assert.equal(labPublicPath("/image-flick"), "/lab/image-flick");
  assert.equal(labUrl("/lab/image-flick"), "https://abodid.com/lab/image-flick");
  assert.equal(labUrl("/image-flick"), "https://abodid.com/lab/image-flick");
});

test("identifies lab hostname", () => {
  assert.equal(isLabHostname("lab.abodid.com"), true);
  assert.equal(isLabHostname("lab.abodid.com:4321"), true);
  assert.equal(isLabHostname("abodid.com"), false);
});

test("redirects lab subdomain to primary site /lab routes", () => {
  assert.equal(
    getLabSubdomainRedirect(new URL("https://lab.abodid.com/")),
    "https://abodid.com/lab",
  );
  assert.equal(
    getLabSubdomainRedirect(new URL("https://lab.abodid.com/punctum")),
    "https://abodid.com/lab/punctum",
  );
  assert.equal(
    getLabSubdomainRedirect(new URL("https://lab.abodid.com/image-flick")),
    "https://abodid.com/lab/image-flick",
  );
  assert.equal(
    getLabSubdomainRedirect(new URL("https://lab.abodid.com/photo-board")),
    "https://abodid.com/lab/photo-board",
  );
  assert.equal(
    getLabSubdomainRedirect(new URL("https://lab.abodid.com/research")),
    "https://abodid.com/research",
  );
  assert.equal(
    getLabSubdomainRedirect(new URL("https://lab.abodid.com/about")),
    "https://abodid.com/about",
  );
});

