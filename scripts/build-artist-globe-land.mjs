// Build a local curved, faceted mesh from the public-domain Natural Earth snapshot.
import { readFileSync, writeFileSync } from "node:fs";
import { ShapeUtils, Vector2 } from "three";
const polygons = JSON.parse(
  readFileSync(
    new URL("../public/data/artist-globe/land.json", import.meta.url),
  ),
);
const vertices = [];
const emit = (a, b, c) => {
  const edges = [
    [a, b, c],
    [b, c, a],
    [c, a, b],
  ].sort(
    (x, y) =>
      Math.hypot(x[0][0] - x[1][0], x[0][1] - x[1][1]) -
      Math.hypot(y[0][0] - y[1][0], y[0][1] - y[1][1]),
  );
  const [p, q, r] = edges[2];
  if (Math.hypot(p[0] - q[0], p[1] - q[1]) > 3) {
    const m = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
    emit(p, m, r);
    emit(m, q, r);
    return;
  }
  for (const [lon, lat] of [a, b, c]) {
    const phi = (lat * Math.PI) / 180,
      theta = (lon * Math.PI) / 180;
    vertices.push(
      1.003 * Math.cos(phi) * Math.cos(theta),
      1.003 * Math.sin(phi),
      -1.003 * Math.cos(phi) * Math.sin(theta),
    );
  }
};
for (const polygon of polygons) {
  const rings = polygon.map((r) => {
    const points = r.map(([x, y]) => new Vector2(x, y));
    if (points[0].equals(points.at(-1))) points.pop();
    return points;
  });
  const flat = rings.flat();
  const triangles = ShapeUtils.triangulateShape(rings[0], rings.slice(1));
  for (const ids of triangles) emit(...ids.map((i) => [flat[i].x, flat[i].y]));
}
const positions = [],
  indices = [],
  unique = new Map();
for (let i = 0; i < vertices.length; i += 3) {
  const quantized = vertices
    .slice(i, i + 3)
    .map((v) => Math.round((v / 1.003) * 32767));
  const key = quantized.join(",");
  let index = unique.get(key);
  if (index === undefined) {
    index = positions.length / 3;
    unique.set(key, index);
    positions.push(...quantized);
  }
  indices.push(index);
}
const result = JSON.stringify({ positions, indices });
writeFileSync(
  new URL("../public/data/artist-globe/land-mesh.json", import.meta.url),
  result,
);
console.log(
  `${indices.length / 3} land triangles, ${positions.length / 3} unique vertices, ${result.length} JSON bytes`,
);
