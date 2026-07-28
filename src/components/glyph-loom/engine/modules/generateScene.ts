import type {
  GlyphMask,
  LoomSettings,
  ModuleInstance,
  ModuleType,
  Point,
  PrimitiveType,
  Scene,
  ScenePanel,
} from "../../types";
import { hashNumber } from "../../math/random";
import { sampleGlyphMask } from "../sampling/grid";
import { deformPoint } from "../deformation/deform";

export function wovenOrientation(row: number, column: number): "horizontal" | "vertical" {
  return (row + column) % 2 === 0 ? "horizontal" : "vertical";
}

export function scaleProgression(initialScale: number, index: number): number {
  return initialScale * Math.pow(0.73, index);
}

const HYBRID_PRIMITIVES: PrimitiveType[] = [
  "bar",
  "square",
  "circle",
  "cross",
  "dot",
  "checker",
  "lines",
  "woven",
];

function modulePrimitive(settings: LoomSettings, point: Point, index: number): PrimitiveType {
  if (settings.moduleType !== "hybrid") return settings.moduleType;
  const position = Math.floor(hashNumber(settings.seed, index) * HYBRID_PRIMITIVES.length);
  return HYBRID_PRIMITIVES[position];
}

function chooseColor(settings: LoomSettings, index: number, panelIndex: number): string {
  const roll = hashNumber(settings.seed ^ 0xa8f1, index);
  const primary = settings.invertPalette ? settings.background : settings.primaryInk;
  const paper = settings.invertPalette ? settings.primaryInk : settings.background;
  if (panelIndex === 1) return primary;
  if (panelIndex === 0) return roll < 0.13 ? settings.accent : settings.background;
  if (roll < settings.colorVariation) return settings.accent;
  if (roll < settings.colorVariation * 2) return settings.secondaryInk;
  return panelIndex < 0 ? paper : primary;
}

interface Family {
  panelIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
  scale: number;
  primitive: ModuleType;
  ink?: string;
  crop?: boolean;
}

function createModule(
  point: Point,
  index: number,
  settings: LoomSettings,
  family: Family,
  mask: GlyphMask,
): ModuleInstance | null {
  const deformed = deformPoint(point, index, settings);
  if (!deformed.keep) return null;
  const normalizedX = deformed.x / mask.width;
  const normalizedY = deformed.y / mask.height;
  if (family.crop && (normalizedX < 0 || normalizedX > 1 || normalizedY < 0 || normalizedY > 1)) {
    return null;
  }
  const pitch = Math.min(family.width, family.height) / Math.max(8, settings.gridDensity);
  const baseThickness = pitch * settings.moduleHeight * 0.54 * settings.glyphWeight;
  const primitive = family.primitive === "hybrid"
    ? modulePrimitive(settings, point, index)
    : family.primitive;
  const isWoven = primitive === "woven";
  const vertical = isWoven
    && settings.alternatingOrientation
    && wovenOrientation(point.row, point.column) === "vertical";
  const aspect = primitive === "bar" || isWoven ? settings.aspectRatio : 1;
  const moduleWidth = baseThickness * settings.moduleWidth * (vertical ? 1 : aspect);
  const moduleHeight = baseThickness * settings.moduleHeight * (vertical ? aspect : 1);
  const abstractionOffset = settings.abstraction * pitch * 8;

  return {
    id: `g${family.panelIndex}-${point.row}-${point.column}-${index}`,
    glyphIndex: family.panelIndex,
    row: point.row,
    column: point.column,
    x: family.x + normalizedX * family.width * family.scale
      + (1 - family.scale) * family.width / 2
      + (hashNumber(settings.seed + 3, index) - 0.5) * abstractionOffset,
    y: family.y + normalizedY * family.height * family.scale
      + (1 - family.scale) * family.height / 2
      + (hashNumber(settings.seed + 7, index) - 0.5) * abstractionOffset,
    width: moduleWidth * deformed.scale * (1 + settings.overlap * 0.08),
    height: moduleHeight * deformed.scale * (1 + settings.overlap * 0.08),
    rotation: deformed.rotation + (vertical ? Math.PI / 2 : 0),
    opacity: Math.max(0.12, Math.min(1, point.coverage * settings.fidelity + (1 - settings.fidelity))),
    primitive,
    fill: family.ink || chooseColor(settings, index, family.panelIndex),
    stroke: family.ink || chooseColor(settings, index, family.panelIndex),
    strokeWidth: settings.strokeWidth,
    animationPhase: hashNumber(settings.seed ^ 0x77aa, index),
    cornerRadius: settings.roundedEnds ? Math.min(moduleWidth, moduleHeight) / 2 : settings.cornerRadius,
    lineCount: primitive === "checker" ? settings.checkerFrequency : settings.parallelLines,
    over: (point.row + point.column) % 2 === (settings.overUnder === "even" ? 0 : 1),
  };
}

