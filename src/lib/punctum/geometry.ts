export type NormalizedPoint = {
  x: number;
  y: number;
};

export type NormalizedStrokePoint = NormalizedPoint & {
  t: number;
};

export type DrawingType =
  | "tap"
  | "short-mark"
  | "line"
  | "closed-mark"
  | "scribble";

export type DerivedPolygon = {
  vertices: NormalizedPoint[];
  vertexCount: 3 | 4 | 5 | 6;
  centroidX: number;
  centroidY: number;
  normalizedArea: number;
  drawingType: DrawingType;
  polygonFitScore: number;
  brushRadius: number;
  algorithmVersion: "polygon-fit-v1";
};

export type ContainedImageGeometry = {
  x: number;
  y: number;
  width: number;
  height: number;
};

const EPSILON = 1e-7;
const DEFAULT_BRUSH_RADIUS = 0.014;

export const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

const pointDistance = (a: NormalizedPoint, b: NormalizedPoint) =>
  Math.hypot(a.x - b.x, a.y - b.y);

const cross = (
  origin: NormalizedPoint,
  first: NormalizedPoint,
  second: NormalizedPoint,
) =>
  (first.x - origin.x) * (second.y - origin.y) -
  (first.y - origin.y) * (second.x - origin.x);

export const polygonArea = (vertices: NormalizedPoint[]) => {
  if (vertices.length < 3) return 0;
  let sum = 0;
  for (let index = 0; index < vertices.length; index += 1) {
    const current = vertices[index];
    const next = vertices[(index + 1) % vertices.length];
    sum += current.x * next.y - next.x * current.y;
  }
  return Math.abs(sum) / 2;
};

export const polygonCentroid = (vertices: NormalizedPoint[]) => {
  if (!vertices.length) return { x: 0.5, y: 0.5 };
  const signedArea =
    vertices.reduce((sum, current, index) => {
      const next = vertices[(index + 1) % vertices.length];
      return sum + current.x * next.y - next.x * current.y;
    }, 0) / 2;

  if (Math.abs(signedArea) < EPSILON) {
    return {
      x: vertices.reduce((sum, point) => sum + point.x, 0) / vertices.length,
      y: vertices.reduce((sum, point) => sum + point.y, 0) / vertices.length,
    };
  }

  let x = 0;
  let y = 0;
  for (let index = 0; index < vertices.length; index += 1) {
    const current = vertices[index];
    const next = vertices[(index + 1) % vertices.length];
    const factor = current.x * next.y - next.x * current.y;
    x += (current.x + next.x) * factor;
    y += (current.y + next.y) * factor;
  }
  const denominator = 6 * signedArea;
  return { x: clamp01(x / denominator), y: clamp01(y / denominator) };
};

export const getObjectFitContainGeometry = (
  containerWidth: number,
  containerHeight: number,
  imageWidth: number,
  imageHeight: number,
): ContainedImageGeometry => {
  if (
    containerWidth <= 0 ||
    containerHeight <= 0 ||
    imageWidth <= 0 ||
    imageHeight <= 0
  ) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }

  const scale = Math.min(
    containerWidth / imageWidth,
    containerHeight / imageHeight,
  );
  const width = imageWidth * scale;
  const height = imageHeight * scale;
  return {
    x: (containerWidth - width) / 2,
    y: (containerHeight - height) / 2,
    width,
    height,
  };
};

export const getObjectFitCoverGeometry = (
  containerWidth: number,
  containerHeight: number,
  imageWidth: number,
  imageHeight: number,
): ContainedImageGeometry => {
  if (
    containerWidth <= 0 ||
    containerHeight <= 0 ||
    imageWidth <= 0 ||
    imageHeight <= 0
  ) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }

  const scale = Math.max(
    containerWidth / imageWidth,
    containerHeight / imageHeight,
  );
  const width = imageWidth * scale;
  const height = imageHeight * scale;
  return {
    x: (containerWidth - width) / 2,
    y: (containerHeight - height) / 2,
    width,
    height,
  };
};

