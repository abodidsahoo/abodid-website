import assert from "node:assert/strict";
import { test } from "vitest";

import {
  derivePunctumPolygon,
  getObjectFitContainGeometry,
  getObjectFitCoverGeometry,
  normalizePointerPoint,
  pointInPolygon,
  validatePolygonVertices,
  verticesToSmoothSvgPath,
} from "../../src/lib/punctum/geometry.ts";

test("contain geometry preserves a landscape photograph without cropping", () => {
  const geometry = getObjectFitContainGeometry(800, 800, 1920, 1280);
  assert.equal(geometry.x, 0);
  assert.equal(geometry.width, 800);
  assert.ok(Math.abs(geometry.y - 400 / 3) < 1e-10);
  assert.ok(Math.abs(geometry.height - 1600 / 3) < 1e-10);
});

test("pointer coordinates normalize against the contained image, not the window", () => {
  const geometry = getObjectFitContainGeometry(800, 800, 1920, 1280);
  assert.deepEqual(
    normalizePointerPoint(410, 410, { left: 10, top: 10 }, geometry),
    { x: 0.5, y: 0.5 },
  );
  assert.equal(
    normalizePointerPoint(410, 60, { left: 10, top: 10 }, geometry),
    null,
  );
});

test("cover geometry fills the frame with an even centered crop", () => {
  const geometry = getObjectFitCoverGeometry(800, 600, 1200, 1200);
  assert.equal(geometry.x, 0);
  assert.equal(geometry.width, 800);
  assert.equal(geometry.y, -100);
  assert.equal(geometry.height, 800);

  const landscape = getObjectFitCoverGeometry(800, 600, 1600, 900);
  assert.ok(Math.abs(landscape.x + 400 / 3) < 1e-10);
  assert.ok(Math.abs(landscape.width - 3200 / 3) < 1e-10);
  assert.equal(landscape.y, 0);
  assert.equal(landscape.height, 600);
});

test("pointer coordinates normalize against the centered cover crop", () => {
  const geometry = getObjectFitCoverGeometry(800, 600, 1600, 900);
  assert.deepEqual(
    normalizePointerPoint(410, 310, { left: 10, top: 10 }, geometry),
    { x: 0.5, y: 0.5 },
  );
  const topLeft = normalizePointerPoint(
    10,
    10,
    { left: 10, top: 10 },
    geometry,
  );
  assert.ok(Math.abs(topLeft.x - 0.125) < 1e-10);
  assert.equal(topLeft.y, 0);
});

test("a tap becomes a visible valid hexagon", () => {
  const polygon = derivePunctumPolygon([{ x: 0.5, y: 0.5, t: 0 }]);
  assert.ok(polygon);
  assert.equal(polygon.vertexCount, 6);
  assert.equal(polygon.drawingType, "tap");
  assert.ok(polygon.normalizedArea > 0);
  assert.equal(validatePolygonVertices(polygon.vertices), true);
});

test("polygon vertices create a closed, softly curved display path", () => {
  const path = verticesToSmoothSvgPath([
    { x: 0.2, y: 0.2 },
    { x: 0.8, y: 0.2 },
    { x: 0.75, y: 0.8 },
    { x: 0.25, y: 0.75 },
  ]);
  assert.match(path, /^M 20 20 C /);
  assert.equal((path.match(/ C /g) || []).length, 4);
  assert.match(path, / Z$/);
});

test("line and scribble strokes produce simple normalized polygons", () => {
  const line = derivePunctumPolygon([
    { x: 0.2, y: 0.2, t: 0 },
    { x: 0.5, y: 0.45, t: 90 },
    { x: 0.8, y: 0.7, t: 180 },
  ]);
  const scribble = derivePunctumPolygon([
    { x: 0.3, y: 0.3, t: 0 },
    { x: 0.6, y: 0.3, t: 50 },
    { x: 0.62, y: 0.58, t: 100 },
    { x: 0.38, y: 0.64, t: 150 },
    { x: 0.31, y: 0.34, t: 200 },
    { x: 0.52, y: 0.48, t: 250 },
  ]);
  assert.ok(line && scribble);
  assert.equal(validatePolygonVertices(line.vertices), true);
  assert.equal(validatePolygonVertices(scribble.vertices), true);
  assert.ok(line.vertexCount >= 3 && line.vertexCount <= 6);
  assert.ok(scribble.vertexCount >= 3 && scribble.vertexCount <= 6);
});

test("self-intersecting and out-of-bounds polygons are rejected", () => {
  assert.equal(
    validatePolygonVertices([
      { x: 0.1, y: 0.1 },
      { x: 0.9, y: 0.9 },
      { x: 0.1, y: 0.9 },
      { x: 0.9, y: 0.1 },
    ]),
    false,
  );
  assert.equal(
    validatePolygonVertices([
      { x: -0.1, y: 0.1 },
      { x: 0.5, y: 0.9 },
      { x: 0.9, y: 0.1 },
    ]),
    false,
  );
});

test("point-in-polygon supports selection-proportion heatmaps", () => {
  const square = [
    { x: 0.2, y: 0.2 },
    { x: 0.8, y: 0.2 },
    { x: 0.8, y: 0.8 },
    { x: 0.2, y: 0.8 },
  ];
  assert.equal(pointInPolygon({ x: 0.5, y: 0.5 }, square), true);
  assert.equal(pointInPolygon({ x: 0.9, y: 0.5 }, square), false);
});
