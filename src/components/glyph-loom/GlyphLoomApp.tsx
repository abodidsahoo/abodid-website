import {
  Download,
  FileJson,
  Image,
  Link2,
  Pause,
  Play,
  Plus,
  Redo2,
  RefreshCw,
  Shuffle,
  Undo2,
  Video,
  X,
} from "lucide-react";
import {
  type CSSProperties,
  type MutableRefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import ControlPanel from "./controls/ControlPanel";
import { downloadBlobFile, downloadJson, downloadPng, downloadSvg } from "./engine/export/download";
import { loadDefaultFont, loadUploadedFont } from "./engine/glyph/font";
import { createGlyphMask } from "./engine/mask/glyphMask";
import { generateScene } from "./engine/modules/generateScene";
import GlyphCanvas, { type CanvasMetrics } from "./GlyphCanvas";
import { nextSeed } from "./math/random";
import { DEFAULT_SETTINGS, PALETTES, PRESETS } from "./presets";
import type { LoomSettings, Scene } from "./types";
import type * as opentype from "opentype.js";
import "./glyph-loom.css";

const GEOMETRY_KEYS: Array<keyof LoomSettings> = [
  "gridDensity", "spacingX", "spacingY", "gridOffsetX", "gridOffsetY", "coverageThreshold",
  "gridRotation", "gridType", "moduleType", "moduleWidth", "moduleHeight", "strokeWidth",
  "cornerRadius", "aspectRatio", "alternatingOrientation", "overlap", "moduleRotation",
  "checkerFrequency", "parallelLines", "glyphWeight", "erosion", "expansion", "fidelity",
  "abstraction", "removalProbability", "randomness", "seed", "noiseStrength", "noiseScale",
  "directionalBias", "rotationVariance", "scaleVariance", "flowStrength", "background",
  "primaryInk", "secondaryInk", "accent", "colorVariation", "invertPalette", "layout",
  "canvasWidth", "canvasHeight", "overUnder", "roundedEnds",
];

const MASK_KEYS: Array<keyof LoomSettings> = [
  "text", "fontFamily", "fontSize", "letterSpacing", "lineHeight", "align",
  "samplingMode", "samplingResolution", "outlineWidth",
];

function encodeState(settings: LoomSettings): string {
  const bytes = new TextEncoder().encode(JSON.stringify(settings));
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function decodeState(encoded: string): Partial<LoomSettings> {
  const normalized = encoded.replaceAll("-", "+").replaceAll("_", "/");
  const binary = atob(normalized);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes)) as Partial<LoomSettings>;
}

function useSettingsHistory(initial: LoomSettings) {
  const [settings, setSettings] = useState(initial);
  const past = useRef<LoomSettings[]>([]);
  const future = useRef<LoomSettings[]>([]);

  const replace = useCallback((next: LoomSettings, remember = true) => {
    setSettings((current) => {
      if (remember) {
        past.current = [...past.current.slice(-79), current];
        future.current = [];
      }
      return next;
    });
  }, []);

  const update = useCallback(<K extends keyof LoomSettings>(key: K, value: LoomSettings[K]) => {
    setSettings((current) => {
      if (current[key] === value) return current;
      past.current = [...past.current.slice(-79), current];
      future.current = [];
      return { ...current, [key]: value };
    });
  }, []);

  const patch = useCallback((values: Partial<LoomSettings>) => {
    setSettings((current) => {
      past.current = [...past.current.slice(-79), current];
      future.current = [];
      return { ...current, ...values };
    });
  }, []);

  const undo = useCallback(() => {
    const previous = past.current.pop();
    if (!previous) return;
    setSettings((current) => {
      future.current.push(current);
      return previous;
    });
  }, []);

  const redo = useCallback(() => {
    const next = future.current.pop();
    if (!next) return;
    setSettings((current) => {
      past.current.push(current);
      return next;
    });
  }, []);

  return { settings, update, patch, replace, undo, redo, canUndo: past.current.length > 0, canRedo: future.current.length > 0 };
}

