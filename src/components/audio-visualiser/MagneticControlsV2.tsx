import { useState, type ReactNode } from "react";
import { RotateCcw } from "lucide-react";
import type {
  MagneticApertureSettings,
  MagneticBackdropTheme,
  MagneticPalette,
  MagneticParticleShape,
} from "./types";

type Props = {
  settings: MagneticApertureSettings;
  onUpdate: <Key extends keyof MagneticApertureSettings>(
    key: Key,
    value: MagneticApertureSettings[Key],
  ) => void;
  onReset: () => void;
};

type Tier = "basic" | "advanced" | "hyper";

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const toPercent = (value: number, min: number, max: number) =>
  clamp01((value - min) / (max - min)) * 100;
const fromPercent = (value: number, min: number, max: number) =>
  min + clamp01(value / 100) * (max - min);
const amountWord = (value: number) =>
  value < 34 ? "Subtle" : value < 67 ? "Balanced" : "Strong";

const shapes: Array<{ id: MagneticParticleShape; label: string; glyph: string }> = [
  { id: "dash", label: "Dash", glyph: "—" },
  { id: "pill", label: "Pill", glyph: "⬭" },
  { id: "diamond", label: "Diamond", glyph: "◆" },
  { id: "circle", label: "Circle", glyph: "●" },
];

const palettes: Array<{ id: MagneticPalette; label: string; swatch: string }> = [
  { id: "crimson-white", label: "Red", swatch: "linear-gradient(135deg, #fff 50%, #e01b3c 50%)" },
  { id: "ultraviolet", label: "Violet", swatch: "#ae77ff" },
  { id: "aurora", label: "Aurora", swatch: "#55e2db" },
  { id: "ember", label: "Ember", swatch: "#ff875c" },
];

const backdrops: Array<{ id: MagneticBackdropTheme; label: string; swatch: string }> = [
  { id: "purple-red", label: "Plum", swatch: "linear-gradient(135deg, #782494, #cc2a4a)" },
  { id: "green-blue", label: "Teal", swatch: "linear-gradient(135deg, #186852, #184ca0)" },
  { id: "earth-brown", label: "Amber", swatch: "linear-gradient(135deg, #6e3b12, #aa6820)" },
  { id: "deep-dark", label: "Ink", swatch: "linear-gradient(135deg, #0f1015, #1d1e2a)" },
];

function Switch({ checked, onChange, label }: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      className={`avm__switch ${checked ? "is-checked" : ""}`}
      onClick={() => onChange(!checked)}
      aria-label={label}
    >
      <span className="avm__switch-track"><span className="avm__switch-thumb" /></span>
    </button>
  );
}

function Slider({
  label, value, min, max, step, onChange, format, lowLabel, highLabel, description,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  format?: (value: number) => string;
  lowLabel?: string;
  highLabel?: string;
  description?: string;
}) {
  return (
    <label className="avm__slider">
      <span className="avm__slider-head">
        <span className="avm__slider-label">{label}</span>
        <span className="avm__slider-value">{format ? format(value) : value.toFixed(2)}</span>
      </span>
      <input
        type="range"
        aria-label={label}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      {(lowLabel || highLabel) && (
        <span className="avm__slider-direction" aria-hidden="true">
          <span>{lowLabel}</span><span>{highLabel}</span>
        </span>
      )}
      {description && <span className="avm__slider-description">{description}</span>}
    </label>
  );
}

function BandControl({
  name, value, reactive, route, onValue, onReactive,
}: {
  name: string;
  value: number;
  reactive: boolean;
  route: string;
  onValue: (value: number) => void;
  onReactive: (value: boolean) => void;
}) {
  return (
    <div className={`avm__band-card ${reactive ? "is-active" : "is-muted"}`}>
      <span className="avm__band-name">{name}</span>
      <input
        className="avm__band-slider"
        type="range"
        min={0}
        max={2}
        step={0.02}
        value={value}
        disabled={!reactive}
        aria-label={`${name} influence`}
        onChange={(event) => onValue(Number(event.target.value))}
      />
      <Switch checked={reactive} onChange={onReactive} label={`Toggle ${name}`} />
      <span className="avm__band-route">{route}</span>
    </div>
  );
}

