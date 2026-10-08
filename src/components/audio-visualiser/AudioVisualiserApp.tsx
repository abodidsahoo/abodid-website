import { useCallback, useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Maximize2,
  Mic,
  Pause,
  Play,
  Square,
  Upload,
  Volume2,
} from "lucide-react";
import { AudioSourceManager } from "./AudioSourceManager";
import { MagneticApertureRenderer } from "./MagneticApertureRenderer";
import { MagneticControlsV2 } from "./MagneticControlsV2";
import {
  loadMagneticSettings,
  MAGNETIC_REFERENCE_SETTINGS,
  sanitiseMagneticSettings,
  saveMagneticSettings,
} from "./settings";
import type {
  AudioSourceSnapshot,
  MagneticApertureSettings,
  MagneticDiagnostics,
} from "./types";
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

type MicrophoneOption = {
  deviceId: string;
  label: string;
};

const formatTime = (seconds: number) => {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.floor(seconds % 60);
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
};

export default function AudioVisualiserApp() {
  const magneticCanvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const managerRef = useRef<AudioSourceManager | null>(null);
  const magneticRendererRef = useRef<MagneticApertureRenderer | null>(null);
  const magneticSettingsRef = useRef<MagneticApertureSettings>(MAGNETIC_REFERENCE_SETTINGS);
  const [magneticSettings, setMagneticSettings] = useState(loadMagneticSettings);
  const [source, setSource] = useState<AudioSourceSnapshot>(INITIAL_SOURCE);
  const [message, setMessage] = useState(
    "Use your microphone, choose a local track, or share a Chrome tab to turn sound into a responsive visual field.",
  );
  const [panelOpen, setPanelOpen] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [capturePending, setCapturePending] = useState<"microphone" | "tab" | null>(null);
  const [microphoneDevices, setMicrophoneDevices] = useState<MicrophoneOption[]>([
    { deviceId: "default", label: "Default microphone" },
  ]);
  const [selectedMicrophoneId, setSelectedMicrophoneId] = useState("default");
  const [diagnostics, setDiagnostics] = useState<MagneticDiagnostics | null>(null);

  const refreshMicrophones = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const microphones = devices
        .filter((device) => device.kind === "audioinput" && device.deviceId)
        .map((device, index) => ({
          deviceId: device.deviceId,
          label: device.label ||
            (device.deviceId === "default"
              ? "Default microphone"
              : `Microphone ${index + 1}`),
        }));

      if (!microphones.some((device) => device.deviceId === "default")) {
        microphones.unshift({ deviceId: "default", label: "Default microphone" });
      }
      setMicrophoneDevices(microphones);
    } catch {
      setMicrophoneDevices([
        { deviceId: "default", label: "Default microphone" },
      ]);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      saveMagneticSettings(magneticSettings);
    }, 350);
    return () => clearTimeout(timer);
  }, [magneticSettings]);

  useEffect(() => {
    if (panelRef.current) panelRef.current.inert = !panelOpen;
  }, [panelOpen]);

  useEffect(() => {
    const manager = new AudioSourceManager(setSource, setMessage);
    managerRef.current = manager;
    const handleFullscreenChange = () => {
      const active = document.fullscreenElement === rootRef.current;
      setIsFullscreen(active);
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

  useEffect(() => {
    void refreshMicrophones();
    const mediaDevices = navigator.mediaDevices;
    mediaDevices?.addEventListener?.("devicechange", refreshMicrophones);
    return () => {
      mediaDevices?.removeEventListener?.("devicechange", refreshMicrophones);
    };
  }, [refreshMicrophones]);

  useEffect(() => {
    const manager = managerRef.current;
    if (!manager) return;
    setDiagnostics(null);
    const getAnalyser = () =>
      manager.getSnapshot().isPlaying ? manager.getAnalyser() : null;

    if (magneticCanvasRef.current) {
      try {
        const renderer = new MagneticApertureRenderer({
          canvas: magneticCanvasRef.current,
          getAnalyser,
          getSettings: () => magneticSettingsRef.current,
          onDiagnostics: (next) => {
            setDiagnostics(next);
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
  }, []);

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
    setCapturePending("tab");
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
      setCapturePending(null);
    }
  };

  const handleMicrophone = async (deviceId = selectedMicrophoneId) => {
    if (!managerRef.current || capturePending) return;
    setCapturePending("microphone");
    setMessage("Waiting for microphone permission…");
    try {
      const activeDeviceId = await managerRef.current.captureMicrophone(deviceId);
      setSelectedMicrophoneId(activeDeviceId);
      await refreshMicrophones();
      return true;
    } catch (error) {
      if (error instanceof DOMException && error.name === "NotAllowedError") {
        setMessage(
          "Microphone access was not granted. Allow it in your browser’s site settings, then try again.",
        );
      } else if (error instanceof DOMException && error.name === "NotFoundError") {
        setMessage("No microphone was found on this device.");
      } else if (error instanceof DOMException && error.name === "NotReadableError") {
        setMessage("The microphone is unavailable or is being used by another app.");
      } else if (error instanceof Error) {
        setMessage(error.message);
      }
      return false;
    } finally {
      setCapturePending(null);
    }
  };

  const handleMicrophoneSelection = async (deviceId: string) => {
    const previousDeviceId = selectedMicrophoneId;
    setSelectedMicrophoneId(deviceId);
    if (source.kind !== "microphone") return;
    const switched = await handleMicrophone(deviceId);
    if (!switched) setSelectedMicrophoneId(previousDeviceId);
  };

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await rootRef.current?.requestFullscreen({ navigationUI: "hide" });
    } catch {
      setMessage("Full screen is unavailable in this browser or window.");
    }
  };

  const rootClasses = [
    "av",
    "av--magnetic",
    isFullscreen ? "av--fullscreen" : "",
  ].filter(Boolean).join(" ");

  return (
    <div className={rootClasses} ref={rootRef}>
      <canvas
        ref={magneticCanvasRef}
        className="av__canvas"
        aria-hidden="true"
        data-testid="magnetic-aperture-canvas"
      />

      {magneticSettings.diagnostics && diagnostics && (
        <div className="av__diagnostic-overlay" aria-live="off">
          <strong>Magnetic Aperture / live</strong>
          <span>B {diagnostics.bass.toFixed(2)} {diagnostics.bassOnset ? "↑ onset" : ""}</span>
          <span>M {diagnostics.mid.toFixed(2)} {diagnostics.midOnset ? "↑ onset" : ""}</span>
          <span>H {diagnostics.high.toFixed(2)} {diagnostics.highOnset ? "↑ onset" : ""}</span>
          <span>BRIGHT {diagnostics.centroid.toFixed(2)} · TEXTURE {diagnostics.texture.toFixed(2)}</span>
          <span>{diagnostics.pullActive ? "PULL" : diagnostics.released ? "RELEASE" : "SETTLE"}</span>
          <span>{diagnostics.particles} pieces · {diagnostics.fps} fps · {diagnostics.frameTime.toFixed(1)} ms</span>
          <small>{diagnostics.renderer}</small>
        </div>
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
          <span>Audio Visualiser / Magnetic Aperture</span>
          <p>Magnetic Aperture is resting. Add audio to pull the field into motion.</p>
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
              <p className="av__eyebrow">Lab · Magnetic Aperture</p>
              <h1>Audio Visualiser</h1>
            </div>
            <div className="av__header-actions">
              <button
                type="button"
                className="av__header-btn"
                onClick={toggleFullscreen}
                title="Pure full screen · press Esc to exit"
                aria-label="Enter pure full screen; press Escape to exit"
              >
                <Maximize2 size={14} />
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
              <label className="av__microphone-picker">
                <span>Microphone input</span>
                <select
                  aria-label="Microphone input"
                  value={selectedMicrophoneId}
                  onChange={(event) => void handleMicrophoneSelection(event.target.value)}
                  disabled={capturePending !== null}
                >
                  {microphoneDevices.map((device) => (
                    <option key={device.deviceId} value={device.deviceId}>
                      {device.label}
                    </option>
                  ))}
                </select>
              </label>
              {source.kind === "microphone" ? (
                <button
                  type="button"
                  className="av__source-button av__source-button--microphone av__source-button--stop"
                  onClick={() => managerRef.current?.stopCapture()}
                >
                  <Square size={15} fill="currentColor" />
                  <span><strong>Stop microphone</strong><small>Releases microphone access</small></span>
                </button>
              ) : (
                <button
                  type="button"
                  className="av__source-button av__source-button--microphone"
                  onClick={() => void handleMicrophone()}
                  disabled={capturePending !== null}
                >
                  <Mic size={17} />
                  <span><strong>{capturePending === "microphone" ? "Waiting for permission…" : "Use live microphone"}</strong><small>Analysed locally · not recorded</small></span>
                </button>
              )}
              <button
                type="button"
                className={`av__source-button av__source-button--file ${source.kind === "local" ? "is-active" : ""}`}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload size={17} />
                <span><strong>Local audio file</strong><small>Stays in this browser</small></span>
              </button>
              {source.kind === "tab" ? (
                <button
                  type="button"
                  className="av__source-button av__source-button--tab av__source-button--stop"
                  onClick={() => managerRef.current?.stopCapture()}
                >
                  <Square size={15} fill="currentColor" />
                  <span><strong>Stop capture</strong><small>Stops every shared track</small></span>
                </button>
              ) : (
                <button
                  type="button"
                  className="av__source-button av__source-button--tab"
                  onClick={handleCapture}
                  disabled={capturePending !== null}
                >
                  <span className="av__capture-mark" aria-hidden="true" />
                  <span><strong>{capturePending === "tab" ? "Waiting for Chrome…" : "Capture tab audio"}</strong><small>Choose a tab with audio</small></span>
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
              Microphone input requires permission and is never sent to a server. Tab capture works best in desktop Chrome.
            </p>
          </section>

          <MagneticControlsV2
            settings={magneticSettings}
            onUpdate={updateMagneticSetting}
            onReset={resetMagnetic}
          />
        </div>
      </aside>
    </div>
  );
}
