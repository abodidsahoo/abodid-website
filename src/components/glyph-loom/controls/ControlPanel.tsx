import type { ChangeEvent } from "react";
import {
  ColorControl,
  ControlSection,
  RangeControl,
  SelectControl,
  ToggleControl,
} from "./ControlPrimitives";
import { DEFAULT_SETTINGS, PALETTES } from "../presets";
import type { LoomSettings } from "../types";

type UpdateSettings = <K extends keyof LoomSettings>(key: K, value: LoomSettings[K]) => void;

const titleCase = (value: string) =>
  value.replace(/([A-Z])/g, " $1").replace(/^./, (character) => character.toUpperCase());

function options<T extends string>(values: readonly T[]) {
  return values.map((value) => ({ value, label: titleCase(value) }));
}

export default function ControlPanel({
  settings,
  update,
  onFontUpload,
}: {
  settings: LoomSettings;
  update: UpdateSettings;
  onFontUpload: (file: File) => void;
}) {
  const range = <K extends keyof LoomSettings>(
    key: K,
    label: string,
    min: number,
    max: number,
    step: number,
    suffix = "",
  ) => (
    <RangeControl
      label={label}
      value={settings[key] as number}
      min={min}
      max={max}
      step={step}
      suffix={suffix}
      defaultValue={DEFAULT_SETTINGS[key] as number}
      onChange={(value) => update(key, value as LoomSettings[K])}
    />
  );

  const handleFontUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) onFontUpload(file);
  };

  return (
    <div className="loom-controls">
      <ControlSection title="Text" badge={settings.text.slice(0, 8)} open>
        <label className="loom-control">
          <span className="loom-control__label">Text input</span>
          <input
            type="text"
            value={settings.text}
            maxLength={18}
            onChange={(event) => update("text", event.target.value)}
          />
        </label>
        <SelectControl
          label="Font"
          value={settings.fontFamily}
          options={[
            { value: "Inconsolata", label: "Inconsolata — bundled" },
            ...(settings.fontFamily === "Uploaded" ? [{ value: "Uploaded", label: "Uploaded font" }] : []),
          ]}
          onChange={(value) => update("fontFamily", value)}
        />
        <label className="loom-file-control">
          <span>Upload TTF / OTF</span>
          <input type="file" accept=".ttf,.otf,.woff" onChange={handleFontUpload} />
        </label>
        {range("fontSize", "Font size", 120, 760, 1)}
        {range("letterSpacing", "Letter spacing", -20, 80, 1)}
        {range("lineHeight", "Line height", 0.7, 2, 0.01)}
        <SelectControl label="Alignment" value={settings.align} options={options(["left", "center", "right"] as const)} onChange={(value) => update("align", value)} />
        <SelectControl label="Sampling" value={settings.samplingMode} options={options(["fill", "outline", "edge"] as const)} onChange={(value) => update("samplingMode", value)} />
      </ControlSection>

      <ControlSection title="Grid" badge={`${settings.gridDensity}×`}>
        {range("gridDensity", "Density", 8, 64, 1)}
        {range("spacingX", "Horizontal spacing", 0.45, 2.5, 0.01)}
        {range("spacingY", "Vertical spacing", 0.45, 2.5, 0.01)}
        {range("gridOffsetX", "Offset X", -80, 80, 1, "px")}
        {range("gridOffsetY", "Offset Y", -80, 80, 1, "px")}
        {range("coverageThreshold", "Coverage threshold", 0.02, 0.98, 0.01)}
        {range("samplingResolution", "Sampling resolution", 256, 1024, 64, "px")}
        {range("gridRotation", "Grid rotation", -45, 45, 1, "°")}
        <SelectControl label="Grid type" value={settings.gridType} options={options(["regular", "offset", "checker", "jittered", "contour"] as const)} onChange={(value) => update("gridType", value)} />
      </ControlSection>

      <ControlSection title="Module" badge={titleCase(settings.moduleType)}>
        <SelectControl label="Module type" value={settings.moduleType} options={options(["bar", "square", "circle", "cross", "dot", "checker", "lines", "woven", "hybrid"] as const)} onChange={(value) => update("moduleType", value)} />
        {range("moduleWidth", "Module width", 0.25, 5, 0.05)}
        {range("moduleHeight", "Module height", 0.25, 3, 0.05)}
        {range("strokeWidth", "Stroke width", 0.25, 8, 0.25, "px")}
        {range("cornerRadius", "Corner radius", 0, 20, 0.5, "px")}
        {range("aspectRatio", "Aspect ratio", 0.5, 5, 0.05)}
        <ToggleControl label="Alternating orientation" checked={settings.alternatingOrientation} onChange={(value) => update("alternatingOrientation", value)} />
        {range("overlap", "Overlap", 0, 4, 0.05)}
        {range("moduleRotation", "Module rotation", -180, 180, 1, "°")}
        {range("checkerFrequency", "Checker frequency", 1, 8, 1)}
        {range("parallelLines", "Parallel lines", 2, 10, 1)}
        <SelectControl label="Over / under order" value={settings.overUnder} options={options(["even", "odd"] as const)} onChange={(value) => update("overUnder", value)} />
        <ToggleControl label="Rounded ends" checked={settings.roundedEnds} onChange={(value) => update("roundedEnds", value)} />
      </ControlSection>

      <ControlSection title="Character">
        {range("glyphWeight", "Glyph weight", 0.5, 2, 0.01)}
        {range("outlineWidth", "Outline width", 1, 12, 1, "px")}
        {range("erosion", "Erosion", 0, 1, 0.01)}
        {range("expansion", "Expansion", 0, 1, 0.01)}
        {range("fidelity", "Fidelity", 0, 1, 0.01)}
        {range("abstraction", "Legibility → abstraction", 0, 1, 0.01)}
        {range("removalProbability", "Module removal", 0, 0.92, 0.01)}
      </ControlSection>

      <ControlSection title="Distortion">
        {range("randomness", "Positional randomness", 0, 1, 0.01)}
        {range("seed", "Seed", 1, 99999, 1)}
        {range("noiseStrength", "Noise strength", 0, 80, 1)}
        {range("noiseScale", "Noise scale", 0.001, 0.06, 0.001)}
        {range("noiseOctaves", "Noise octaves", 1, 6, 1)}
        {range("directionalBias", "Directional bias", -1, 1, 0.01)}
        {range("rotationVariance", "Rotation variance", 0, 180, 1, "°")}
        {range("scaleVariance", "Scale variance", 0, 1, 0.01)}
        {range("flowStrength", "Flow-field strength", 0, 80, 1)}
      </ControlSection>

      <ControlSection title="Motion" badge={settings.playing ? "Live" : "Paused"} open>
        <SelectControl label="Animation" value={settings.animationMode} options={options(["static", "breathing", "ripple", "assemble", "disassemble", "wovenShift", "noiseDrift", "rotationWave", "scanner", "pixelSort"] as const)} onChange={(value) => update("animationMode", value)} />
        {range("time", "Scrubber", 0, settings.loopDuration, 0.01, "s")}
        {range("speed", "Speed", 0.05, 3, 0.05, "×")}
        {range("loopDuration", "Loop duration", 1, 20, 0.25, "s")}
        {range("phase", "Phase", 0, 1, 0.01)}
        {range("stagger", "Stagger amount", 0, 1.5, 0.01)}
        <SelectControl label="Stagger origin" value={settings.staggerOrigin} options={options(["center", "top", "left", "pointer"] as const)} onChange={(value) => update("staggerOrigin", value)} />
        {range("waveAmplitude", "Wave amplitude", 0, 100, 1)}
        {range("wavelength", "Wavelength", 20, 1000, 1, "px")}
        <SelectControl label="Easing" value={settings.easing} options={options(["linear", "easeInOut", "step"] as const)} onChange={(value) => update("easing", value)} />
        {range("posterFps", "Posterised FPS", 4, 60, 1)}
        {range("motionBlur", "Motion blur", 0, 0.92, 0.01)}
        <ToggleControl label="Seamless loop" checked={settings.seamlessLoop} onChange={(value) => update("seamlessLoop", value)} />
      </ControlSection>

      <ControlSection title="Colour">
        <SelectControl
          label="Preset palette"
          value={settings.palette}
          options={options(["fabric", "mono", "signal", "night"] as const)}
          onChange={(value) => {
            update("palette", value);
            const palette = PALETTES[value];
            (Object.keys(palette) as Array<keyof typeof palette>).forEach((key) => update(key, palette[key]));
          }}
        />
        <ColorControl label="Background" value={settings.background} onChange={(value) => update("background", value)} />
        <ColorControl label="Primary ink" value={settings.primaryInk} onChange={(value) => update("primaryInk", value)} />
        <ColorControl label="Secondary ink" value={settings.secondaryInk} onChange={(value) => update("secondaryInk", value)} />
        <ColorControl label="Accent" value={settings.accent} onChange={(value) => update("accent", value)} />
        {range("colorVariation", "Per-module variation", 0, 1, 0.01)}
        <ToggleControl label="Invert palette" checked={settings.invertPalette} onChange={(value) => update("invertPalette", value)} />
      </ControlSection>

      <ControlSection title="Layout" badge={titleCase(settings.layout)}>
        <SelectControl label="Layout preset" value={settings.layout} options={options(["single", "word", "specimen", "fabric", "poster", "fullscreen", "square", "motion"] as const)} onChange={(value) => update("layout", value)} />
        {range("canvasWidth", "Custom width", 320, 2048, 1, "px")}
        {range("canvasHeight", "Custom height", 320, 2048, 1, "px")}
      </ControlSection>
    </div>
  );
}