function fabricPanels(settings: LoomSettings): { panels: ScenePanel[]; families: Family[] } {
  // Proportions are derived from the 2048 × 1406 specimen, then normalized.
  const left = 137 / 2048;
  const top = 117 / 1406;
  const leftWidth = 573 / 2048;
  const smallHeight = 573 / 1406;
  const gapX = 26 / 2048;
  const gapY = 29 / 1406;
  const largeWidth = 1174 / 2048;
  const largeHeight = 1174 / 1406;
  const width = settings.canvasWidth;
  const height = settings.canvasHeight;
  const panels: ScenePanel[] = [
    {
      x: left * width,
      y: top * height,
      width: leftWidth * width,
      height: smallHeight * height,
      fill: settings.secondaryInk,
      label: "woven",
    },
    {
      x: left * width,
      y: (top + smallHeight + gapY) * height,
      width: leftWidth * width,
      height: smallHeight * height,
      fill: settings.accent,
      label: "plus",
    },
    {
      x: (left + leftWidth + gapX) * width,
      y: top * height,
      width: largeWidth * width,
      height: largeHeight * height,
      fill: settings.background,
      label: "progression",
    },
  ];
  const inset = 0.042;
  const upperX = panels[2].x + panels[2].width * inset;
  const upperY = panels[2].y + panels[2].height * inset;
  const upperWidth = panels[2].width * (1 - inset * 2);
  const upperHeight = panels[2].height * 0.42;
  const scales = Array.from({ length: 6 }, (_, index) => scaleProgression(0.31, index));
  let cursor = upperX;
  const progression: Family[] = scales.map((scale, index) => {
    const slotWidth = upperWidth / 6;
    const family: Family = {
      panelIndex: index + 2,
      x: cursor,
      y: upperY,
      width: slotWidth,
      height: upperHeight,
      scale: Math.min(1, scale * 2.45),
      primitive: (["lines", "woven", "cross", "dot", "checker", "bar"] as PrimitiveType[])[index],
      ink: index === 3 ? settings.accent : settings.primaryInk,
    };
    cursor += slotWidth;
    return family;
  });

  return {
    panels,
    families: [
      {
        panelIndex: 0,
        x: panels[0].x,
        y: panels[0].y,
        width: panels[0].width,
        height: panels[0].height,
        scale: 0.88,
        primitive: "woven",
        ink: settings.background,
        crop: true,
      },
      {
        panelIndex: 1,
        x: panels[1].x,
        y: panels[1].y,
        width: panels[1].width,
        height: panels[1].height,
        scale: 0.84,
        primitive: "cross",
        ink: settings.primaryInk,
        crop: true,
      },
      ...progression,
      {
        panelIndex: 9,
        x: panels[2].x + panels[2].width * 0.06,
        y: panels[2].y + panels[2].height * 0.59,
        width: panels[2].width * 0.4,
        height: panels[2].height * 0.34,
        scale: 0.82,
        primitive: "dot",
      },
      {
        panelIndex: 10,
        x: panels[2].x + panels[2].width * 0.53,
        y: panels[2].y + panels[2].height * 0.56,
        width: panels[2].width * 0.38,
        height: panels[2].height * 0.38,
        scale: 0.9,
        primitive: "checker",
      },
    ],
  };
}

function generalLayout(settings: LoomSettings): { panels: ScenePanel[]; families: Family[] } {
  if (settings.layout === "specimen") {
    const gap = settings.canvasWidth * 0.025;
    const margin = settings.canvasWidth * 0.07;
    const cellWidth = (settings.canvasWidth - margin * 2 - gap) / 2;
    const cellHeight = (settings.canvasHeight - margin * 2 - gap) / 2;
    const primitives: PrimitiveType[] = ["woven", "cross", "dot", "lines"];
    return {
      panels: [],
      families: primitives.map((primitive, index) => ({
        panelIndex: index,
        x: margin + (index % 2) * (cellWidth + gap),
        y: margin + Math.floor(index / 2) * (cellHeight + gap),
        width: cellWidth,
        height: cellHeight,
        scale: 0.88,
        primitive,
      })),
    };
  }
  const margins: Record<LoomSettings["layout"], number> = {
    single: 0.13,
    word: 0.07,
    specimen: 0.08,
    fabric: 0.08,
    poster: 0.15,
    fullscreen: 0.035,
    square: 0.09,
    motion: 0.055,
  };
  const margin = margins[settings.layout];
  return {
    panels: [],
    families: [{
      panelIndex: 0,
      x: settings.canvasWidth * margin,
      y: settings.canvasHeight * margin,
      width: settings.canvasWidth * (1 - margin * 2),
      height: settings.canvasHeight * (1 - margin * 2),
      scale: 1,
      primitive: settings.moduleType,
    }],
  };
}

export function generateScene(mask: GlyphMask, settings: LoomSettings): Scene {
  const morphologyShift = (settings.expansion - settings.erosion) * 0.24;
  const sampled = sampleGlyphMask(mask, {
    ...settings,
    coverageThreshold: Math.max(0.01, Math.min(0.99, settings.coverageThreshold - morphologyShift)),
  });
  const layout = settings.layout === "fabric" ? fabricPanels(settings) : generalLayout(settings);
  const modules: ModuleInstance[] = [];

  layout.families.forEach((family, familyIndex) => {
    sampled.forEach((point, pointIndex) => {
      const module = createModule(
        point,
        familyIndex * sampled.length + pointIndex,
        settings,
        family,
        mask,
      );
      if (module) modules.push(module);
    });
  });

  modules.sort((a, b) => Number(a.over) - Number(b.over));
  return {
    version: 1,
    width: settings.canvasWidth,
    height: settings.canvasHeight,
    background: settings.invertPalette ? settings.primaryInk : settings.background,
    panels: layout.panels,
    modules,
    createdWith: "Glyph Loom",
  };
}

export function serializeScene(scene: Scene): string {
  return JSON.stringify(scene);
}

export function restoreScene(serialized: string): Scene {
  const parsed = JSON.parse(serialized) as Scene;
  if (
    parsed.version !== 1
    || parsed.createdWith !== "Glyph Loom"
    || !Array.isArray(parsed.modules)
  ) {
    throw new Error("This is not a supported Glyph Loom scene.");
  }
  return parsed;
}