export const normalizePointerPoint = (
  clientX: number,
  clientY: number,
  containerRect: Pick<DOMRect, "left" | "top">,
  imageGeometry: ContainedImageGeometry,
): NormalizedPoint | null => {
  const localX = clientX - containerRect.left - imageGeometry.x;
  const localY = clientY - containerRect.top - imageGeometry.y;
  if (
    localX < 0 ||
    localY < 0 ||
    localX > imageGeometry.width ||
    localY > imageGeometry.height ||
    imageGeometry.width <= 0 ||
    imageGeometry.height <= 0
  ) {
    return null;
  }

  return {
    x: clamp01(localX / imageGeometry.width),
    y: clamp01(localY / imageGeometry.height),
  };
};

const convexHull = (points: NormalizedPoint[]) => {
  const unique = [
    ...new Map(
      points.map((point) => [
        `${point.x.toFixed(6)}:${point.y.toFixed(6)}`,
        point,
      ]),
    ).values(),
  ].sort((a, b) => a.x - b.x || a.y - b.y);

  if (unique.length <= 2) return unique;
  const lower: NormalizedPoint[] = [];
  for (const point of unique) {
    while (
      lower.length >= 2 &&
      cross(lower[lower.length - 2], lower[lower.length - 1], point) <= 0
    ) {
      lower.pop();
    }
    lower.push(point);
  }
  const upper: NormalizedPoint[] = [];
  for (let index = unique.length - 1; index >= 0; index -= 1) {
    const point = unique[index];
    while (
      upper.length >= 2 &&
      cross(upper[upper.length - 2], upper[upper.length - 1], point) <= 0
    ) {
      upper.pop();
    }
    upper.push(point);
  }
  lower.pop();
  upper.pop();
  return [...lower, ...upper];
};

const createTapHexagon = (center: NormalizedPoint, radius: number) =>
  Array.from({ length: 6 }, (_, index) => {
    const angle = -Math.PI / 2 + (index * Math.PI) / 3;
    return {
      x: clamp01(center.x + Math.cos(angle) * radius),
      y: clamp01(center.y + Math.sin(angle) * radius),
    };
  });

const createLineCapsule = (
  start: NormalizedPoint,
  end: NormalizedPoint,
  radius: number,
) => {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.max(Math.hypot(dx, dy), EPSILON);
  const nx = (-dy / length) * radius;
  const ny = (dx / length) * radius;
  return [
    { x: clamp01(start.x + nx), y: clamp01(start.y + ny) },
    { x: clamp01(end.x + nx), y: clamp01(end.y + ny) },
    { x: clamp01(end.x - nx), y: clamp01(end.y - ny) },
    { x: clamp01(start.x - nx), y: clamp01(start.y - ny) },
  ];
};

const sampleStroke = (stroke: NormalizedStrokePoint[]) => {
  if (stroke.length <= 140) return stroke;
  const sampled: NormalizedStrokePoint[] = [];
  const step = (stroke.length - 1) / 139;
  for (let index = 0; index < 140; index += 1) {
    sampled.push(stroke[Math.round(index * step)]);
  }
  return sampled;
};

const inflateStroke = (
  stroke: NormalizedStrokePoint[],
  brushRadius: number,
) => {
  const cloud: NormalizedPoint[] = [];
  for (const point of sampleStroke(stroke)) {
    for (let index = 0; index < 8; index += 1) {
      const angle = (index * Math.PI) / 4;
      cloud.push({
        x: clamp01(point.x + Math.cos(angle) * brushRadius),
        y: clamp01(point.y + Math.sin(angle) * brushRadius),
      });
    }
  }
  return cloud;
};

const removeLeastSignificantVertex = (vertices: NormalizedPoint[]) => {
  if (vertices.length <= 3) return vertices;
  let removeIndex = 0;
  let smallestTriangle = Number.POSITIVE_INFINITY;
  for (let index = 0; index < vertices.length; index += 1) {
    const previous = vertices[(index - 1 + vertices.length) % vertices.length];
    const current = vertices[index];
    const next = vertices[(index + 1) % vertices.length];
    const triangle = Math.abs(cross(previous, current, next));
    if (triangle < smallestTriangle) {
      smallestTriangle = triangle;
      removeIndex = index;
    }
  }
  return vertices.filter((_, index) => index !== removeIndex);
};

