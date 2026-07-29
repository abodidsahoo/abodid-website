import type { NormalizedPoint } from "./geometry";

export type PublicPunctumPolygon = {
  id: string;
  vertices: NormalizedPoint[];
  centroidX: number;
  centroidY: number;
  normalizedArea: number;
  drawingType: string;
  createdAt?: string;
  annotation?: string;
  generations?: Array<Record<string, unknown>>;
};

const hashString = (value: string) => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const randomFromSeed = (seed: number) => {
  let state = seed || 1;
  return () => {
    state = Math.imul(state ^ (state >>> 15), 1 | state);
    state ^= state + Math.imul(state ^ (state >>> 7), 61 | state);
    return ((state ^ (state >>> 14)) >>> 0) / 4294967296;
  };
};

/**
 * Clearly-labelled illustrative polygons for an empty results page. These are
 * never saved or mixed with research records.
 */
export const createIllustrativePolygons = (
  imageId: string,
  count = 18,
): PublicPunctumPolygon[] => {
  const random = randomFromSeed(hashString(imageId));
  const anchorX = 0.28 + random() * 0.44;
  const anchorY = 0.28 + random() * 0.44;

  return Array.from({ length: count }, (_, index) => {
    const vertexCount = 3 + Math.floor(random() * 4);
    const centerX = Math.min(0.88, Math.max(0.12, anchorX + (random() - 0.5) * 0.24));
    const centerY = Math.min(0.88, Math.max(0.12, anchorY + (random() - 0.5) * 0.2));
    const radiusX = 0.035 + random() * 0.09;
    const radiusY = 0.03 + random() * 0.075;
    const vertices = Array.from({ length: vertexCount }, (_, vertexIndex) => {
      const angle =
        -Math.PI / 2 +
        (vertexIndex * Math.PI * 2) / vertexCount +
        (random() - 0.5) * 0.22;
      return {
        x: Math.min(
          0.98,
          Math.max(0.02, centerX + Math.cos(angle) * radiusX * (0.82 + random() * 0.36)),
        ),
        y: Math.min(
          0.98,
          Math.max(0.02, centerY + Math.sin(angle) * radiusY * (0.82 + random() * 0.36)),
        ),
      };
    });

    return {
      id: `illustrative-${imageId}-${index}`,
      vertices,
      centroidX: centerX,
      centroidY: centerY,
      normalizedArea: Math.PI * radiusX * radiusY,
      drawingType: vertexCount > 4 ? "scribble" : "closed-mark",
    };
  });
};
