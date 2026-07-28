import { type MutableRefObject, useEffect, useRef } from "react";
import { renderSceneToCanvas } from "./engine/renderers/canvas";
import type { LoomSettings, Scene } from "./types";

export interface CanvasMetrics {
  fps: number;
  time: number;
}

export default function GlyphCanvas({
  scene,
  settings,
  canvasRef,
  onMetrics,
  onOriginChange,
}: {
  scene: Scene;
  settings: LoomSettings;
  canvasRef: MutableRefObject<HTMLCanvasElement | null>;
  onMetrics: (metrics: CanvasMetrics) => void;
  onOriginChange: (x: number, y: number) => void;
}) {
  const currentTime = useRef(settings.time);
  const lastFrame = useRef<number | null>(null);
  const frameSamples = useRef<number[]>([]);
  const lastMetrics = useRef(0);

  useEffect(() => {
    if (!settings.playing) currentTime.current = settings.time;
  }, [settings.playing, settings.time]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(scene.width * ratio);
    canvas.height = Math.round(scene.height * ratio);
    canvas.style.aspectRatio = `${scene.width} / ${scene.height}`;
    const context = canvas.getContext("2d");
    if (!context) return undefined;
    let frameId = 0;
    lastFrame.current = null;

    const draw = (timestamp: number) => {
      const previous = lastFrame.current ?? timestamp;
      const delta = Math.min(0.1, Math.max(0, (timestamp - previous) / 1000));
      lastFrame.current = timestamp;
      if (settings.playing) currentTime.current += delta;
      const quantizedTime = settings.posterFps < 60
        ? Math.floor(currentTime.current * settings.posterFps) / settings.posterFps
        : currentTime.current;

      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      renderSceneToCanvas(context, scene, settings, quantizedTime);
      frameSamples.current.push(delta);
      if (frameSamples.current.length > 40) frameSamples.current.shift();
      if (timestamp - lastMetrics.current > 500) {
        const average = frameSamples.current.reduce((sum, value) => sum + value, 0)
          / Math.max(1, frameSamples.current.length);
        onMetrics({ fps: average > 0 ? Math.min(99, Math.round(1 / average)) : 60, time: currentTime.current });
        lastMetrics.current = timestamp;
      }
      if (settings.playing) frameId = requestAnimationFrame(draw);
    };

    draw(performance.now());
    return () => cancelAnimationFrame(frameId);
  }, [canvasRef, onMetrics, scene, settings]);

  const updateOrigin = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const bounds = canvas.getBoundingClientRect();
    onOriginChange(
      Math.max(0, Math.min(1, (clientX - bounds.left) / bounds.width)),
      Math.max(0, Math.min(1, (clientY - bounds.top) / bounds.height)),
    );
  };

  return (
    <canvas
      ref={canvasRef}
      className="loom-canvas"
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        updateOrigin(event.clientX, event.clientY);
      }}
      onPointerMove={(event) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          updateOrigin(event.clientX, event.clientY);
        }
      }}
      onDoubleClick={() => onOriginChange(0.5, 0.5)}
      aria-label="Animated Glyph Loom preview. Drag to move the animation origin."
      role="img"
    />
  );
}

