export const TAU = Math.PI * 2;

export function loopProgress(time: number, duration: number): number {
  if (duration <= 0) return 0;
  return ((time % duration) + duration) % duration / duration;
}

export function breathingScale(
  time: number,
  duration: number,
  baseScale: number,
  amplitude: number,
): number {
  return baseScale + amplitude * Math.sin(TAU * time / duration);
}

export function travellingWave(
  time: number,
  duration: number,
  position: number,
  wavelength: number,
  amplitude: number,
): number {
  return amplitude * Math.sin(TAU * (time / duration - position / Math.max(1, wavelength)));
}

export function distanceStagger(
  x: number,
  y: number,
  originX: number,
  originY: number,
  maxDistance: number,
): number {
  return Math.min(1, Math.hypot(x - originX, y - originY) / Math.max(1, maxDistance));
}

export function ease(value: number, mode: "linear" | "easeInOut" | "step"): number {
  const clamped = Math.max(0, Math.min(1, value));
  if (mode === "step") return Math.floor(clamped * 8) / 8;
  if (mode === "easeInOut") return clamped * clamped * (3 - 2 * clamped);
  return clamped;
}

