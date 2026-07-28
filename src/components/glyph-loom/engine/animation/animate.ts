import { createNoise4D } from "simplex-noise";
import { breathingScale, distanceStagger, ease, loopProgress, TAU, travellingWave } from "../../math/motion";
import { createSeededRandom } from "../../math/random";
import type { AnimatedTransform, LoomSettings, ModuleInstance, Scene } from "../../types";

const noiseCache = new Map<number, ReturnType<typeof createNoise4D>>();

function seededNoise(seed: number): ReturnType<typeof createNoise4D> {
  let noise = noiseCache.get(seed);
  if (!noise) {
    noise = createNoise4D(createSeededRandom(seed));
    noiseCache.set(seed, noise);
    if (noiseCache.size > 8) noiseCache.delete(noiseCache.keys().next().value as number);
  }
  return noise;
}

export function animateModule(
  module: ModuleInstance,
  scene: Scene,
  settings: LoomSettings,
  time: number,
): AnimatedTransform {
  const duration = Math.max(0.25, settings.loopDuration);
  const clock = settings.seamlessLoop ? loopProgress(time * settings.speed, duration) * duration : time * settings.speed;
  const progress = loopProgress(clock + settings.phase * duration, duration);
  const [originX, originY] = settings.staggerOrigin === "top"
    ? [scene.width / 2, 0]
    : settings.staggerOrigin === "left"
      ? [0, scene.height / 2]
      : settings.staggerOrigin === "pointer"
        ? [settings.originX * scene.width, settings.originY * scene.height]
        : [scene.width / 2, scene.height / 2];
  const distance = distanceStagger(
    module.x,
    module.y,
    originX,
    originY,
    Math.hypot(scene.width, scene.height),
  );
  const staggered = loopProgress(clock - distance * settings.stagger * duration, duration);
  const base: AnimatedTransform = {
    x: module.x,
    y: module.y,
    rotation: module.rotation,
    scaleX: 1,
    scaleY: 1,
    opacity: module.opacity,
  };

  switch (settings.animationMode) {
    case "static":
      return base;
    case "breathing": {
      const scale = breathingScale(clock + module.animationPhase * duration, duration, 1, settings.waveAmplitude / 100);
      return { ...base, scaleX: scale, scaleY: scale };
    }
    case "ripple": {
      const offset = travellingWave(clock, duration, distance * scene.width, settings.wavelength, settings.waveAmplitude);
      const angle = Math.atan2(module.y - originY, module.x - originX);
      return { ...base, x: module.x + Math.cos(angle) * offset, y: module.y + Math.sin(angle) * offset };
    }
    case "assemble":
    case "disassemble": {
      const local = ease(Math.max(0, Math.min(1, staggered * 1.8)), settings.easing);
      const amount = settings.animationMode === "assemble" ? 1 - local : local;
      return {
        ...base,
        x: module.x + (module.x - originX) * amount * 0.8,
        y: module.y + (module.y - originY) * amount * 0.8,
        rotation: module.rotation + amount * Math.PI,
        scaleX: Math.max(0.02, 1 - amount),
        scaleY: Math.max(0.02, 1 - amount),
        opacity: module.opacity * (1 - amount),
      };
    }
    case "wovenShift": {
      const shift = travellingWave(clock, duration, module.row + module.column, 12, settings.waveAmplitude * 0.45);
      const horizontal = (module.row + module.column) % 2 === 0;
      return { ...base, x: module.x + (horizontal ? shift : 0), y: module.y + (horizontal ? 0 : shift) };
    }
    case "noiseDrift": {
      // Circular time coordinates make the noise field identical at loop endpoints.
      const noise = seededNoise(settings.seed);
      const nx = module.x * settings.noiseScale;
      const ny = module.y * settings.noiseScale;
      const tx = Math.cos(progress * TAU);
      const ty = Math.sin(progress * TAU);
      return {
        ...base,
        x: module.x + noise(nx, ny, tx, ty) * settings.noiseStrength,
        y: module.y + noise(nx + 17.2, ny - 9.1, tx, ty) * settings.noiseStrength,
      };
    }
    case "rotationWave":
      return {
        ...base,
        rotation: module.rotation + travellingWave(clock, duration, module.x + module.y, settings.wavelength, settings.waveAmplitude * Math.PI / 180),
      };
    case "scanner": {
      const scanX = progress * scene.width;
      const distanceToScan = Math.abs(module.x - scanX);
      return {
        ...base,
        opacity: module.opacity * (0.16 + 0.84 * Math.max(0, 1 - distanceToScan / Math.max(20, settings.wavelength))),
        scaleX: 1 + Math.max(0, 1 - distanceToScan / 80) * 0.5,
      };
    }
    case "pixelSort": {
      const band = Math.sin((module.y / scene.height + progress) * TAU * 4);
      return { ...base, x: module.x + Math.max(0, band) * settings.waveAmplitude * 3 };
    }
    default:
      return base;
  }
}
