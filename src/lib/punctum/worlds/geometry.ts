import sharp from "sharp";
import type { NormalizedPoint } from "../geometry";

export type PixelPoint = {
  x: number;
  y: number;
};

export type PunctumCrop = {
  x: number;
  y: number;
  width: number;
  height: number;
  padding: {
    left: number;
    top: number;
    right: number;
    bottom: number;
    ratio: number;
  };
};

export type PunctumVisualAnalysis = {
  palette: string[];
  averageLuminance: number;
  contrast: number;
  averageSaturation: number;
  dominantTemperature: "warm" | "cool" | "neutral";
  texture: "smooth" | "moderate" | "detailed";
  textureEnergy: number;
  sampledPixelCount: number;
};

export type ProcessedPunctum = {
  sourceWidth: number;
  sourceHeight: number;
  polygonPixels: PixelPoint[];
  crop: PunctumCrop;
  maskedFragment: Buffer;
  paddedCrop: Buffer;
  polygonMask: Buffer;
  analysis: PunctumVisualAnalysis;
};

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value));

export const normalizedPolygonToPixels = (
  vertices: NormalizedPoint[],
  width: number,
  height: number,
): PixelPoint[] =>
  vertices.map((point) => ({
    x: clamp(Number(point.x) * width, 0, width),
    y: clamp(Number(point.y) * height, 0, height),
  }));

export const getPunctumCrop = (
  polygon: PixelPoint[],
  width: number,
  height: number,
  paddingRatio = 0.125,
): PunctumCrop => {
  const minimumX = Math.floor(Math.min(...polygon.map((point) => point.x)));
  const minimumY = Math.floor(Math.min(...polygon.map((point) => point.y)));
  const maximumX = Math.ceil(Math.max(...polygon.map((point) => point.x)));
  const maximumY = Math.ceil(Math.max(...polygon.map((point) => point.y)));
  const polygonWidth = Math.max(1, maximumX - minimumX);
  const polygonHeight = Math.max(1, maximumY - minimumY);
  const requestedPaddingX = Math.max(1, Math.round(polygonWidth * paddingRatio));
  const requestedPaddingY = Math.max(1, Math.round(polygonHeight * paddingRatio));
  const x = clamp(minimumX - requestedPaddingX, 0, Math.max(0, width - 1));
  const y = clamp(minimumY - requestedPaddingY, 0, Math.max(0, height - 1));
  const right = clamp(maximumX + requestedPaddingX, x + 1, width);
  const bottom = clamp(maximumY + requestedPaddingY, y + 1, height);

  return {
    x,
    y,
    width: right - x,
    height: bottom - y,
    padding: {
      left: minimumX - x,
      top: minimumY - y,
      right: right - maximumX,
      bottom: bottom - maximumY,
      ratio: paddingRatio,
    },
  };
};

const pointInPixelPolygon = (point: PixelPoint, polygon: PixelPoint[]) => {
  let inside = false;
  for (
    let current = 0, previous = polygon.length - 1;
    current < polygon.length;
    previous = current, current += 1
  ) {
    const currentPoint = polygon[current];
    const previousPoint = polygon[previous];
    const crosses =
      currentPoint.y > point.y !== previousPoint.y > point.y &&
      point.x <
        ((previousPoint.x - currentPoint.x) *
          (point.y - currentPoint.y)) /
          (previousPoint.y - currentPoint.y || Number.EPSILON) +
          currentPoint.x;
    if (crosses) inside = !inside;
  }
  return inside;
};

const channelToHex = (value: number) =>
  clamp(Math.round(value), 0, 255).toString(16).padStart(2, "0");

const rgbToHex = (colour: number[]) =>
  `#${channelToHex(colour[0])}${channelToHex(colour[1])}${channelToHex(
    colour[2],
  )}`;

const colourDistanceSquared = (first: number[], second: number[]) =>
  (first[0] - second[0]) ** 2 +
  (first[1] - second[1]) ** 2 +
  (first[2] - second[2]) ** 2;

