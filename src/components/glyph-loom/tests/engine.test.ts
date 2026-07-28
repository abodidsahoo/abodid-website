import { describe, expect, it } from "vitest";
import { animateModule } from "../engine/animation/animate";
import {
  generateScene,
  restoreScene,
  scaleProgression,
  serializeScene,
  wovenOrientation,
} from "../engine/modules/generateScene";
import { generateGridCoordinates } from "../engine/sampling/grid";
import { renderSceneToSvg } from "../engine/renderers/svg";
import { breathingScale, distanceStagger, travellingWave } from "../math/motion";
import { createSeededRandom } from "../math/random";
import { DEFAULT_SETTINGS } from "../presets";
import type { ModuleInstance, Scene } from "../types";

const module: ModuleInstance = {
  id: "test-0",
  glyphIndex: 0,
  row: 2,
  column: 3,
  x: 240,
  y: 180,
  width: 24,
  height: 8,
  rotation: 0.2,
  opacity: 0.9,
  primitive: "woven",
  fill: "#000000",
  stroke: "#000000",
  strokeWidth: 1,
  animationPhase: 0,
  cornerRadius: 0,
  lineCount: 4,
  over: true,
};

const scene: Scene = {
  version: 1,
  width: 640,
  height: 480,
  background: "#c4c3a4",
  panels: [],
  modules: [module],
  createdWith: "Glyph Loom",
};

describe("deterministic mathematics", () => {
  it("reproduces a seeded random sequence", () => {
    const first = createSeededRandom(1977);
    const second = createSeededRandom(1977);
    expect(Array.from({ length: 8 }, first)).toEqual(Array.from({ length: 8 }, second));
  });

  it("follows the 0.73 specimen scale progression", () => {
    expect(scaleProgression(1, 0)).toBe(1);
    expect(scaleProgression(1, 3)).toBeCloseTo(0.73 ** 3);
  });

  it("generates stable grid coordinates", () => {
    const options = {
      width: 100,
      height: 80,
      columns: 10,
      spacingX: 1,
      spacingY: 1,
      offsetX: 0,
      offsetY: 0,
      rotation: 0,
      type: "offset" as const,
      seed: 4,
    };
    const first = generateGridCoordinates(options);
    const second = generateGridCoordinates(options);
    expect(first).toEqual(second);
    expect(first.find((point) => point.row === 1 && point.column === 0)?.x).toBe(5);
  });

  it("alternates woven orientation by grid parity", () => {
    expect(wovenOrientation(0, 0)).toBe("horizontal");
    expect(wovenOrientation(0, 1)).toBe("vertical");
    expect(wovenOrientation(3, 3)).toBe("horizontal");
  });

  it("keeps travelling and breathing waves periodic", () => {
    expect(travellingWave(0, 6, 120, 300, 20))
      .toBeCloseTo(travellingWave(6, 6, 120, 300, 20), 10);
    expect(breathingScale(0, 6, 1, 0.2))
      .toBeCloseTo(breathingScale(6, 6, 1, 0.2), 10);
  });

  it("returns the same seamless frame at the loop endpoints", () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      animationMode: "noiseDrift" as const,
      noiseStrength: 28,
      loopDuration: 6,
      seamlessLoop: true,
    };
    expect(animateModule(module, scene, settings, 0))
      .toEqual(animateModule(module, scene, settings, 6));
  });

  it("normalises distance-based stagger", () => {
    expect(distanceStagger(0, 0, 0, 0, 100)).toBe(0);
    expect(distanceStagger(60, 80, 0, 0, 100)).toBe(1);
    expect(distanceStagger(30, 40, 0, 0, 100)).toBe(0.5);
  });

  it("serialises and restores a scene without losing modules", () => {
    const restored = restoreScene(serializeScene(scene));
    expect(restored).toEqual(scene);
    expect(restored.modules[0].primitive).toBe("woven");
  });

  it("rebuilds identical scenes for identical seeds", () => {
    const mask = {
      width: 64,
      height: 64,
      alpha: new Uint8ClampedArray(64 * 64 * 4),
      sample: (x: number, y: number) => x > 8 && x < 54 && y > 8 && y < 54 ? 1 : 0,
    };
    const settings = {
      ...DEFAULT_SETTINGS,
      layout: "single" as const,
      canvasWidth: 320,
      canvasHeight: 320,
      gridDensity: 12,
      randomness: 0.3,
      seed: 7007,
    };
    const first = generateScene(mask, settings);
    const second = generateScene(mask, settings);
    const different = generateScene(mask, { ...settings, seed: 7008 });
    expect(first).toEqual(second);
    expect(first.modules).not.toEqual(different.modules);
  });

  it("exports vector primitives rather than an embedded raster", () => {
    const svg = renderSceneToSvg(scene, DEFAULT_SETTINGS, 0);
    expect(svg).toContain("<svg");
    expect(svg).toContain("<rect");
    expect(svg).not.toContain("<image");
    expect(svg).not.toContain("data:image");
  });
});