const reduceHull = (hull: NormalizedPoint[], target = 6) => {
  let reduced = [...hull];
  while (reduced.length > target) {
    reduced = removeLeastSignificantVertex(reduced);
  }
  return reduced;
};

const pathLength = (stroke: NormalizedStrokePoint[]) =>
  stroke.reduce(
    (total, point, index) =>
      index === 0 ? total : total + pointDistance(stroke[index - 1], point),
    0,
  );

const classifyDrawing = (
  stroke: NormalizedStrokePoint[],
  length: number,
): DrawingType => {
  if (stroke.length <= 2 || length < 0.012) return "tap";
  if (length < 0.05) return "short-mark";
  const displacement = pointDistance(stroke[0], stroke[stroke.length - 1]);
  if (displacement < Math.min(0.06, length * 0.22)) return "closed-mark";
  if (length / Math.max(displacement, EPSILON) > 2.1) return "scribble";
  return "line";
};

export const derivePunctumPolygon = (
  rawStroke: NormalizedStrokePoint[],
  brushRadius = DEFAULT_BRUSH_RADIUS,
): DerivedPolygon | null => {
  if (!rawStroke.length) return null;
  const stroke = rawStroke
    .filter(
      (point) =>
        Number.isFinite(point.x) &&
        Number.isFinite(point.y) &&
        Number.isFinite(point.t),
    )
    .map((point) => ({
      x: clamp01(point.x),
      y: clamp01(point.y),
      t: Math.max(0, point.t),
    }));
  if (!stroke.length) return null;

  const length = pathLength(stroke);
  const drawingType = classifyDrawing(stroke, length);
  let vertices: NormalizedPoint[];

  if (drawingType === "tap") {
    vertices = createTapHexagon(stroke[0], Math.max(brushRadius * 1.45, 0.02));
  } else if (drawingType === "short-mark" || drawingType === "line") {
    vertices = createLineCapsule(
      stroke[0],
      stroke[stroke.length - 1],
      Math.max(brushRadius, 0.012),
    );
  } else {
    const hull = convexHull(inflateStroke(stroke, brushRadius));
    vertices =
      hull.length >= 3
        ? reduceHull(hull, 6)
        : createTapHexagon(stroke[0], Math.max(brushRadius * 1.45, 0.02));
  }

  if (vertices.length < 3) {
    vertices = createTapHexagon(stroke[0], Math.max(brushRadius * 1.45, 0.02));
  }
  vertices = vertices.slice(0, 6);
  const area = polygonArea(vertices);
  const centroid = polygonCentroid(vertices);
  const inflatedArea = Math.max(
    area,
    Math.PI * brushRadius * brushRadius + length * brushRadius * 2,
  );
  const fitScore = Math.min(0.99, Math.max(0.68, area / inflatedArea));

  return {
    vertices,
    vertexCount: vertices.length as 3 | 4 | 5 | 6,
    centroidX: centroid.x,
    centroidY: centroid.y,
    normalizedArea: area,
    drawingType,
    polygonFitScore: Number(fitScore.toFixed(4)),
    brushRadius,
    algorithmVersion: "polygon-fit-v1",
  };
};

const orientation = (
  first: NormalizedPoint,
  second: NormalizedPoint,
  third: NormalizedPoint,
) => {
  const value = cross(first, second, third);
  if (Math.abs(value) < EPSILON) return 0;
  return value > 0 ? 1 : 2;
};

const onSegment = (
  first: NormalizedPoint,
  point: NormalizedPoint,
  second: NormalizedPoint,
) =>
  point.x <= Math.max(first.x, second.x) + EPSILON &&
  point.x + EPSILON >= Math.min(first.x, second.x) &&
  point.y <= Math.max(first.y, second.y) + EPSILON &&
  point.y + EPSILON >= Math.min(first.y, second.y);

