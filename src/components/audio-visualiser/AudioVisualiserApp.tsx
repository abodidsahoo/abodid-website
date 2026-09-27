import { useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  RotateCcw,
  Square,
  Upload,
  Volume2,
} from "lucide-react";
import { AudioSourceManager } from "./AudioSourceManager";
import { MagneticApertureRenderer } from "./MagneticApertureRenderer";
import { MagneticControls } from "./MagneticControls";
import {
  loadMagneticSettings,
  loadSavedSettings,
  MAGNETIC_REFERENCE_SETTINGS,
  REFERENCE_SETTINGS,
  sanitiseMagneticSettings,
  saveMagneticSettings,
  saveSettings,
} from "./settings";
import type {
  AudioSourceSnapshot,
  AudioVisualiserScene,
  AudioVisualiserSettings,
  MagneticApertureSettings,
  MagneticDiagnostics,
} from "./types";
import { WaveformRenderer } from "./WaveformRenderer";
import "./audio-visualiser.css";

const INITIAL_SOURCE: AudioSourceSnapshot = {
  kind: "none",
  label: "No source selected",
  isPlaying: false,
  hasAudioTrack: false,
  currentTime: 0,
  duration: 0,
  volume: 0.8,
  contextState: "not-started",
};

type SliderDefinition = {
  key: keyof AudioVisualiserSettings;
  label: string;
  min: number;
  max: number;
  step: number;
  format: (value: number) => string;
};

const sliders: SliderDefinition[] = [
  { key: "sensitivity", label: "Sensitivity", min: 0.4, max: 2.5, step: 0.05, format: (v) => v.toFixed(2) },
  { key: "bassInfluence", label: "Bass influence", min: 0, max: 2, step: 0.05, format: (v) => v.toFixed(2) },
  { key: "midInfluence", label: "Mid influence", min: 0, max: 2, step: 0.05, format: (v) => v.toFixed(2) },
  { key: "trebleInfluence", label: "Treble influence", min: 0, max: 2, step: 0.05, format: (v) => v.toFixed(2) },
  { key: "attackMs", label: "Attack", min: 10, max: 150, step: 5, format: (v) => `${v} ms` },
  { key: "releaseMs", label: "Release", min: 60, max: 700, step: 10, format: (v) => `${v} ms` },
  { key: "barCount", label: "Bar count", min: 24, max: 96, step: 2, format: (v) => String(v) },
  { key: "barGap", label: "Bar gap", min: 1, max: 10, step: 0.5, format: (v) => `${v.toFixed(1)} px` },
  { key: "heightPercent", label: "Height", min: 20, max: 80, step: 1, format: (v) => `${v}%` },
  { key: "glow", label: "Glow", min: 0, max: 1, step: 0.05, format: (v) => v.toFixed(2) },
  { key: "hueShift", label: "Hue shift", min: -90, max: 90, step: 1, format: (v) => `${v > 0 ? "+" : ""}${v}°` },
];

const formatTime = (seconds: number) => {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.floor(seconds % 60);
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
};

const loadScene = (): AudioVisualiserScene => {
  if (typeof window === "undefined") return "symmetric-waveform";
  return window.localStorage.getItem("audio-visualiser:active-scene:v1") === "magnetic-aperture"
    ? "magnetic-aperture"
    : "symmetric-waveform";
};

