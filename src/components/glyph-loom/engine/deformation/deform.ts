import { createNoise2D } from "simplex-noise";
import { createSeededRandom, randomBetween } from "../../math/random";
import type { LoomSettings, Point } from "../../types";

export interface DeformedPoint extends Point {
  rotation: number;
  scale: number;
  keep: boolean;
}

export function deformPoint(
  point: Point,
  index: number,
  settings: LoomSettings,
): DeformedPoint {
  const random = createSeededRandom((settings.seed + index * 7919) >>> 0);
  const noise = createNoise2D(createSeededRandom(settings.seed ^ 0x51f15e));
  let noiseValue = 0;
  let amplitude = 1;
  let frequency = 1;
  let amplitudeTotal = 0;
  for (let octave = 0; octave < settings.noiseOctaves; octave += 1) {
    noiseValue += noise(
      point.x * settings.noiseScale * frequency,
      point.y * settings.noiseScale * frequency,
    ) * amplitude;
    amplitudeTotal += amplitude;
    amplitude *= 0.5;
    frequency *= 2;
  }
  noiseValue /= Math.max(1, amplitudeTotal);
  const randomStrength = settings.randomness * 24;
  const directional = settings.directionalBias * (point.y / 640 - 0.5) * 20;
  return {
    ...point,
    x: point.x
      + randomBetween(random, -randomStrength, randomStrength)
      + noiseValue * settings.noiseStrength
      + directional,
    y: point.y
      + randomBetween(random, -randomStrength, randomStrength)
      + noiseValue * settings.flowStrength,
    rotation: (point.angle || 0)
      + (settings.moduleRotation * Math.PI / 180)
      + randomBetween(random, -1, 1) * settings.rotationVariance * Math.PI / 180,
    scale: Math.max(0.08, 1 + randomBetween(random, -1, 1) * settings.scaleVariance),
    keep: random() >= settings.removalProbability,
  };
}
