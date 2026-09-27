import { AudioAnalyserProcessor } from "./audioAnalysis";
import type { AudioVisualiserSettings } from "./types";

type RendererOptions = {
  canvas: HTMLCanvasElement;
  getAnalyser: () => AnalyserNode | null;
  getSettings: () => AudioVisualiserSettings;
  onFps?: (fps: number) => void;
};

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

const spatialProfile = (position: number) => {
  const bump = (center: number, spread: number, height: number) => {
    const distance = (position - center) / spread;
    return Math.exp(-distance * distance) * height;
  };

  return Math.min(
    1,
    0.48 +
      bump(0.13, 0.08, 0.34) +
      bump(0.34, 0.12, 0.48) +
      bump(0.59, 0.1, 0.4) +
      bump(0.84, 0.07, 0.44),
  );
};

const roundRect = (
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) => {
  if (typeof context.roundRect === "function") {
    context.roundRect(x, y, width, height, radius);
    return;
  }
  const r = Math.min(radius, width / 2, height / 2);
  context.moveTo(x + r, y);
  context.arcTo(x + width, y, x + width, y + height, r);
  context.arcTo(x + width, y + height, x, y + height, r);
  context.arcTo(x, y + height, x, y, r);
  context.arcTo(x, y, x + width, y, r);
};

export class WaveformRenderer {
  private readonly context: CanvasRenderingContext2D;
  private readonly processor = new AudioAnalyserProcessor();
  private animationFrame = 0;
  private resizeObserver: ResizeObserver | null = null;
  private smoothedBars = new Float32Array(0);
  private lastFrameTime = 0;
  private frameCounter = 0;
  private fpsWindowStart = 0;
  private cssWidth = 0;
  private cssHeight = 0;
  private gradient: CanvasGradient | null = null;
  private gradientHue = Number.NaN;
  private disposed = false;

  constructor(private readonly options: RendererOptions) {
    const context = options.canvas.getContext("2d", {
      alpha: false,
      desynchronized: true,
    });
    if (!context) throw new Error("Canvas 2D is unavailable.");
    this.context = context;
  }

  start() {
    this.resizeObserver = new ResizeObserver(this.resize);
    this.resizeObserver.observe(this.options.canvas);
    document.addEventListener("visibilitychange", this.handleVisibility);
    this.resize();
    this.scheduleFrame();
  }