export default function AudioVisualiserApp() {
  const waveformCanvasRef = useRef<HTMLCanvasElement>(null);
  const magneticCanvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const managerRef = useRef<AudioSourceManager | null>(null);
  const magneticRendererRef = useRef<MagneticApertureRenderer | null>(null);
  const settingsRef = useRef<AudioVisualiserSettings>(REFERENCE_SETTINGS);
  const magneticSettingsRef = useRef<MagneticApertureSettings>(MAGNETIC_REFERENCE_SETTINGS);
  const [scene, setScene] = useState<AudioVisualiserScene>(loadScene);
  const [settings, setSettings] = useState(loadSavedSettings);
  const [magneticSettings, setMagneticSettings] = useState(loadMagneticSettings);
  const [source, setSource] = useState<AudioSourceSnapshot>(INITIAL_SOURCE);
  const [message, setMessage] = useState(
    "Choose a local track or share a Chrome tab to turn sound into a responsive visual field.",
  );
  const [panelOpen, setPanelOpen] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isUserActive, setIsUserActive] = useState(true);
  const [capturePending, setCapturePending] = useState(false);
  const [fps, setFps] = useState(0);
  const [diagnostics, setDiagnostics] = useState<MagneticDiagnostics | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      saveSettings(settings);
    }, 350);
    return () => clearTimeout(timer);
  }, [settings]);

  useEffect(() => {
    const timer = setTimeout(() => {
      saveMagneticSettings(magneticSettings);
    }, 350);
    return () => clearTimeout(timer);
  }, [magneticSettings]);

  useEffect(() => {
    window.localStorage.setItem("audio-visualiser:active-scene:v1", scene);
  }, [scene]);

  useEffect(() => {
    if (panelRef.current) panelRef.current.inert = !panelOpen;
  }, [panelOpen]);

  useEffect(() => {
    const manager = new AudioSourceManager(setSource, setMessage);
    managerRef.current = manager;
    const handleFullscreenChange = () => {
      const active = document.fullscreenElement === rootRef.current;
      setIsFullscreen(active);
      if (active) setIsUserActive(true);
    };
    const handlePageHide = (event: PageTransitionEvent) => {
      if (!event.persisted) void manager.destroy();
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    window.addEventListener("pagehide", handlePageHide);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      window.removeEventListener("pagehide", handlePageHide);
      void manager.destroy();
      managerRef.current = null;
    };
  }, []);

  // YouTube-style idle hide in fullscreen mode
  useEffect(() => {
    if (!isFullscreen) {
      setIsUserActive(true);
      return;
    }

    let timeoutId: number;
    const wakeUser = () => {
      setIsUserActive(true);
      window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(() => {
        setIsUserActive(false);
      }, 2500);
    };

    // Wake immediately on entry and listen to pointer/keyboard events
    wakeUser();
    const root = rootRef.current || window;
    const events = ["mousemove", "pointermove", "mousedown", "touchstart", "keydown"];
    events.forEach((evt) => root.addEventListener(evt, wakeUser, { passive: true }));

    return () => {
      window.clearTimeout(timeoutId);
      events.forEach((evt) => root.removeEventListener(evt, wakeUser));
    };
  }, [isFullscreen]);

  useEffect(() => {
    const manager = managerRef.current;
    if (!manager) return;
    setFps(0);
    setDiagnostics(null);
    const getAnalyser = () =>
      manager.getSnapshot().isPlaying ? manager.getAnalyser() : null;

    if (scene === "symmetric-waveform" && waveformCanvasRef.current) {
      const renderer = new WaveformRenderer({
        canvas: waveformCanvasRef.current,
        getAnalyser,
        getSettings: () => settingsRef.current,
        onFps: setFps,
      });
      renderer.start();
      return () => renderer.destroy();
    }

    if (scene === "magnetic-aperture" && magneticCanvasRef.current) {
      try {
        const renderer = new MagneticApertureRenderer({
          canvas: magneticCanvasRef.current,
          getAnalyser,
          getSettings: () => magneticSettingsRef.current,
          onDiagnostics: (next) => {
            setDiagnostics(next);
            setFps(next.fps);
          },
        });
        magneticRendererRef.current = renderer;
        renderer.start();
        return () => {
          renderer.destroy();
          magneticRendererRef.current = null;
        };
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Unable to start Magnetic Aperture.");
      }
    }
  }, [scene]);

  const updateSetting = (key: keyof AudioVisualiserSettings, value: number) => {
    const next = { ...settingsRef.current, [key]: value };
    settingsRef.current = next;
    setSettings(next);
  };

  const updateMagneticSetting = <Key extends keyof MagneticApertureSettings>(
    key: Key,
    value: MagneticApertureSettings[Key],
  ) => {
    const next = sanitiseMagneticSettings({ ...magneticSettingsRef.current, [key]: value });
    magneticSettingsRef.current = next;
    setMagneticSettings(next);
  };

  const resetMagnetic = () => {
    const next = { ...MAGNETIC_REFERENCE_SETTINGS };
    magneticSettingsRef.current = next;
    setMagneticSettings(next);
    magneticRendererRef.current?.reset();
  };

  const handleFile = async (file: File | undefined) => {
    if (!file || !managerRef.current) return;
    try {
      await managerRef.current.loadLocalFile(file);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to open that audio file.");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleCapture = async () => {
    if (!managerRef.current || capturePending) return;
    setCapturePending(true);
    setMessage("Choose a Chrome tab and enable “Share tab audio” in the browser prompt.");
    try {
      await managerRef.current.captureTab();
    } catch (error) {
      if (error instanceof DOMException && error.name === "NotAllowedError") {
        setMessage("Tab capture was cancelled. You can try again when ready.");
      } else if (error instanceof Error) {
        setMessage(error.message);
      }
    } finally {
      setCapturePending(false);
    }
  };

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await rootRef.current?.requestFullscreen();
    } catch {
      setMessage("Full screen is unavailable in this browser or window.");
    }
  };

  const isMagnetic = scene === "magnetic-aperture";
  const rootClasses = [
    "av",
    isMagnetic ? "av--magnetic" : "",
    isFullscreen ? "av--fullscreen" : "",
    isFullscreen && !isUserActive ? "is-idle" : "",
  ].filter(Boolean).join(" ");

  return (
    <div className={rootClasses} ref={rootRef}>
      <canvas
        ref={waveformCanvasRef}
        className="av__canvas"
        aria-hidden="true"
        data-testid="waveform-canvas"
        hidden={isMagnetic}
      />
      <canvas
        ref={magneticCanvasRef}
        className="av__canvas"
        aria-hidden="true"
        data-testid="magnetic-aperture-canvas"
        hidden={!isMagnetic}
      />

      {isMagnetic && magneticSettings.diagnostics && diagnostics && (
        <div className="av__diagnostic-overlay" aria-live="off">
          <strong>Magnetic Aperture / live</strong>
          <span>B {diagnostics.bass.toFixed(2)} {diagnostics.bassOnset ? "↑ onset" : ""}</span>
          <span>M {diagnostics.mid.toFixed(2)} {diagnostics.midOnset ? "↑ onset" : ""}</span>
          <span>H {diagnostics.high.toFixed(2)} {diagnostics.highOnset ? "↑ onset" : ""}</span>
          <span>{diagnostics.pullActive ? "PULL" : diagnostics.released ? "RELEASE" : "SETTLE"}</span>
          <span>{diagnostics.particles} pieces · {diagnostics.fps} fps · {diagnostics.frameTime.toFixed(1)} ms</span>
          <small>{diagnostics.renderer}</small>
        </div>
      )}

      {isFullscreen && (
        <button
          type="button"
          className="av__fs-exit-btn"
          onClick={toggleFullscreen}
          title="Exit full screen (Esc)"
          aria-label="Exit full screen"
        >
          <Minimize2 size={14} />
          <span>Exit full screen</span>
        </button>
      )}

      {!panelOpen && (
        <button
          type="button"
          className="av__panel-reveal"
          onClick={() => setPanelOpen(true)}
          aria-controls="audio-visualiser-panel"
          aria-expanded={false}
          aria-label="Show controls"
        >
          <ChevronUp size={15} />
          <span>Controls</span>
        </button>
      )}

      {source.kind === "none" && (
        <div className="av__idle-copy" aria-hidden="true">
          <span>Audio Visualiser / {isMagnetic ? "02" : "01"}</span>
          <p>{isMagnetic ? "Magnetic Aperture is resting. Add audio to pull the field into motion." : "Choose a local track or share a Chrome tab to turn sound into a responsive visual field."}</p>
        </div>
      )}

      <aside
        ref={panelRef}
        id="audio-visualiser-panel"
        className={`av__panel ${panelOpen ? "is-open" : "is-collapsed"}`}
        aria-label="Audio Visualiser controls"
        aria-hidden={!panelOpen}
      >
        <div className="av__panel-scroll">
          <header className="av__header">
            <div className="av__header-info">
              <p className="av__eyebrow">Lab · Scene {isMagnetic ? "02" : "01"}</p>
              <h1>Audio Visualiser</h1>
            </div>
            <div className="av__header-actions">
              <button
                type="button"
                className="av__header-btn"
                onClick={toggleFullscreen}
                title={isFullscreen ? "Exit full screen" : "Enter full screen"}
                aria-label={isFullscreen ? "Exit full screen" : "Enter full screen"}
              >
                {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
              </button>
              <button
                type="button"
                className="av__header-btn"
                onClick={() => setPanelOpen(false)}
                title="Hide controls"
                aria-label="Hide controls"
              >
                <ChevronDown size={15} />
              </button>
            </div>
          </header>

          <section className="av__section av__scene-section" aria-labelledby="scene-title">
            <div className="av__section-heading">
              <h2 id="scene-title">Scene</h2>
              <span>{isMagnetic ? "GPU field" : "Canvas waveform"}</span>
            </div>
            <div className="av__segmented av__scene-picker">
              <button
                type="button"
                className={!isMagnetic ? "is-active" : ""}
                aria-pressed={!isMagnetic}
                onClick={() => setScene("symmetric-waveform")}
              ><small>01</small><span>Symmetric<br />Waveform</span></button>
              <button
                type="button"
                className={isMagnetic ? "is-active" : ""}
                aria-pressed={isMagnetic}
                onClick={() => setScene("magnetic-aperture")}
              ><small>02</small><span>Magnetic<br />Aperture</span></button>
            </div>
          </section>

          <section className="av__section" aria-labelledby="source-title">
            <div className="av__section-heading">
              <h2 id="source-title">Audio source</h2>
              <span>{source.kind === "none" ? "Not connected" : source.label}</span>
            </div>

            <div className="av__source-actions">
              <input
                ref={fileInputRef}
                className="av__visually-hidden"
                type="file"
                accept="audio/*"
                onChange={(event) => handleFile(event.target.files?.[0])}
                tabIndex={-1}
              />
              <button
                type="button"
                className={`av__source-button ${source.kind === "local" ? "is-active" : ""}`}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload size={17} />
                <span><strong>Local audio file</strong><small>Stays in this browser</small></span>
              </button>
              {source.kind === "tab" ? (
                <button
                  type="button"
                  className="av__source-button av__source-button--stop"
                  onClick={() => managerRef.current?.stopCapture()}
                >
                  <Square size={15} fill="currentColor" />
                  <span><strong>Stop capture</strong><small>Stops every shared track</small></span>
                </button>
              ) : (
                <button
                  type="button"
                  className="av__source-button"
                  onClick={handleCapture}
                  disabled={capturePending}
                >
                  <span className="av__capture-mark" aria-hidden="true" />
                  <span><strong>{capturePending ? "Waiting for Chrome…" : "Capture tab audio"}</strong><small>Choose a tab with audio</small></span>
                </button>
              )}
            </div>

            {source.kind === "local" && (
              <div className="av__transport" aria-label="Local audio playback">
                <button
                  type="button"
                  className={`av__play-button ${source.isPlaying ? "is-playing" : "is-paused"}`}
                  onClick={() => void managerRef.current?.toggleLocalPlayback()}
                  aria-label={source.isPlaying ? "Pause audio" : "Play audio"}
                >
                  {source.isPlaying ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
                </button>
                <span className="av__time">{formatTime(source.currentTime)}</span>
                <input
                  aria-label="Audio timeline"
                  type="range"
                  min="0"
                  max={Math.max(0, source.duration)}
                  step="0.01"
                  value={Math.min(source.currentTime, source.duration || 0)}
                  onChange={(event) => managerRef.current?.seekLocal(Number(event.target.value))}
                  disabled={!source.duration}
                />
                <span className="av__time">{formatTime(source.duration)}</span>
                <Volume2 size={16} aria-hidden="true" />
                <input
                  className="av__volume"
                  aria-label="Playback volume"
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={source.volume}
                  onChange={(event) => managerRef.current?.setVolume(Number(event.target.value))}
                />
              </div>
            )}

            <p className="av__message" role="status" aria-live="polite">{message}</p>
            <p className="av__capture-note">
              Tab capture works best in desktop Chrome. This page cannot automatically read Spotify’s desktop app or all Mac speaker output.
            </p>
          </section>

          {isMagnetic ? (
            <MagneticControls
              settings={magneticSettings}
              onUpdate={updateMagneticSetting}
              onReset={resetMagnetic}
            />
          ) : (
            <>
              <div className="av__section-waveform-head">
                <h2>Response</h2>
                <button
                  type="button"
                  className="av__reset"
                  onClick={() => setSettings({ ...REFERENCE_SETTINGS })}
                >
                  <RotateCcw size={13} /> Reset
                </button>
              </div>
              <div className="av__sliders">
                {sliders.map((slider) => (
                  <label className="av__slider" key={slider.key}>
                    <span>{slider.label}</span>
                    <input
                      aria-label={slider.label}
                      type="range"
                      min={slider.min}
                      max={slider.max}
                      step={slider.step}
                      value={settings[slider.key]}
                      onChange={(event) => updateSetting(slider.key, Number(event.target.value))}
                    />
                  </label>
                ))}
              </div>
              <details className="av__diagnostics">
                <summary>Diagnostics</summary>
                <dl>
                  <div><dt>FPS</dt><dd>{fps || "—"}</dd></div>
                  <div><dt>Context</dt><dd>{source.contextState}</dd></div>
                  <div><dt>Track</dt><dd>{source.hasAudioTrack ? "Present" : "None"}</dd></div>
                  <div><dt>Source</dt><dd>{source.kind}</dd></div>
                </dl>
              </details>
            </>
          )}
        </div>
      </aside>
    </div>
  );
}
