import type { GlyphMask, GridType, LoomSettings, Point } from "../../types";
import { createSeededRandom } from "../../math/random";

export interface GridOptions {
  width: number;
  height: number;
  columns: number;
  spacingX: number;
  spacingY: number;
  offsetX: number;
  offsetY: number;
  rotation: number;
  type: GridType;
  seed: number;
}

export function generateGridCoordinates(options: GridOptions): Point[] {
  const points: Point[] = [];
  const random = createSeededRandom(options.seed);
  const pitchX = (options.width / Math.max(4, options.columns)) * options.spacingX;
  const pitchY = pitchX * options.spacingY;
  const rows = Math.ceil(options.height / pitchY) + 2;
  const columns = Math.ceil(options.width / pitchX) + 2;
  const centerX = options.width / 2;
  const centerY = options.height / 2;
  const radians = options.rotation * Math.PI / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);

  for (let row = -1; row < rows; row += 1) {
    for (let column = -1; column < columns; column += 1) {
      if (options.type === "checker" && (row + column) % 2 !== 0) continue;
      let x = column * pitchX + options.offsetX;
      let y = row * pitchY + options.offsetY;
      if (options.type === "offset" && row % 2 !== 0) x += pitchX / 2;
      if (options.type === "jittered") {
        x += (random() - 0.5) * pitchX * 0.58;
        y += (random() - 0.5) * pitchY * 0.58;
      }
      const dx = x - centerX;
      const dy = y - centerY;
      points.push({
        x: centerX + dx * cos - dy * sin,
        y: centerY + dx * sin + dy * cos,
        row,
        column,
        coverage: 0,
      });
    }
  }
  return points;
}

export function sampleGlyphMask(mask: GlyphMask, settings: LoomSettings): Point[] {
  const grid = generateGridCoordinates({
    width: mask.width,
    height: mask.height,
    columns: settings.gridDensity,
    spacingX: settings.spacingX,
    spacingY: settings.spacingY,
    offsetX: settings.gridOffsetX,
    offsetY: settings.gridOffsetY,
    rotation: settings.gridRotation,
    type: settings.gridType,
    seed: settings.seed,
  });

  return grid
    .map((point) => {
      const coverage = mask.sample(point.x, point.y);
      if (settings.gridType !== "contour") return { ...point, coverage };
      const step = Math.max(2, mask.width / settings.gridDensity / 2);
      const gx = mask.sample(point.x + step, point.y) - mask.sample(point.x - step, point.y);
      const gy = mask.sample(point.x, point.y + step) - mask.sample(point.x, point.y - step);
      return { ...point, coverage: Math.hypot(gx, gy), angle: Math.atan2(gy, gx) + Math.PI / 2 };
    })
    .filter((point) => point.coverage >= settings.coverageThreshold);
}

