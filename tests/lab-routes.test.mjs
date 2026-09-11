import assert from "node:assert/strict";
import test from "node:test";

import { legacyLabRedirectLocation } from "../src/lib/labRoutes.js";

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
