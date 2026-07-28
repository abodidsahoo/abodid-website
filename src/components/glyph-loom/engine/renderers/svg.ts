import type { LoomSettings, Scene } from "../../types";
import { animateModule } from "../animation/animate";
import { svgPrimitive } from "./primitives";

export function renderSceneToSvg(scene: Scene, settings: LoomSettings, time: number): string {
  const panels = scene.panels
    .map((panel) => `<rect x="${panel.x}" y="${panel.y}" width="${panel.width}" height="${panel.height}" fill="${panel.fill}"/>`)
    .join("");
  const modules = scene.modules
    .map((module) => {
      const transform = animateModule(module, scene, settings, time);
      const degrees = transform.rotation * 180 / Math.PI;
      return `<g opacity="${transform.opacity}" transform="translate(${transform.x} ${transform.y}) rotate(${degrees}) scale(${transform.scaleX} ${transform.scaleY})">${svgPrimitive(module)}</g>`;
    })
    .join("");
  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg xmlns="http://www.w3.org/2000/svg" width="${scene.width}" height="${scene.height}" viewBox="0 0 ${scene.width} ${scene.height}" role="img" aria-label="Glyph Loom generative typography">`,
    `<rect width="100%" height="100%" fill="${scene.background}"/>`,
    panels,
    modules,
    "</svg>",
  ].join("");
}