  private resize = () => {
    const rect = this.options.canvas.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));
    const pixelRatio = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
    const pixelWidth = Math.round(width * pixelRatio);
    const pixelHeight = Math.round(height * pixelRatio);

    if (
      this.options.canvas.width !== pixelWidth ||
      this.options.canvas.height !== pixelHeight
    ) {
      this.options.canvas.width = pixelWidth;
      this.options.canvas.height = pixelHeight;
    }

    this.cssWidth = width;
    this.cssHeight = height;
    this.context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    this.gradient = null;
  };

  private handleVisibility = () => {
    if (document.hidden) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = 0;
      return;
    }
    this.lastFrameTime = performance.now();
    this.fpsWindowStart = this.lastFrameTime;
    this.scheduleFrame();
  };

  private scheduleFrame() {
    if (this.disposed || document.hidden || this.animationFrame) return;
    this.animationFrame = requestAnimationFrame(this.draw);
  }

  private ensureGradient(hueShift: number, left: number, width: number) {
    if (this.gradient && this.gradientHue === hueShift) return this.gradient;
    const gradient = this.context.createLinearGradient(left, 0, left + width, 0);
    gradient.addColorStop(0, `hsl(${255 + hueShift} 93% 63%)`);
    gradient.addColorStop(0.28, `hsl(${268 + hueShift} 92% 66%)`);
    gradient.addColorStop(0.56, `hsl(${222 + hueShift} 96% 63%)`);
    gradient.addColorStop(0.8, `hsl(${194 + hueShift} 94% 58%)`);
    gradient.addColorStop(1, `hsl(${174 + hueShift} 88% 53%)`);
    this.gradient = gradient;
    this.gradientHue = hueShift;
    return gradient;
  }

  private draw = (time: number) => {
    this.animationFrame = 0;
    if (this.disposed || document.hidden) return;

    const settings = this.options.getSettings();
    const audio = this.processor.process(this.options.getAnalyser(), settings);
    if (this.smoothedBars.length !== settings.barCount) {
      const previous = this.smoothedBars;
      this.smoothedBars = new Float32Array(settings.barCount);
      for (let index = 0; index < settings.barCount; index += 1) {
        const previousIndex = Math.min(
          previous.length - 1,
          Math.round((index / Math.max(1, settings.barCount - 1)) * (previous.length - 1)),
        );
        this.smoothedBars[index] =
          previousIndex >= 0 ? previous[previousIndex] : 0;
      }
    }

    const deltaSeconds = Math.min(
      0.1,
      Math.max(1 / 240, (time - (this.lastFrameTime || time)) / 1000),
    );
    this.lastFrameTime = time;

    for (let index = 0; index < settings.barCount; index += 1) {
      const target = audio.bars[index] || 0;
      const current = this.smoothedBars[index];
      const timeConstant =
        target > current ? settings.attackMs / 1000 : settings.releaseMs / 1000;
      const amount = 1 - Math.exp(-deltaSeconds / Math.max(0.001, timeConstant));
      this.smoothedBars[index] = current + (target - current) * amount;
    }

    this.paint(settings);
    this.measureFps(time);
    this.scheduleFrame();
  };

  private paint(settings: AudioVisualiserSettings) {
    const { context, cssWidth: width, cssHeight: height } = this;
    context.fillStyle = "#1b232d";
    context.fillRect(0, 0, width, height);

    const count = settings.barCount;
    const span = width * 0.9;
    const left = (width - span) / 2;
    const safeGap = Math.min(
      settings.barGap,
      Math.max(0.75, (span - count * 1.6) / Math.max(1, count - 1)),
    );
    const barWidth = Math.max(1.6, (span - safeGap * (count - 1)) / count);
    const maxHeight = height * (settings.heightPercent / 100);
    const centerY = height / 2;
    const idleHeight = Math.max(3, Math.min(8, height * 0.007));
    const gradient = this.ensureGradient(settings.hueShift, left, span);

    const buildBars = () => {
      context.beginPath();
      for (let index = 0; index < count; index += 1) {
        const position = count === 1 ? 0.5 : index / (count - 1);
        const energy = clamp01(this.smoothedBars[index]);
        const profile = spatialProfile(position);
        const totalHeight = Math.min(
          maxHeight,
          idleHeight + energy * profile * Math.max(0, maxHeight - idleHeight),
        );
        const x = left + index * (barWidth + safeGap);
        const y = centerY - totalHeight / 2;
        roundRect(
          context,
          x,
          y,
          barWidth,
          totalHeight,
          Math.min(2.5, barWidth * 0.45),
        );
      }
    };

    if (settings.glow > 0.01) {
      context.save();
      context.globalCompositeOperation = "lighter";
      context.globalAlpha = 0.16 + settings.glow * 0.2;
      context.shadowColor = `hsla(${205 + settings.hueShift} 100% 65% / ${0.4 + settings.glow * 0.35})`;
      context.shadowBlur = 6 + settings.glow * 18;
      context.fillStyle = gradient;
      buildBars();
      context.fill();
      context.restore();
    }

    context.save();
    context.fillStyle = gradient;
    buildBars();
    context.fill();
    context.restore();
  }

  private measureFps(time: number) {
    this.frameCounter += 1;
    if (!this.fpsWindowStart) this.fpsWindowStart = time;
    const elapsed = time - this.fpsWindowStart;
    if (elapsed < 1000) return;
    this.options.onFps?.(Math.round((this.frameCounter * 1000) / elapsed));
    this.frameCounter = 0;
    this.fpsWindowStart = time;
  }

  destroy() {
    this.disposed = true;
    cancelAnimationFrame(this.animationFrame);
    this.animationFrame = 0;
    this.resizeObserver?.disconnect();
    document.removeEventListener("visibilitychange", this.handleVisibility);
  }
}

