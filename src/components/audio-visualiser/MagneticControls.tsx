import { useState } from "react";
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

const shapes: Array<{ id: MagneticParticleShape; label: string; glyph: string }> = [
  { id: "dash",    label: "Dash",    glyph: "—" },
  { id: "pill",    label: "Pill",    glyph: "⬭" },
  { id: "diamond", label: "Diamond", glyph: "◆" },
  { id: "circle",  label: "Circle",  glyph: "●" },
];

const palettes: Array<{ id: MagneticPalette; label: string; swatch: string }> = [
  { id: "crimson-white", label: "Red",         swatch: "linear-gradient(135deg, #ffffff 50%, #e01b3c 50%)" },
  { id: "ultraviolet",   label: "Violet",      swatch: "#ae77ff" },
  { id: "aurora",        label: "Aurora",      swatch: "#55e2db" },
  { id: "ember",         label: "Ember",       swatch: "#ff875c" },
];

const backdrops: Array<{ id: MagneticBackdropTheme; label: string; swatch: string }> = [
  { id: "purple-red",  label: "Plum",  swatch: "linear-gradient(135deg, #782494, #cc2a4a)" },
  { id: "green-blue",  label: "Teal",  swatch: "linear-gradient(135deg, #186852, #184ca0)" },
  { id: "earth-brown", label: "Amber", swatch: "linear-gradient(135deg, #6e3b12, #aa6820)" },
  { id: "deep-dark",   label: "Ink",   swatch: "linear-gradient(135deg, #0f1015, #1d1e2a)" },
];

// Pop Pill Switch Component
function Switch({
  checked,
  onChange,
  label,
  id,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  id?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      id={id}
      aria-checked={checked}
      className={`avm__switch ${checked ? "is-checked" : ""}`}
      onClick={() => onChange(!checked)}
      aria-label={label || "Toggle"}
    >
      <span className="avm__switch-track">
        <span className="avm__switch-thumb" />
      </span>
    </button>
  );
}

