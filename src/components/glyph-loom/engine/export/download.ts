import type { LoomSettings, Scene } from "../../types";
import { renderSceneToCanvas } from "../renderers/canvas";
import { renderSceneToSvg } from "../renderers/svg";

export function downloadBlobFile(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadSvg(scene: Scene, settings: LoomSettings, time: number): void {
  const svg = renderSceneToSvg(scene, settings, time);
  downloadBlobFile(new Blob([svg], { type: "image/svg+xml" }), "glyph-loom.svg");
}

export async function downloadPng(
  scene: Scene,
  settings: LoomSettings,
  time: number,
  scale: number,
): Promise<void> {
  const safeScale = Math.max(1, Math.min(8, scale));
  const canvas = document.createElement("canvas");
  canvas.width = scene.width * safeScale;
  canvas.height = scene.height * safeScale;
  const context = canvas.getContext("2d");
  if (!context) return;
  context.scale(safeScale, safeScale);
  renderSceneToCanvas(context, scene, { ...settings, playing: false, motionBlur: 0 }, time);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (blob) downloadBlobFile(blob, `glyph-loom-${safeScale}x.png`);
}

export function downloadJson(settings: LoomSettings, scene: Scene): void {
  const payload = JSON.stringify({ app: "Glyph Loom", version: 1, settings, scene }, null, 2);
  downloadBlobFile(new Blob([payload], { type: "application/json" }), "glyph-loom-preset.json");
}

export function downloadText(text: string, filename: string, type = "text/plain"): void {
  downloadBlobFile(new Blob([text], { type }), filename);
}
