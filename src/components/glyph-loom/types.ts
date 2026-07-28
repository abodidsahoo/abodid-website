export type SamplingMode = "fill" | "outline" | "edge";
export type GridType = "regular" | "offset" | "checker" | "jittered" | "contour";
export type PrimitiveType =
  | "bar"
  | "square"
  | "circle"
  | "cross"
  | "dot"
  | "checker"
  | "lines"
  | "woven";
export type ModuleType = PrimitiveType | "hybrid";
export type AnimationMode =
  | "static"
  | "breathing"
  | "ripple"
  | "assemble"
  | "disassemble"
  | "wovenShift"
  | "noiseDrift"
  | "rotationWave"
  | "scanner"
  | "pixelSort";
export type LayoutType =
  | "single"
  | "word"
  | "specimen"
  | "fabric"
  | "poster"
  | "fullscreen"
  | "square"
  | "motion";

export interface Point {
  x: number;
  y: number;
  row: number;
  column: number;
  coverage: number;
  angle?: number;
}

export interface ModuleInstance {
  id: string;
  glyphIndex: number;
  row: number;
  column: number;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
  primitive: PrimitiveType;
  fill: string;
  stroke: string;
  strokeWidth: number;
  animationPhase: number;
  cornerRadius: number;
  lineCount: number;
  over: boolean;
}

export interface ScenePanel {
  x: number;
  y: number;
  width: number;
  height: number;
  fill: string;
  label?: string;
}

export interface Scene {
  version: 1;
  width: number;
  height: number;
  background: string;
  panels: ScenePanel[];
  modules: ModuleInstance[];
  createdWith: "Glyph Loom";
}

export interface GlyphMask {
  width: number;
  height: number;
  alpha: Uint8ClampedArray;
  sample: (x: number, y: number) => number;
}

export interface LoomSettings {
  text: string;
  fontFamily: string;
  fontSize: number;
  letterSpacing: number;
  lineHeight: number;
  align: "left" | "center" | "right";
  samplingMode: SamplingMode;
  gridDensity: number;
  spacingX: number;
  spacingY: number;
  gridOffsetX: number;
  gridOffsetY: number;
  coverageThreshold: number;
  samplingResolution: number;
  gridRotation: number;
  gridType: GridType;
  moduleType: ModuleType;
  moduleWidth: number;
  moduleHeight: number;
  strokeWidth: number;
  cornerRadius: number;
  aspectRatio: number;
  alternatingOrientation: boolean;
  overlap: number;
  moduleRotation: number;
  checkerFrequency: number;
  parallelLines: number;
  glyphWeight: number;
  outlineWidth: number;
  erosion: number;
  expansion: number;
  fidelity: number;
  abstraction: number;
  removalProbability: number;
  randomness: number;
  seed: number;
  noiseStrength: number;
  noiseScale: number;
  noiseOctaves: number;
  directionalBias: number;
  rotationVariance: number;
  scaleVariance: number;
  flowStrength: number;
  playing: boolean;
  time: number;
  animationMode: AnimationMode;
  speed: number;
  loopDuration: number;
  phase: number;
  stagger: number;
  staggerOrigin: "center" | "top" | "left" | "pointer";
  waveAmplitude: number;
  wavelength: number;
  easing: "linear" | "easeInOut" | "step";
  posterFps: number;
  motionBlur: number;
  seamlessLoop: boolean;
  background: string;
  primaryInk: string;
  secondaryInk: string;
  accent: string;
  colorVariation: number;
  invertPalette: boolean;
  palette: "fabric" | "mono" | "signal" | "night";
  layout: LayoutType;
  canvasWidth: number;
  canvasHeight: number;
  overUnder: "even" | "odd";
  roundedEnds: boolean;
  originX: number;
  originY: number;
}

export interface AnimatedTransform {
  x: number;
  y: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
  opacity: number;
}

export interface LoomPreset {
  name: string;
  description: string;
  settings: Partial<LoomSettings>;
}

