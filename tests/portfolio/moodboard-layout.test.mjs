import test from "node:test";
import assert from "node:assert/strict";

import { computeFloatingLayout, getFloatingImageSizePreset, getFloatingStageSize, hashString } from "../../src/lib/moodboardLayout.js";

function intersectionArea(first, second) {
  const width = Math.max(0, Math.min(first.left + first.width, second.left + second.width) - Math.max(first.left, second.left));
  const height = Math.max(0, Math.min(first.top + first.height, second.top + second.height) - Math.max(first.top, second.top));
  return width * height;
}

test("the shared mood-board engine creates deterministic scale, overlap, and depth variation", () => {
  const ratios = [1.5, .75, 1, 1.8, .6, 1.2, .8, 1.4, .7];
  const items = ratios.map((aspectRatio, index) => ({ id: `image-${index}`, aspectRatio }));
  const stage = getFloatingStageSize({ width: 1200, viewportHeight: 900, itemCount: items.length });
  const seed = hashString("test-block");
  const first = [...computeFloatingLayout(items, stage.width, stage.height, seed).values()];
  const second = [...computeFloatingLayout(items, stage.width, stage.height, seed).values()];

  assert.deepEqual(first, second);
  assert.equal(first.length, items.length);
  assert.ok(new Set(first.map((item) => Math.round(item.width))).size >= 4);
  assert.ok(new Set(first.map((item) => item.zIndex)).size >= 4);
  assert.ok(first.some((item, index) => first.slice(index + 1).some((next) => intersectionArea(item, next) > 0)));
  first.forEach((item) => {
    assert.ok(item.left >= 0 && item.top >= 0);
    assert.ok(item.left + item.width <= stage.width);
    assert.ok(item.top + item.height <= stage.height);
  });
});

test("floating portfolio image sizes bridge the moodboard and UK 2026 scales", () => {
  const small = getFloatingImageSizePreset("small");
  const medium = getFloatingImageSizePreset("medium");
  const large = getFloatingImageSizePreset("large");

  assert.deepEqual(small, { sizeMultiplier: 1, minScale: .24 });
  assert.deepEqual(large, { sizeMultiplier: 1.85, minScale: .65 });
  assert.equal(medium.sizeMultiplier, (small.sizeMultiplier + large.sizeMultiplier) / 2);
  assert.equal(medium.minScale, (small.minScale + large.minScale) / 2);
  assert.equal(getFloatingImageSizePreset("unknown"), medium);
});