const segmentsIntersect = (
  firstStart: NormalizedPoint,
  firstEnd: NormalizedPoint,
  secondStart: NormalizedPoint,
  secondEnd: NormalizedPoint,
) => {
  const firstOrientation = orientation(firstStart, firstEnd, secondStart);
  const secondOrientation = orientation(firstStart, firstEnd, secondEnd);
  const thirdOrientation = orientation(secondStart, secondEnd, firstStart);
  const fourthOrientation = orientation(secondStart, secondEnd, firstEnd);
  if (
    firstOrientation !== secondOrientation &&
    thirdOrientation !== fourthOrientation
  ) {
    return true;
  }
  return (
    (firstOrientation === 0 && onSegment(firstStart, secondStart, firstEnd)) ||
    (secondOrientation === 0 && onSegment(firstStart, secondEnd, firstEnd)) ||
    (thirdOrientation === 0 && onSegment(secondStart, firstStart, secondEnd)) ||
    (fourthOrientation === 0 && onSegment(secondStart, firstEnd, secondEnd))
  );
};

export const isSimplePolygon = (vertices: NormalizedPoint[]) => {
  if (vertices.length < 3 || vertices.length > 6) return false;
  for (let first = 0; first < vertices.length; first += 1) {
    const firstNext = (first + 1) % vertices.length;
    for (let second = first + 1; second < vertices.length; second += 1) {
      const secondNext = (second + 1) % vertices.length;
      if (
        first === second ||
        firstNext === second ||
        secondNext === first
      ) {
        continue;
      }
      if (
        segmentsIntersect(
          vertices[first],
          vertices[firstNext],
          vertices[second],
          vertices[secondNext],
        )
      ) {
        return false;
      }
    }
  }
  return polygonArea(vertices) > EPSILON;
};

export const validatePolygonVertices = (value: unknown) => {
  if (!Array.isArray(value) || value.length < 3 || value.length > 6) {
    return false;
  }
  const vertices = value as Array<Record<string, unknown>>;
  if (
    !vertices.every(
      (point) =>
        typeof point?.x === "number" &&
        typeof point?.y === "number" &&
        Number.isFinite(point.x) &&
        Number.isFinite(point.y) &&
        point.x >= 0 &&
        point.x <= 1 &&
        point.y >= 0 &&
        point.y <= 1,
    )
  ) {
    return false;
  }
  return isSimplePolygon(vertices as NormalizedPoint[]);
};

export const pointInPolygon = (
  point: NormalizedPoint,
  vertices: NormalizedPoint[],
) => {
  let inside = false;
  for (
    let index = 0, previous = vertices.length - 1;
    index < vertices.length;
    previous = index, index += 1
  ) {
    const currentPoint = vertices[index];
    const previousPoint = vertices[previous];
    const intersects =
      currentPoint.y > point.y !== previousPoint.y > point.y &&
      point.x <
        ((previousPoint.x - currentPoint.x) * (point.y - currentPoint.y)) /
          (previousPoint.y - currentPoint.y + EPSILON) +
          currentPoint.x;
    if (intersects) inside = !inside;
  }
  return inside;
};

export const verticesToSvgPoints = (vertices: NormalizedPoint[]) =>
  vertices.map((point) => `${point.x * 100},${point.y * 100}`).join(" ");

export const verticesToSmoothSvgPath = (
  vertices: NormalizedPoint[],
  tension = 0.68,
) => {
  if (vertices.length < 3) return "";

  const curve = Math.min(1, Math.max(0, tension)) / 6;
  const points = vertices.map((point) => ({
    x: point.x * 100,
    y: point.y * 100,
  }));
  const format = (value: number) => Number(value.toFixed(3));
  const commands = [`M ${format(points[0].x)} ${format(points[0].y)}`];

  for (let index = 0; index < points.length; index += 1) {
    const previous = points[(index - 1 + points.length) % points.length];
    const current = points[index];
    const next = points[(index + 1) % points.length];
    const afterNext = points[(index + 2) % points.length];
    const firstControl = {
      x: current.x + (next.x - previous.x) * curve,
      y: current.y + (next.y - previous.y) * curve,
    };
    const secondControl = {
      x: next.x - (afterNext.x - current.x) * curve,
      y: next.y - (afterNext.y - current.y) * curve,
    };
    commands.push(
      `C ${format(firstControl.x)} ${format(firstControl.y)} ` +
        `${format(secondControl.x)} ${format(secondControl.y)} ` +
        `${format(next.x)} ${format(next.y)}`,
    );
  }

  return `${commands.join(" ")} Z`;
};
