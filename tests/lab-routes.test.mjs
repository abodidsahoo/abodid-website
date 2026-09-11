import assert from "node:assert/strict";
import test from "node:test";

import { isLabHostname, labDestination, legacyLabRedirectLocation } from "../src/lib/labRoutes.js";

const destinationFor = (pathname) =>
  legacyLabRedirectLocation(new URL(pathname, "https://abodid.com"));

test("moves the former experiment routes into the lab", () => {
  assert.equal(destinationFor("/research/lab"), "/lab");
  assert.equal(destinationFor("/punctum"), "/lab/punctum");
  assert.equal(destinationFor("/research/punctum/experiment"), "/lab/punctum/experiment");
  assert.equal(destinationFor("/research/gesture-image-preview/launch"), "/lab/image-flick");
  assert.equal(destinationFor("/research/polaroid-hub/the-hub"), "/lab/photo-board");
});

test("preserves nested Punctum paths and query parameters", () => {
  assert.equal(
    destinationFor("/research/punctum/results/photo-one?session=abc"),
    "/lab/punctum/results/photo-one?session=abc",
  );
});

test("does not redirect unrelated research routes", () => {
  assert.equal(destinationFor("/research/glyph-loom"), null);
  assert.equal(destinationFor("/lab/punctum"), null);
});

test("routes lab subdomain to appropriate lab pages", () => {
  assert.equal(isLabHostname("lab.abodid.com"), true);
  assert.equal(isLabHostname("lab.abodid.com:4321"), true);
  assert.equal(isLabHostname("abodid.com"), false);

  assert.equal(labDestination(new URL("https://lab.abodid.com/")), "/lab");
  assert.equal(labDestination(new URL("https://lab.abodid.com/punctum")), "/lab/punctum");
  assert.equal(labDestination(new URL("https://lab.abodid.com/punctum/about")), "/lab/punctum/about");
  assert.equal(labDestination(new URL("https://lab.abodid.com/image-flick")), "/lab/image-flick");
  assert.equal(labDestination(new URL("https://lab.abodid.com/photo-board")), "/lab/photo-board");
  assert.equal(labDestination(new URL("https://abodid.com/")), null);
});