async function recordCanvas(
  canvas: HTMLCanvasElement,
  duration: number,
  onState: (active: boolean) => void,
) {
  if (!("MediaRecorder" in window) || !canvas.captureStream) {
    throw new Error("WebM recording is not supported by this browser.");
  }
  onState(true);
  const stream = canvas.captureStream(60);
  const recorder = new MediaRecorder(stream, { mimeType: "video/webm" });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (event) => chunks.push(event.data);
  const stopped = new Promise<void>((resolve) => { recorder.onstop = () => resolve(); });
  recorder.start();
  window.setTimeout(() => recorder.stop(), Math.max(1000, duration * 1000));
  await stopped;
  downloadBlobFile(new Blob(chunks, { type: "video/webm" }), "glyph-loom.webm");
  stream.getTracks().forEach((track) => track.stop());
  onState(false);
}

function loadSharedState(): LoomSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const encoded = new URL(window.location.href).searchParams.get("loom");
    return encoded ? { ...DEFAULT_SETTINGS, ...decodeState(encoded) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export default function GlyphLoomApp() {
  const history = useSettingsHistory(loadSharedState());
  const { settings, update, patch, replace, undo, redo } = history;
  const [font, setFont] = useState<opentype.Font | null>(null);
  const [fontStatus, setFontStatus] = useState("Loading bundled font…");
  const [metrics, setMetrics] = useState<CanvasMetrics>({ fps: 60, time: 0 });
  const [mobilePanel, setMobilePanel] = useState(false);
  const [recording, setRecording] = useState(false);
  const [notice, setNotice] = useState("");
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const panelRef = useRef<HTMLElement | null>(null);
  const renderTimeRef = useRef(0);
  const noticeTimer = useRef<number | null>(null);

  const showNotice = useCallback((message: string) => {
    setNotice(message);
    if (noticeTimer.current) window.clearTimeout(noticeTimer.current);
    noticeTimer.current = window.setTimeout(() => setNotice(""), 2400);
  }, []);

  useEffect(() => {
    loadDefaultFont()
      .then((loaded) => {
        setFont(loaded);
        setFontStatus("Inconsolata / Open Font License");
      })
      .catch(() => setFontStatus("Font could not be loaded"));
  }, []);

  const maskKey = useMemo(
    () => JSON.stringify(MASK_KEYS.map((key) => settings[key])),
    [settings],
  );
  const geometryKey = useMemo(
    () => JSON.stringify(GEOMETRY_KEYS.map((key) => settings[key])),
    [settings],
  );
  const mask = useMemo(
    () => font ? createGlyphMask(font, settings) : null,
    // Keys intentionally isolate the expensive mask from motion and colour changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [font, maskKey],
  );
  const scene: Scene | null = useMemo(
    () => mask ? generateScene(mask, settings) : null,
    // The serialisable scene is rebuilt only when geometry changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mask, geometryKey],
  );

  const handleMetrics = useCallback((next: CanvasMetrics) => {
    renderTimeRef.current = next.time;
    setMetrics(next);
  }, []);

  const updateControl = useCallback(<K extends keyof LoomSettings>(
    key: K,
    value: LoomSettings[K],
  ) => {
    if (key === "layout") {
      const layout = value as LoomSettings["layout"];
      const sizes: Record<LoomSettings["layout"], [number, number]> = {
        single: [1000, 1000],
        word: [1400, 800],
        specimen: [1400, 1000],
        fabric: [1200, 824],
        poster: [1000, 1400],
        fullscreen: [1600, 1000],
        square: [1000, 1000],
        motion: [1600, 900],
      };
      patch({ layout, canvasWidth: sizes[layout][0], canvasHeight: sizes[layout][1] });
      return;
    }
    update(key, value);
  }, [patch, update]);

  const randomise = useCallback((controlled: boolean) => {
    const layouts: LoomSettings["layout"][] = ["single", "word", "specimen", "fabric", "poster", "square", "motion"];
    const palettes: LoomSettings["palette"][] = ["fabric", "mono", "signal", "night"];
    const modules: LoomSettings["moduleType"][] = ["bar", "square", "circle", "cross", "dot", "checker", "lines", "woven", "hybrid"];
    const animations: LoomSettings["animationMode"][] = ["breathing", "ripple", "wovenShift", "noiseDrift", "rotationWave", "scanner", "pixelSort"];
    const seed = nextSeed();
    const random = (offset: number) => {
      const value = Math.sin(seed * 12.9898 + offset * 78.233) * 43758.5453;
      return value - Math.floor(value);
    };
    const values: Partial<LoomSettings> = {
      seed,
      gridDensity: Math.round(14 + random(1) * 38),
      moduleType: modules[Math.floor(random(2) * modules.length)],
      gridType: (["regular", "offset", "checker", "jittered", "contour"] as const)[Math.floor(random(3) * 5)],
      randomness: random(4) * 0.42,
      abstraction: random(5) * 0.5,
      removalProbability: random(6) * 0.22,
      animationMode: animations[Math.floor(random(7) * animations.length)],
      waveAmplitude: 8 + random(8) * 44,
      rotationVariance: random(9) * 24,
      scaleVariance: random(10) * 0.3,
    };
    if (!controlled) {
      const palette = palettes[Math.floor(random(11) * palettes.length)];
      Object.assign(values, {
        layout: layouts[Math.floor(random(12) * layouts.length)],
        palette,
        ...PALETTES[palette],
      });
    }
    patch(values);
    showNotice(controlled ? "Controlled variation created" : "New system generated");
  }, [patch, showNotice]);

  const applyPreset = (name: string) => {
    const preset = PRESETS.find((item) => item.name === name);
    if (preset) {
      replace({ ...DEFAULT_SETTINGS, ...preset.settings });
      showNotice(`${preset.name} loaded`);
    }
  };

  const handleFontUpload = async (file: File) => {
    try {
      const uploaded = await loadUploadedFont(file);
      setFont(uploaded);
      update("fontFamily", "Uploaded");
      setFontStatus(`${file.name} / local only`);
      showNotice("Local font loaded");
    } catch {
      showNotice("That font could not be read");
    }
  };

  const importPreset = async (file: File) => {
    try {
      const payload = JSON.parse(await file.text()) as { settings?: Partial<LoomSettings> };
      if (!payload.settings) throw new Error("Missing settings");
      replace({ ...DEFAULT_SETTINGS, ...payload.settings });
      showNotice("Preset restored");
    } catch {
      showNotice("This preset is not valid");
    }
  };

  const share = async () => {
    const url = new URL(window.location.href);
    url.searchParams.set("loom", encodeState(settings));
    await navigator.clipboard.writeText(url.toString());
    showNotice("Shareable state copied");
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const tag = (event.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (event.code === "Space") {
        event.preventDefault();
        update("playing", !settings.playing);
      }
      if (event.key.toLowerCase() === "r") {
        event.preventDefault();
        update("seed", nextSeed());
        showNotice("New deterministic seed");
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        event.shiftKey ? redo() : undo();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [redo, settings.playing, showNotice, undo, update]);

  if (!scene) {
    return (
      <div className="loom-loading">
        <div className="loom-loading__mark" aria-hidden="true">
          {Array.from({ length: 16 }, (_, index) => <span key={index} />)}
        </div>
        <p>{fontStatus}</p>
      </div>
    );
  }

  return (
    <div className="glyph-loom">
      <header className="loom-header">
        <div className="loom-brand">
          <a href="/research/projects" aria-label="Back to research projects">GL</a>
          <div>
            <h1>Glyph Loom</h1>
            <p>Generative type instrument <span>R.01</span></p>
          </div>
        </div>
        <div className="loom-header__center">
          <label>
            <span>Study</span>
            <select defaultValue="Reference Study" onChange={(event) => applyPreset(event.target.value)}>
              {PRESETS.map((preset) => <option key={preset.name}>{preset.name}</option>)}
            </select>
          </label>
        </div>
        <div className="loom-header__actions">
          <button type="button" onClick={undo} aria-label="Undo" title="Undo">
            <Undo2 size={15} />
          </button>
          <button type="button" onClick={redo} aria-label="Redo" title="Redo">
            <Redo2 size={15} />
          </button>
          <button type="button" className="loom-icon-button" onClick={() => update("seed", nextSeed())} aria-label="New seed" title="New seed (R)">
            <RefreshCw size={15} />
          </button>
          <button type="button" className="loom-primary-button" onClick={() => update("playing", !settings.playing)}>
            {settings.playing ? <Pause size={14} /> : <Play size={14} />}
            {settings.playing ? "Pause" : "Play"}
          </button>
          <button
            type="button"
            className="loom-mobile-toggle"
            onClick={() => {
              const next = !mobilePanel;
              setMobilePanel(next);
              if (next) {
                window.requestAnimationFrame(() => panelRef.current?.scrollTo({ top: 0 }));
              }
            }}
            aria-expanded={mobilePanel}
          >
            {mobilePanel ? <X size={16} /> : <Plus size={16} />}
            Parameters
          </button>
        </div>
      </header>

      <main className="loom-workspace">
        <aside className="loom-preset-rail" aria-label="Preset studies">
          <p className="loom-vertical-label">Studies</p>
          <div className="loom-preset-list">
            {PRESETS.map((preset, index) => (
              <button key={preset.name} type="button" onClick={() => applyPreset(preset.name)} title={preset.description}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <i style={{ "--swatch": PALETTES[(preset.settings.palette || "fabric") as LoomSettings["palette"]].accent } as CSSProperties} />
              </button>
            ))}
          </div>
        </aside>

        <section className="loom-stage">
          <div className="loom-stage__topline">
            <p><span>Fabric specimen</span> / live field</p>
            <p>{scene.width} × {scene.height}</p>
          </div>
          <div className="loom-canvas-frame">
            <GlyphCanvas
              scene={scene}
              settings={settings}
              canvasRef={canvasRef as MutableRefObject<HTMLCanvasElement | null>}
              onMetrics={handleMetrics}
              onOriginChange={(x, y) => patch({ originX: x, originY: y })}
            />
            <div
              className="loom-origin"
              style={{ left: `${settings.originX * 100}%`, top: `${settings.originY * 100}%` }}
              aria-hidden="true"
            />
          </div>
          <div className="loom-stage__status">
            <p><span className={settings.playing ? "is-live" : ""} /> {settings.playing ? "Live" : "Paused"}</p>
            <p>{scene.modules.length.toLocaleString()} modules</p>
            <p>{metrics.fps} FPS</p>
            <p>Seed {settings.seed}</p>
            <p className="loom-stage__hint">Drag field to move origin · Space play/pause · R reseed</p>
          </div>
        </section>

        <aside ref={panelRef} className={`loom-panel ${mobilePanel ? "is-open" : ""}`} aria-label="Glyph Loom parameters">
          <div className="loom-panel__mobile-head">
            <span>Parameters</span>
            <button type="button" onClick={() => setMobilePanel(false)} aria-label="Close parameters"><X size={18} /></button>
          </div>
          <div className="loom-panel__random">
            <button type="button" onClick={() => randomise(false)}><Shuffle size={14} /> Randomise all</button>
            <button type="button" onClick={() => randomise(true)}>Controlled</button>
          </div>
          <ControlPanel settings={settings} update={updateControl} onFontUpload={handleFontUpload} />
          <section className="loom-export">
            <div className="loom-export__heading">
              <span>Export</span>
              <span>{fontStatus}</span>
            </div>
            <div className="loom-export__grid">
              <button type="button" onClick={() => downloadPng(scene, settings, renderTimeRef.current, 2)}>
                <Image size={14} /> PNG 2×
              </button>
              <button type="button" onClick={() => downloadSvg(scene, settings, renderTimeRef.current)}>
                <Download size={14} /> SVG
              </button>
              <button type="button" onClick={() => downloadJson(settings, scene)}>
                <FileJson size={14} /> JSON
              </button>
              <button type="button" onClick={share}>
                <Link2 size={14} /> Share
              </button>
              <button
                type="button"
                disabled={recording}
                onClick={() => canvasRef.current && recordCanvas(canvasRef.current, settings.loopDuration, setRecording)
                  .then(() => showNotice("WebM recorded"))
                  .catch((error: Error) => {
                    setRecording(false);
                    showNotice(error.message);
                  })}
              >
                <Video size={14} /> {recording ? "Recording…" : "WebM"}
              </button>
              <label>
                Import
                <input
                  type="file"
                  accept=".json,application/json"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) importPreset(file);
                  }}
                />
              </label>
            </div>
            <div className="loom-export__scales" aria-label="PNG export scale">
              {[1, 2, 4].map((scale) => (
                <button key={scale} type="button" onClick={() => downloadPng(scene, settings, renderTimeRef.current, scale)}>
                  {scale}×
                </button>
              ))}
            </div>
          </section>
        </aside>
      </main>

      {notice && <div className="loom-notice" role="status">{notice}</div>}
    </div>
  );
}