const luminance = (red: number, green: number, blue: number) =>
  (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255;

const saturation = (red: number, green: number, blue: number) => {
  const maximum = Math.max(red, green, blue);
  const minimum = Math.min(red, green, blue);
  return maximum === 0 ? 0 : (maximum - minimum) / maximum;
};

const createRepresentativePalette = (
  samples: number[][],
  requestedCount = 7,
) => {
  if (!samples.length) return ["#74706a"];
  const count = Math.min(requestedCount, samples.length);
  const average = samples
    .reduce(
      (sum, colour) => [
        sum[0] + colour[0],
        sum[1] + colour[1],
        sum[2] + colour[2],
      ],
      [0, 0, 0],
    )
    .map((value) => value / samples.length);
  const centroids: number[][] = [average];

  while (centroids.length < count) {
    let farthest = samples[0];
    let farthestDistance = -1;
    for (const sample of samples) {
      const distance = Math.min(
        ...centroids.map((centroid) =>
          colourDistanceSquared(sample, centroid),
        ),
      );
      if (distance > farthestDistance) {
        farthest = sample;
        farthestDistance = distance;
      }
    }
    if (farthestDistance < 36) break;
    centroids.push([...farthest]);
  }

  let clusterCounts = new Array(centroids.length).fill(0);
  for (let iteration = 0; iteration < 8; iteration += 1) {
    const totals = centroids.map(() => [0, 0, 0]);
    clusterCounts = new Array(centroids.length).fill(0);
    for (const sample of samples) {
      let selected = 0;
      let shortestDistance = Number.POSITIVE_INFINITY;
      for (let index = 0; index < centroids.length; index += 1) {
        const distance = colourDistanceSquared(sample, centroids[index]);
        if (distance < shortestDistance) {
          selected = index;
          shortestDistance = distance;
        }
      }
      clusterCounts[selected] += 1;
      totals[selected][0] += sample[0];
      totals[selected][1] += sample[1];
      totals[selected][2] += sample[2];
    }
    centroids.forEach((centroid, index) => {
      if (!clusterCounts[index]) return;
      centroid[0] = totals[index][0] / clusterCounts[index];
      centroid[1] = totals[index][1] / clusterCounts[index];
      centroid[2] = totals[index][2] / clusterCounts[index];
    });
  }

  return centroids
    .map((colour, index) => ({ colour, count: clusterCounts[index] || 0 }))
    .sort((first, second) => second.count - first.count)
    .map(({ colour }) => rgbToHex(colour));
};

const analysePolygonPixels = async (
  source: Buffer,
  polygon: PixelPoint[],
  crop: PunctumCrop,
): Promise<PunctumVisualAnalysis> => {
  const {
    data,
    info: { width, height, channels },
  } = await sharp(source)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const area = crop.width * crop.height;
  const step = Math.max(1, Math.ceil(Math.sqrt(area / 45_000)));
  const samples: number[][] = [];
  const luminances: number[] = [];
  let saturationTotal = 0;
  let temperatureTotal = 0;
  let textureTotal = 0;
  let textureSamples = 0;

  const readColour = (x: number, y: number) => {
    const index = (y * width + x) * channels;
    return [
      data[index],
      data[index + 1],
      data[index + 2],
      data[index + 3],
    ];
  };

  for (let y = crop.y; y < Math.min(height, crop.y + crop.height); y += step) {
    for (
      let x = crop.x;
      x < Math.min(width, crop.x + crop.width);
      x += step
    ) {
      if (!pointInPixelPolygon({ x: x + 0.5, y: y + 0.5 }, polygon)) {
        continue;
      }
      const colour = readColour(x, y);
      if ((colour[3] ?? 255) === 0) continue;
      const sample = colour.slice(0, 3);
      const sampleLuminance = luminance(sample[0], sample[1], sample[2]);
      samples.push(sample);
      luminances.push(sampleLuminance);
      saturationTotal += saturation(sample[0], sample[1], sample[2]);
      temperatureTotal += sample[0] - sample[2];

      const neighbourX = Math.min(width - 1, x + step);
      const neighbourY = Math.min(height - 1, y + step);
      if (
        neighbourX !== x &&
        pointInPixelPolygon(
          { x: neighbourX + 0.5, y: y + 0.5 },
          polygon,
        )
      ) {
        const neighbour = readColour(neighbourX, y);
        textureTotal += Math.abs(
          sampleLuminance -
            luminance(neighbour[0], neighbour[1], neighbour[2]),
        );
        textureSamples += 1;
      }
      if (
        neighbourY !== y &&
        pointInPixelPolygon(
          { x: x + 0.5, y: neighbourY + 0.5 },
          polygon,
        )
      ) {
        const neighbour = readColour(x, neighbourY);
        textureTotal += Math.abs(
          sampleLuminance -
            luminance(neighbour[0], neighbour[1], neighbour[2]),
        );
        textureSamples += 1;
      }
    }
  }

  if (!samples.length) {
    throw new Error("The selected region did not contain readable pixels.");
  }
  const averageLuminance =
    luminances.reduce((sum, value) => sum + value, 0) / luminances.length;
  const variance =
    luminances.reduce(
      (sum, value) => sum + (value - averageLuminance) ** 2,
      0,
    ) / luminances.length;
  const averageSaturation = saturationTotal / samples.length;
  const averageTemperature = temperatureTotal / samples.length;
  const textureEnergy = textureSamples ? textureTotal / textureSamples : 0;

  return {
    palette: createRepresentativePalette(samples),
    averageLuminance: Number(averageLuminance.toFixed(4)),
    contrast: Number(Math.sqrt(variance).toFixed(4)),
    averageSaturation: Number(averageSaturation.toFixed(4)),
    dominantTemperature:
      averageTemperature > 8
        ? "warm"
        : averageTemperature < -8
          ? "cool"
          : "neutral",
    texture:
      textureEnergy < 0.045
        ? "smooth"
        : textureEnergy < 0.11
          ? "moderate"
          : "detailed",
    textureEnergy: Number(textureEnergy.toFixed(4)),
    sampledPixelCount: samples.length,
  };
};

const polygonPointsAttribute = (polygon: PixelPoint[]) =>
  polygon
    .map((point) => `${point.x.toFixed(3)},${point.y.toFixed(3)}`)
    .join(" ");

const buildMaskSvg = (
  polygon: PixelPoint[],
  width: number,
  height: number,
  transparentBackground: boolean,
) =>
  Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="${
      transparentBackground ? "black" : "black"
    }" fill-opacity="${transparentBackground ? "0" : "1"}"/><polygon points="${polygonPointsAttribute(
      polygon,
    )}" fill="white"/></svg>`,
  );

