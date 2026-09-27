import { describe, expect, it } from "vitest";
import { AudioAnalyserProcessor } from "../audioAnalysis";
import { AudioFeatureProcessor } from "../AudioFeatureProcessor";
import {
  MAGNETIC_REFERENCE_SETTINGS,
  REFERENCE_SETTINGS,
  sanitiseMagneticSettings,
  sanitiseSettings,
} from "../settings";

const fakeAnalyser = (decibels: number): AnalyserNode =>
  ({
    frequencyBinCount: 1024,
    context: { sampleRate: 48_000 },
    getFloatFrequencyData(target: Float32Array) {
      target.fill(decibels);
    },
  }) as unknown as AnalyserNode;

describe("audio visualiser settings", () => {
  it("clamps persisted values and keeps bar counts even", () => {
    expect(
      sanitiseSettings({
        sensitivity: 99,
        attackMs: -20,
        barCount: 55,
        hueShift: -200,
      }),
    ).toMatchObject({
      sensitivity: 2.5,
      attackMs: 10,
      barCount: 56,
      hueShift: -90,
    });
  });

  it("validates Magnetic Aperture presets and preserves safe crossover order", () => {
    expect(
      sanitiseMagneticSettings({
        pieceCount: 9000,
        bassMidCrossover: 400,
        midHighCrossover: 200,
        releaseThreshold: 0.5,
        pullThreshold: 0.2,
        bassVisible: false,
        palette: "ember",
      }),
    ).toMatchObject({
      pieceCount: 1200,
      bassMidCrossover: 400,
      midHighCrossover: 900,
      releaseThreshold: 0.19,
      bassVisible: false,
      palette: "ember",
    });
  });
});

describe("audio analyser processing", () => {
  it("returns true silence instead of inventing animation", () => {
    const frame = new AudioAnalyserProcessor().process(
      fakeAnalyser(-100),
      REFERENCE_SETTINGS,
    );

    expect(frame.hasSignal).toBe(false);
    expect(frame.level).toBe(0);
    expect([...frame.bars].every((value) => value === 0)).toBe(true);
  });

  it("maps a live spectrum into finite logarithmic bars", () => {
    const frame = new AudioAnalyserProcessor().process(
      fakeAnalyser(-24),
      REFERENCE_SETTINGS,
    );

    expect(frame.hasSignal).toBe(true);
    expect(frame.bars).toHaveLength(64);
    expect(frame.level).toBeGreaterThan(0);
    expect([...frame.bars].every(Number.isFinite)).toBe(true);
    expect(frame.bass).toBeGreaterThan(0);
    expect(frame.mid).toBeGreaterThan(0);
    expect(frame.treble).toBeGreaterThan(0);
  });
});

describe("shared audio feature processing", () => {
  it("uses FFT bins and the AudioContext sample rate to isolate bass energy", () => {
    let bassLoud = false;
    const analyser = {
      frequencyBinCount: 1024,
      context: { sampleRate: 48_000 },
      getFloatFrequencyData(target: Float32Array) {
        target.fill(-100);
        if (!bassLoud) return;
        const nyquist = 24_000;
        const start = Math.floor((30 / nyquist) * target.length);
        const end = Math.ceil((170 / nyquist) * target.length);
        for (let index = start; index <= end; index += 1) target[index] = -18;
      },
    } as unknown as AnalyserNode;
    const processor = new AudioFeatureProcessor();
    processor.process(analyser, MAGNETIC_REFERENCE_SETTINGS, 1000);
    bassLoud = true;
    const frame = processor.process(analyser, MAGNETIC_REFERENCE_SETTINGS, 1050);

    expect(frame.sampleRate).toBe(48_000);
    expect(frame.bass.energy).toBeGreaterThan(frame.mid.energy);
    expect(frame.bass.onset).toBe(true);
    expect(frame.high.energy).toBe(0);
  });

  it("decays toward silence when playback is paused", () => {
    const processor = new AudioFeatureProcessor();
    const loud = fakeAnalyser(-18);
    processor.process(loud, MAGNETIC_REFERENCE_SETTINGS, 1000);
    const live = processor.process(loud, MAGNETIC_REFERENCE_SETTINGS, 1050).level;
    let frame = processor.process(null, MAGNETIC_REFERENCE_SETTINGS, 1150);
    frame = processor.process(null, MAGNETIC_REFERENCE_SETTINGS, 1250);

    expect(frame.level).toBeLessThan(live);
    expect(frame.bass.falling).toBe(true);
  });
});