// Minimal Slider Row
function Slider({
  label,
  value,
  min,
  max,
  step,
  format,
  onChange,
  disabled,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format?: (v: number) => string;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  return (
    <label className="avm__slider" style={{ opacity: disabled ? 0.45 : 1 }}>
      <div className="avm__slider-head">
        <span className="avm__slider-label">{label}</span>
        <span className="avm__slider-value">{format ? format(value) : value.toFixed(2)}</span>
      </div>
      <input
        type="range"
        aria-label={label}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        disabled={disabled}
      />
    </label>
  );
}

// Direction toggle (CCW / CW)
function Toggle({
  options,
  value,
  onChange,
}: {
  options: Array<{ label: string; value: number | string }>;
  value: number | string;
  onChange: (v: number | string) => void;
}) {
  return (
    <div className="avm__toggle-row">
      {options.map((opt) => (
        <button
          key={String(opt.value)}
          type="button"
          className={`avm__toggle-btn ${value === opt.value ? "is-active" : ""}`}
          aria-pressed={value === opt.value}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// Clean Band Card for Lows / Mids / Highs
function BandRow({
  label,
  band,
  sensitivity,
  reactive,
  onSensitivity,
  onReactive,
}: {
  label: string;
  band: string;
  sensitivity: number;
  reactive: boolean;
  onSensitivity: (v: number) => void;
  onReactive: (v: boolean) => void;
}) {
  return (
    <div className={`avm__band-card ${!reactive ? "is-muted" : "is-active"}`}>
      <div className="avm__band-head">
        <div className="avm__band-meta">
          <span className="avm__band-name">{label}</span>
          <span className="avm__band-badge">{reactive ? `${sensitivity.toFixed(2)}×` : "MUTED"}</span>
        </div>
        <Switch
          checked={reactive}
          onChange={onReactive}
          label={`Toggle ${label} reactivity`}
        />
      </div>
      <input
        type="range"
        aria-label={`${band} sensitivity`}
        min={0}
        max={2.0}
        step={0.02}
        value={sensitivity}
        disabled={!reactive}
        onChange={(e) => onSensitivity(Number(e.target.value))}
        className="avm__band-slider"
      />
    </div>
  );
}

export function MagneticControls({ settings, onUpdate, onReset }: Props) {
  const [activeTab, setActiveTab] = useState<"audio-react" | "visuals">("audio-react");

  return (
    <div className="avm__controls">

      {/* ── INTERNAL BLOCK TAB SWITCHER ─────────────── */}
      <div className="avm__tab-bar">
        <button
          type="button"
          className={`avm__tab-btn ${activeTab === "audio-react" ? "is-active" : ""}`}
          onClick={() => setActiveTab("audio-react")}
          aria-pressed={activeTab === "audio-react"}
        >
          Audio
        </button>
        <button
          type="button"
          className={`avm__tab-btn ${activeTab === "visuals" ? "is-active" : ""}`}
          onClick={() => setActiveTab("visuals")}
          aria-pressed={activeTab === "visuals"}
        >
          Visuals
        </button>
      </div>

      {activeTab === "audio-react" ? (
        /* ═══════════ TAB 1: AUDIO REACT ═══════════ */
        <div className="avm__tab-content">
          {/* Master Sensitivity */}
          <section className="avm__section" aria-label="Master Sensitivity">
            <div className="avm__section-header">
              <p className="avm__eyebrow">Master Sensitivity</p>
            </div>
            <Slider
              label="Sensitivity Multiplier"
              value={settings.overallReaction}
              min={0.1} max={2.0} step={0.02}
              format={(v) => `${v.toFixed(2)}×`}
              onChange={(v) => onUpdate("overallReaction", v)}
            />
          </section>

          {/* Frequency Bands */}
          <section className="avm__section" aria-label="Frequency Bands">
            <div className="avm__section-header">
              <p className="avm__eyebrow">Frequency Bands</p>
            </div>
            <div className="avm__bands">
              <BandRow
                label="Lows"
                band="bass"
                sensitivity={settings.bassSensitivity}
                reactive={settings.bassReactive}
                onSensitivity={(v) => onUpdate("bassSensitivity", v)}
                onReactive={(v) => onUpdate("bassReactive", v)}
              />
              <BandRow
                label="Mids"
                band="mid"
                sensitivity={settings.midSensitivity}
                reactive={settings.midReactive}
                onSensitivity={(v) => onUpdate("midSensitivity", v)}
                onReactive={(v) => onUpdate("midReactive", v)}
              />
              <BandRow
                label="Highs"
                band="high"
                sensitivity={settings.highSensitivity}
                reactive={settings.highReactive}
                onSensitivity={(v) => onUpdate("highSensitivity", v)}
                onReactive={(v) => onUpdate("highReactive", v)}
              />
            </div>
          </section>

          {/* Transient Response Envelope */}
          <section className="avm__section" aria-label="Transient Response Envelope">
            <div className="avm__section-header">
              <p className="avm__eyebrow">Transient Envelope</p>
            </div>
            <div className="avm__knobs">
              <Slider
                label="Attack Speed"
                value={settings.apertureAttackMs}
                min={15} max={240} step={5}
                format={(v) => `${Math.round(v)} ms`}
                onChange={(v) => onUpdate("apertureAttackMs", v)}
              />
              <Slider
                label="Release Decay"
                value={settings.apertureReleaseMs}
                min={80} max={900} step={10}
                format={(v) => `${Math.round(v)} ms`}
                onChange={(v) => onUpdate("apertureReleaseMs", v)}
              />
            </div>
          </section>

          {/* Field Dynamics inside Audio React */}
          <section className="avm__section" aria-label="Field dynamics">
            <div className="avm__section-header">
              <p className="avm__eyebrow">Physics & Field</p>
            </div>
            <div className="avm__knobs">
              <Slider
                label="Gravity Pull"
                value={settings.gravityPull}
                min={0.2} max={3.0} step={0.05}
                format={(v) => `${v.toFixed(2)}×`}
                onChange={(v) => onUpdate("gravityPull", v)}
              />
              <Slider
                label="Burst Strength"
                value={settings.burstStrength}
                min={0} max={2.5} step={0.05}
                format={(v) => v.toFixed(2)}
                onChange={(v) => onUpdate("burstStrength", v)}
              />
              <Slider
                label="Field Spread"
                value={settings.fieldSpread}
                min={0.55} max={1.55} step={0.02}
                format={(v) => v.toFixed(2)}
                onChange={(v) => onUpdate("fieldSpread", v)}
              />
            </div>
          </section>
        </div>
      ) : (
        /* ═══════════ TAB 2: VISUALS ═══════════ */
        <div className="avm__tab-content">
          {/* Section 1: Shape & Particles */}
          <section className="avm__section" aria-label="Shape and Particles">
            <div className="avm__section-header">
              <p className="avm__eyebrow">Shape & Particles</p>
            </div>
            {/* Minimalist thin-outline square buttons (icon only) */}
            <div className="avm__shape-grid">
              {shapes.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className={`avm__shape-btn ${settings.particleShape === s.id ? "is-active" : ""}`}
                  aria-pressed={settings.particleShape === s.id}
                  onClick={() => onUpdate("particleShape", s.id)}
                  aria-label={s.label}
                  title={s.label}
                >
                  <span className="avm__shape-glyph" aria-hidden="true">{s.glyph}</span>
                </button>
              ))}
            </div>

            <div className="avm__knobs">
              <Slider
                label="Scale / Length"
                value={settings.pieceLength}
                min={0.35} max={2.2} step={0.05}
                format={(v) => v.toFixed(2)}
                onChange={(v) => onUpdate("pieceLength", v)}
              />
              <Slider
                label="Width"
                value={settings.pieceWidth}
                min={0.4} max={2} step={0.05}
                format={(v) => v.toFixed(2)}
                onChange={(v) => onUpdate("pieceWidth", v)}
              />
              <Slider
                label="Count"
                value={settings.pieceCount}
                min={120} max={1200} step={20}
                format={(v) => String(Math.round(v))}
                onChange={(v) => onUpdate("pieceCount", v)}
              />
              <Slider
                label="Density"
                value={settings.density}
                min={0.3} max={1} step={0.05}
                format={(v) => `${Math.round(v * 100)}%`}
                onChange={(v) => onUpdate("density", v)}
              />
              <Slider
                label="Size Variation"
                value={settings.sizeVariation}
                min={0} max={1} step={0.05}
                format={(v) => v.toFixed(2)}
                onChange={(v) => onUpdate("sizeVariation", v)}
              />
            </div>
          </section>

          {/* Section 2: Colour & Backdrop */}
          <section className="avm__section" aria-label="Colour and Backdrop">
            <div className="avm__section-header">
              <p className="avm__eyebrow">Particle Palette</p>
            </div>
            <div className="avm__palette-grid">
              {palettes.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={`avm__palette-btn ${settings.palette === p.id ? "is-active" : ""}`}
                  aria-pressed={settings.palette === p.id}
                  onClick={() => onUpdate("palette", p.id)}
                  aria-label={p.label}
                >
                  <span className="avm__palette-swatch" style={{ background: p.swatch }} aria-hidden="true" />
                  <span>{p.label}</span>
                </button>
              ))}
            </div>

            <div className="avm__section-header" style={{ marginTop: 14 }}>
              <p className="avm__eyebrow">Backdrop Aurora</p>
              <Switch
                checked={settings.backdropVisible}
                onChange={(v) => onUpdate("backdropVisible", v)}
                label="Toggle backdrop aurora"
              />
            </div>
            {settings.backdropVisible && (
              <>
                <div className="avm__palette-grid">
                  {backdrops.map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      className={`avm__palette-btn ${settings.backdropTheme === b.id ? "is-active" : ""}`}
                      aria-pressed={settings.backdropTheme === b.id}
                      onClick={() => onUpdate("backdropTheme", b.id)}
                      aria-label={b.label}
                    >
                      <span className="avm__palette-swatch" style={{ background: b.swatch }} aria-hidden="true" />
                      <span>{b.label}</span>
                    </button>
                  ))}
                </div>

                <div style={{ marginTop: 8 }}>
                  <Slider
                    label="Backdrop Atmosphere"
                    value={settings.backdropIntensity}
                    min={0} max={1} step={0.05}
                    format={(v) => `${Math.round(v * 100)}%`}
                    onChange={(v) => onUpdate("backdropIntensity", v)}
                  />
                </div>
              </>
            )}
          </section>

          {/* Central Amoeba Contours */}
          <section className="avm__section" aria-label="Central Amoeba Contours">
            <div className="avm__section-header">
              <p className="avm__eyebrow">Central Contours</p>
              <Switch
                checked={settings.contourVisible}
                onChange={(v) => onUpdate("contourVisible", v)}
                label="Toggle central contours"
              />
            </div>
            {settings.contourVisible && (
              <div className="avm__knobs">
                <Slider
                  label="Contour Strings"
                  value={settings.contourRings}
                  min={1} max={12} step={1}
                  format={(v) => `${Math.round(v)} strings`}
                  onChange={(v) => onUpdate("contourRings", Math.round(v))}
                />
                <Slider
                  label="Distortion Warp"
                  value={settings.contourDeformation}
                  min={0.2} max={2.5} step={0.05}
                  format={(v) => `${v.toFixed(2)}×`}
                  onChange={(v) => onUpdate("contourDeformation", v)}
                />
              </div>
            )}
          </section>

          {/* Rotation & Motion */}
          <section className="avm__section" aria-label="Motion & Rotation">
            <div className="avm__section-header">
              <p className="avm__eyebrow">Rotation</p>
            </div>
            <div className="avm__knobs">
              <Slider
                label="Rotation Speed"
                value={settings.rotationSpeed}
                min={0} max={1.5} step={0.02}
                format={(v) => v.toFixed(2)}
                onChange={(v) => onUpdate("rotationSpeed", v)}
              />
            </div>
            <div style={{ marginTop: 8 }}>
              <Toggle
                options={[{ label: "↺ CCW", value: -1 }, { label: "↻ CW", value: 1 }]}
                value={settings.rotationDirection}
                onChange={(v) => onUpdate("rotationDirection", v as -1 | 1)}
              />
            </div>
          </section>
        </div>
      )}

      {/* ── RESET ───────────────────────────────────── */}
      <div className="avm__footer">
        <button type="button" className="avm__reset-btn" onClick={onReset}>
          <RotateCcw size={12} aria-hidden="true" />
          Reset to defaults
        </button>
      </div>

    </div>
  );
}
