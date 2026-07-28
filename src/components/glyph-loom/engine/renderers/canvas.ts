import type { LoomSettings, Scene } from "../../types";
import { animateModule } from "../animation/animate";
import { drawCanvasPrimitive } from "./primitives";

export function renderSceneToCanvas(
  context: CanvasRenderingContext2D,
  scene: Scene,
  settings: LoomSettings,
  time: number,
): void {
  context.save();
  const trailAlpha = settings.playing && settings.motionBlur > 0
    ? Math.max(0.08, 1 - settings.motionBlur * 0.9)
    : 1;
  if (trailAlpha === 1) context.clearRect(0, 0, scene.width, scene.height);
  context.globalAlpha = trailAlpha;
  context.fillStyle = scene.background;
  context.fillRect(0, 0, scene.width, scene.height);
  for (const panel of scene.panels) {
    context.fillStyle = panel.fill;
    context.fillRect(panel.x, panel.y, panel.width, panel.height);
  }
  context.globalAlpha = 1;

  for (const module of scene.modules) {
    const transform = animateModule(module, scene, settings, time);
    if (transform.opacity <= 0.001) continue;
    context.save();
    context.globalAlpha = transform.opacity;
    context.translate(transform.x, transform.y);
    context.rotate(transform.rotation);
    context.scale(transform.scaleX, transform.scaleY);
    drawCanvasPrimitive(context, module);
    context.restore();
  }
  context.restore();
}
