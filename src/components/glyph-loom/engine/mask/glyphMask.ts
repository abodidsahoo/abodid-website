import * as opentype from "opentype.js";
import type { GlyphMask, LoomSettings, SamplingMode } from "../../types";

const maskCache = new Map<string, GlyphMask>();

function coverageAt(alpha: Uint8ClampedArray, size: number, x: number, y: number): number {
  const ix = Math.max(0, Math.min(size - 1, Math.round(x)));
  const iy = Math.max(0, Math.min(size - 1, Math.round(y)));
  return alpha[(iy * size + ix) * 4 + 3] / 255;
}

function transformSamplingMode(
  source: Uint8ClampedArray,
  size: number,
  mode: SamplingMode,
  outlineWidth: number,
): Uint8ClampedArray {
  if (mode === "fill") return source;
  const result = new Uint8ClampedArray(source.length);
  const radius = Math.max(1, Math.round(outlineWidth));

  for (let y = radius; y < size - radius; y += 1) {
    for (let x = radius; x < size - radius; x += 1) {
      const center = coverageAt(source, size, x, y);
      let min = 1;
      let max = 0;
      for (let oy = -radius; oy <= radius; oy += radius) {
        for (let ox = -radius; ox <= radius; ox += radius) {
          const sample = coverageAt(source, size, x + ox, y + oy);
          min = Math.min(min, sample);
          max = Math.max(max, sample);
        }
      }
      const edge = Math.max(0, max - min);
      const alpha = mode === "edge"
        ? edge
        : Math.max(edge, center > 0 && center < 1 ? 1 : 0);
      const index = (y * size + x) * 4;
      result[index + 3] = Math.round(alpha * 255);
    }
  }
  return result;
}

export function createGlyphMask(font: opentype.Font, settings: LoomSettings): GlyphMask {
  const size = Math.max(256, Math.min(1024, settings.samplingResolution));
  const cacheKey = [
    font.names.fullName?.en || "uploaded",
    settings.text,
    size,
    settings.letterSpacing,
    settings.lineHeight,
    settings.align,
    settings.samplingMode,
    settings.outlineWidth,
  ].join(":");
  const cached = maskCache.get(cacheKey);
  if (cached) return cached;

  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Canvas 2D is unavailable.");
  context.clearRect(0, 0, size, size);
  context.fillStyle = "#000";

  const safeText = settings.text.trim().slice(0, 18) || "F";
  const sizeFactor = Math.max(0.35, Math.min(1.25, settings.fontSize / 500));
  const targetWidth = size * 0.76 * sizeFactor;
  const targetHeight = size * 0.72 * sizeFactor;
  const paths: opentype.Path[] = [];
  const metrics: { width: number; height: number; x1: number; y1: number; x2: number; y2: number }[] = [];

  for (const character of safeText) {
    const path = font.getPath(character, 0, 0, settings.fontSize);
    const box = path.getBoundingBox();
    paths.push(path);
    metrics.push({
      width: Math.max(1, box.x2 - box.x1),
      height: Math.max(1, box.y2 - box.y1),
      x1: box.x1,
      y1: box.y1,
      x2: box.x2,
      y2: box.y2,
    });
  }

  const rawWidth = metrics.reduce((sum, metric) => sum + metric.width, 0)
    + Math.max(0, metrics.length - 1) * settings.letterSpacing;
  const rawHeight = Math.max(...metrics.map((metric) => metric.height));
  const scale = Math.min(targetWidth / rawWidth, targetHeight / rawHeight);
  const renderedWidth = rawWidth * scale;
  let cursorX = settings.align === "left"
    ? size * 0.12
    : settings.align === "right"
      ? size * 0.88 - renderedWidth
      : (size - renderedWidth) / 2;

  paths.forEach((path, index) => {
    const metric = metrics[index];
    const centerY = size / 2 + (metric.height * scale) / 2;
    context.save();
    context.translate(cursorX - metric.x1 * scale, centerY - metric.y2 * scale);
    context.scale(scale, scale);
    path.fill = "#000";
    path.draw(context);
    context.restore();
    cursorX += metric.width * scale + settings.letterSpacing * scale;
  });

  const image = context.getImageData(0, 0, size, size);
  const alpha = transformSamplingMode(image.data, size, settings.samplingMode, settings.outlineWidth);
  const mask: GlyphMask = {
    width: size,
    height: size,
    alpha,
    sample: (x, y) => coverageAt(alpha, size, x, y),
  };
  maskCache.set(cacheKey, mask);
  if (maskCache.size > 18) maskCache.delete(maskCache.keys().next().value as string);
  return mask;
}