function SwitchRow({ label, hint, checked, onChange }: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="avm__switch-row">
      <span><strong>{label}</strong><small>{hint}</small></span>
      <Switch checked={checked} onChange={onChange} label={`Toggle ${label}`} />
    </div>
  );
}

function Section({ label, note, children }: {
  label: string;
  note?: string;
  children: ReactNode;
}) {
  return (
    <section className="avm__section" aria-label={label}>
      <div className="avm__section-header">
        <p className="avm__eyebrow">{label}</p>
        {note && <span className="avm__section-sub">{note}</span>}
      </div>
      {children}
    </section>
  );
}

export function MagneticControlsV2({ settings, onUpdate, onReset }: Props) {
  const [tier, setTier] = useState<Tier>("basic");
  const snap = 100 - toPercent(settings.apertureAttackMs, 8, 140);
  const hitDetail = 100 - toPercent(settings.onsetThreshold, 0.04, 0.2);
  const quietDetail = 100 - toPercent(settings.noiseFloor, -96, -42);

  return (
    <div className="avm__controls">
      <div className="avm__tab-bar avm__tab-bar--three" role="tablist" aria-label="Control depth">
        {(["basic", "advanced", "hyper"] as Tier[]).map((item) => (
          <button
            key={item}
            type="button"
            role="tab"
            className={`avm__tab-btn ${tier === item ? "is-active" : ""}`}
            aria-selected={tier === item}
            onClick={() => setTier(item)}
          >
            {item}
          </button>
        ))}
      </div>

      {tier === "basic" && (
        <div className="avm__tab-content">
          <div className="avm__tier-intro">
            <strong>Shape the feeling</strong>
            <span>Right means more response. Every control names the visual result.</span>
          </div>

          <Section label="Overall feel" note="Music → movement">
            <div className="avm__knobs">
              <Slider
                label="Visual Energy"
                value={settings.overallReaction}
                min={0.1} max={2} step={0.02}
                format={(value) => `${value.toFixed(2)}×`}
                lowLabel="Restrained" highLabel="Explosive"
                description="Controls the shared strength of impacts, motion and spectral shape."
                onChange={(value) => onUpdate("overallReaction", value)}
              />
              <Slider
                label="Snap"
                value={snap}
                min={0} max={100} step={1}
                format={(value) => amountWord(value)}
                lowLabel="Soft" highLabel="Instant"
                description="How quickly sustained musical energy reaches the field."
                onChange={(value) => onUpdate("apertureAttackMs", fromPercent(100 - value, 8, 140))}
              />
              <Slider
                label="Visual Trail"
                value={settings.apertureReleaseMs}
                min={50} max={600} step={10}
                format={(value) => value < 150 ? "Crisp" : value < 320 ? "Flowing" : "Long"}
                lowLabel="Crisp" highLabel="Flowing"
                description="How long musical energy remains visible after the sound falls away."
                onChange={(value) => onUpdate("apertureReleaseMs", value)}
              />
              <Slider
                label="Hit Detail"
                value={hitDetail}
                min={0} max={100} step={1}
                format={(value) => amountWord(value)}
                lowLabel="Big hits" highLabel="Micro hits"
                description="How easily kicks, syllables, picks and hi-hats create a new event."
                onChange={(value) => onUpdate("onsetThreshold", fromPercent(100 - value, 0.04, 0.2))}
              />
              <Slider
                label="Quiet Detail"
                value={quietDetail}
                min={0} max={100} step={1}
                format={(value) => amountWord(value)}
                lowLabel="Clean" highLabel="Whispers"
                description="Reveals quieter material, but the far right can also reveal room noise."
                onChange={(value) => onUpdate("noiseFloor", fromPercent(100 - value, -96, -42))}
              />
            </div>
          </Section>

          <Section label="Musical focus" note="Three clear visual jobs">
            <div className="avm__bands">
              <BandControl
                name="Low Punch" value={settings.bassSensitivity} reactive={settings.bassReactive}
                route="Kick & bass → core bloom, pressure wave, radial push"
                onValue={(value) => onUpdate("bassSensitivity", value)}
                onReactive={(value) => onUpdate("bassReactive", value)}
              />
              <BandControl
                name="Mid Presence" value={settings.midSensitivity} reactive={settings.midReactive}
                route="Voice, guitar & snare → petals, twist, orbital motion"
                onValue={(value) => onUpdate("midSensitivity", value)}
                onReactive={(value) => onUpdate("midReactive", value)}
              />
              <BandControl
                name="High Detail" value={settings.highSensitivity} reactive={settings.highReactive}
                route="Cymbals & harmonics → edge detail, shimmer, sparks"
                onValue={(value) => onUpdate("highSensitivity", value)}
                onReactive={(value) => onUpdate("highReactive", value)}
              />
            </div>
          </Section>

          <Section label="Bass light" note="Impact layer">
            <div className="avm__knobs">
              <Slider
                label="Core Bloom" value={settings.bassBloom}
                min={0} max={2.5} step={0.05}
                lowLabel="Dark" highLabel="Radiant"
                description="A central glow appears at the instant of a strong kick or bass drum."
                onChange={(value) => onUpdate("bassBloom", value)}
              />
              <Slider
                label="Pressure Wave" value={settings.bassWave}
                min={0} max={2.5} step={0.05}
                lowLabel="Still" highLabel="Expanding"
                description="Sends a thin radial wave from the core into the background."
                onChange={(value) => onUpdate("bassWave", value)}
              />
            </div>
          </Section>
        </div>
      )}

      {tier === "advanced" && (
        <div className="avm__tab-content">
          <div className="avm__tier-intro">
            <strong>Compose the image</strong>
            <span>Control the field, material, contour and atmosphere.</span>
          </div>

          <Section label="Field dynamics">
            <div className="avm__knobs">
              <Slider label="Gravity Pull" value={settings.gravityPull} min={0} max={3} step={0.05}
                lowLabel="Loose" highLabel="Magnetic" onChange={(value) => onUpdate("gravityPull", value)} />
              <Slider label="Impact Force" value={settings.burstStrength} min={0} max={2.5} step={0.05}
                lowLabel="Gentle" highLabel="Forceful" onChange={(value) => onUpdate("burstStrength", value)} />
              <Slider label="Field Spread" value={settings.fieldSpread} min={0.55} max={1.55} step={0.02}
                lowLabel="Tight" highLabel="Wide" onChange={(value) => onUpdate("fieldSpread", value)} />
              <Slider label="Orbit" value={settings.rotationSpeed} min={0} max={1.5} step={0.02}
                lowLabel="Still" highLabel="Fast" onChange={(value) => onUpdate("rotationSpeed", value)} />
            </div>
            <div className="avm__toggle-row">
              <button type="button" className={`avm__toggle-btn ${settings.rotationDirection === -1 ? "is-active" : ""}`}
                onClick={() => onUpdate("rotationDirection", -1)}>↺ Counter</button>
              <button type="button" className={`avm__toggle-btn ${settings.rotationDirection === 1 ? "is-active" : ""}`}
                onClick={() => onUpdate("rotationDirection", 1)}>↻ Clockwise</button>
            </div>
          </Section>

          <Section label="Living aperture" note="Full-spectrum contour">
            <SwitchRow label="Central contour" hint="The breathing spectral edge around the core"
              checked={settings.contourVisible} onChange={(value) => onUpdate("contourVisible", value)} />
            {settings.contourVisible && <div className="avm__knobs">
              <Slider label="Contour Layers" value={settings.contourRings} min={1} max={12} step={1}
                format={(value) => `${Math.round(value)} layers`} lowLabel="Singular" highLabel="Layered"
                onChange={(value) => onUpdate("contourRings", Math.round(value))} />
              <Slider label="Organic Warp" value={settings.contourDeformation} min={0.2} max={3} step={0.05}
                lowLabel="Round" highLabel="Amoebic" onChange={(value) => onUpdate("contourDeformation", value)} />
              <Slider label="Spectrum Carving" value={settings.spectralDetail} min={0} max={2.5} step={0.05}
                lowLabel="Smooth" highLabel="Detailed"
                description="The 24-band spectrum sculpts fine peaks around the contour."
                onChange={(value) => onUpdate("spectralDetail", value)} />
            </div>}
          </Section>

          <Section label="Particle material">
            <div className="avm__shape-grid">
              {shapes.map((shape) => <button key={shape.id} type="button"
                className={`avm__shape-btn ${settings.particleShape === shape.id ? "is-active" : ""}`}
                aria-pressed={settings.particleShape === shape.id}
                aria-label={shape.label} title={shape.label}
                onClick={() => onUpdate("particleShape", shape.id)}>
                <span className="avm__shape-glyph" aria-hidden="true">{shape.glyph}</span>
              </button>)}
            </div>
            <div className="avm__knobs">
              <Slider label="Particle Count" value={settings.pieceCount} min={120} max={1200} step={20}
                format={(value) => String(Math.round(value))} lowLabel="Sparse" highLabel="Dense"
                onChange={(value) => onUpdate("pieceCount", value)} />
              <Slider label="Visible Density" value={settings.density} min={0.3} max={1} step={0.05}
                format={(value) => `${Math.round(value * 100)}%`} lowLabel="Airy" highLabel="Full"
                onChange={(value) => onUpdate("density", value)} />
              <Slider label="Length" value={settings.pieceLength} min={0.35} max={2.2} step={0.05}
                lowLabel="Compact" highLabel="Stretched" onChange={(value) => onUpdate("pieceLength", value)} />
              <Slider label="Width" value={settings.pieceWidth} min={0.4} max={2} step={0.05}
                lowLabel="Fine" highLabel="Heavy" onChange={(value) => onUpdate("pieceWidth", value)} />
            </div>
          </Section>

          <Section label="Colour atmosphere">
            <div className="avm__palette-grid">
              {palettes.map((palette) => <button key={palette.id} type="button"
                className={`avm__palette-btn ${settings.palette === palette.id ? "is-active" : ""}`}
                onClick={() => onUpdate("palette", palette.id)}>
                <span className="avm__palette-swatch" style={{ background: palette.swatch }} />{palette.label}
              </button>)}
            </div>
            <SwitchRow label="Aurora backdrop" hint="Slow atmosphere behind impacts"
              checked={settings.backdropVisible} onChange={(value) => onUpdate("backdropVisible", value)} />
            {settings.backdropVisible && <>
              <div className="avm__palette-grid">
                {backdrops.map((backdrop) => <button key={backdrop.id} type="button"
                  className={`avm__palette-btn ${settings.backdropTheme === backdrop.id ? "is-active" : ""}`}
                  onClick={() => onUpdate("backdropTheme", backdrop.id)}>
                  <span className="avm__palette-swatch" style={{ background: backdrop.swatch }} />{backdrop.label}
                </button>)}
              </div>
              <Slider label="Atmosphere" value={settings.backdropIntensity} min={0} max={1} step={0.05}
                format={(value) => `${Math.round(value * 100)}%`} lowLabel="Ink" highLabel="Immersive"
                onChange={(value) => onUpdate("backdropIntensity", value)} />
            </>}
          </Section>
        </div>
      )}

      {tier === "hyper" && (
        <div className="avm__tab-content">
          <div className="avm__tier-intro avm__tier-intro--hyper">
            <strong>Calibrate the instrument</strong>
            <span>Raw analysis and physics. Small changes can be dramatic.</span>
          </div>

          <Section label="Frequency gates" note="Hz">
            <div className="avm__knobs">
              <Slider label="Low / Mid Split" value={settings.bassMidCrossover} min={90} max={420} step={5}
                format={(value) => `${Math.round(value)} Hz`} onChange={(value) => onUpdate("bassMidCrossover", value)} />
              <Slider label="Mid / High Split" value={settings.midHighCrossover} min={900} max={7000} step={50}
                format={(value) => `${Math.round(value)} Hz`} onChange={(value) => onUpdate("midHighCrossover", value)} />
            </div>
          </Section>

          <Section label="Detection engine" note="Raw values">
            <div className="avm__knobs">
              <Slider label="Noise Floor" value={settings.noiseFloor} min={-96} max={-42} step={1}
                format={(value) => `${Math.round(value)} dB`} onChange={(value) => onUpdate("noiseFloor", value)} />
              <Slider label="Normalisation" value={settings.normalisation} min={0.4} max={2.5} step={0.05}
                format={(value) => `${value.toFixed(2)}×`} onChange={(value) => onUpdate("normalisation", value)} />
              <Slider label="Onset Threshold" value={settings.onsetThreshold} min={0.04} max={0.5} step={0.01}
                onChange={(value) => onUpdate("onsetThreshold", value)} />
              <Slider label="Retrigger Cooldown" value={settings.onsetCooldownMs} min={60} max={700} step={10}
                format={(value) => `${Math.round(value)} ms`} onChange={(value) => onUpdate("onsetCooldownMs", value)} />
              <Slider label="Energy Attack" value={settings.apertureAttackMs} min={8} max={240} step={2}
                format={(value) => `${Math.round(value)} ms`} onChange={(value) => onUpdate("apertureAttackMs", value)} />
              <Slider label="Energy Release" value={settings.apertureReleaseMs} min={50} max={900} step={10}
                format={(value) => `${Math.round(value)} ms`} onChange={(value) => onUpdate("apertureReleaseMs", value)} />
            </div>
          </Section>

          <Section label="Formation physics">
            <div className="avm__knobs">
              <Slider label="Tangential Force" value={settings.tangentForce} min={0} max={2} step={0.05}
                onChange={(value) => onUpdate("tangentForce", value)} />
              <Slider label="Home Restore" value={settings.homeRestore} min={0} max={3} step={0.05}
                onChange={(value) => onUpdate("homeRestore", value)} />
              <Slider label="Eccentricity" value={settings.eccentricity} min={0.4} max={1.15} step={0.01}
                onChange={(value) => onUpdate("eccentricity", value)} />
              <Slider label="Petal Count" value={settings.petalCount} min={2} max={10} step={1}
                format={(value) => String(Math.round(value))} onChange={(value) => onUpdate("petalCount", Math.round(value))} />
              <Slider label="Formation Rings" value={settings.ringCount} min={2} max={9} step={1}
                format={(value) => String(Math.round(value))} onChange={(value) => onUpdate("ringCount", Math.round(value))} />
              <Slider label="Seed Jitter" value={settings.seedJitter} min={0} max={1} step={0.02}
                onChange={(value) => onUpdate("seedJitter", value)} />
              <Slider label="Size Variation" value={settings.sizeVariation} min={0} max={1} step={0.05}
                onChange={(value) => onUpdate("sizeVariation", value)} />
            </div>
          </Section>

          <Section label="Family visibility">
            <SwitchRow label="Low particles" hint="Inner field family" checked={settings.bassVisible}
              onChange={(value) => onUpdate("bassVisible", value)} />
            <SwitchRow label="Mid particles" hint="Middle field family" checked={settings.midVisible}
              onChange={(value) => onUpdate("midVisible", value)} />
            <SwitchRow label="High particles" hint="Outer field family" checked={settings.highVisible}
              onChange={(value) => onUpdate("highVisible", value)} />
            <SwitchRow label="Diagnostics" hint="FPS and feature values" checked={settings.diagnostics}
              onChange={(value) => onUpdate("diagnostics", value)} />
          </Section>
        </div>
      )}

      <div className="avm__footer">
        <button type="button" className="avm__reset-btn" onClick={onReset}>
          <RotateCcw size={12} aria-hidden="true" /> Reset to defaults
        </button>
      </div>
    </div>
  );
}