export const processPunctumRegion = async ({
  source,
  polygonNormalized,
  paddingRatio = 0.125,
}: {
  source: Buffer;
  polygonNormalized: NormalizedPoint[];
  paddingRatio?: number;
}): Promise<ProcessedPunctum> => {
  const metadata = await sharp(source).metadata();
  const sourceWidth = metadata.width || 0;
  const sourceHeight = metadata.height || 0;
  if (!sourceWidth || !sourceHeight) {
    throw new Error("The source image dimensions could not be read.");
  }

  const polygonPixels = normalizedPolygonToPixels(
    polygonNormalized,
    sourceWidth,
    sourceHeight,
  );
  const crop = getPunctumCrop(
    polygonPixels,
    sourceWidth,
    sourceHeight,
    paddingRatio,
  );
  const alphaMaskSvg = buildMaskSvg(
    polygonPixels,
    sourceWidth,
    sourceHeight,
    true,
  );
  const blackAndWhiteMaskSvg = buildMaskSvg(
    polygonPixels,
    sourceWidth,
    sourceHeight,
    false,
  );

  const [maskedFullResolution, paddedCrop, polygonMask, analysis] =
    await Promise.all([
      sharp(source)
        .ensureAlpha()
        .composite([{ input: alphaMaskSvg, blend: "dest-in" }])
        .png()
        .toBuffer(),
      sharp(source)
        .extract({
          left: crop.x,
          top: crop.y,
          width: crop.width,
          height: crop.height,
        })
        .png()
        .toBuffer(),
      sharp(blackAndWhiteMaskSvg).png().toBuffer(),
      analysePolygonPixels(source, polygonPixels, crop),
    ]);
  const maskedFragment = await sharp(maskedFullResolution)
    .extract({
      left: crop.x,
      top: crop.y,
      width: crop.width,
      height: crop.height,
    })
    .png()
    .toBuffer();

  return {
    sourceWidth,
    sourceHeight,
    polygonPixels,
    crop,
    maskedFragment,
    paddedCrop,
    polygonMask,
    analysis,
  };
};
