import { describe, expect, it } from "vitest";
import { AudioFeatureProcessor } from "../AudioFeatureProcessor";
import {
  MAGNETIC_REFERENCE_SETTINGS,
  mapGravityPullToPhysics,
  patchMagneticSettings,
  sanitiseMagneticSettings,
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
  it("uses a stronger gravity pull as the Magnetic Aperture default", () => {
    expect(MAGNETIC_REFERENCE_SETTINGS.gravityPull).toBe(1.35);
    expect(mapGravityPullToPhysics(MAGNETIC_REFERENCE_SETTINGS.gravityPull)).toBeCloseTo(2.8);
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

  it("maps the 0–3 gravity control to a stronger 1–5 physics range", () => {
    expect(mapGravityPullToPhysics(0)).toBe(1);
    expect(mapGravityPullToPhysics(1.5)).toBe(3);
    expect(mapGravityPullToPhysics(3)).toBe(5);
    expect(mapGravityPullToPhysics(-1)).toBe(1);
    expect(mapGravityPullToPhysics(4)).toBe(5);
  });

  it("keeps Basic, Advanced, and Hyper changes in one shared preset", () => {
    let settings = { ...MAGNETIC_REFERENCE_SETTINGS };
    settings = patchMagneticSettings(settings, "overallReaction", 1.8);
    settings = patchMagneticSettings(settings, "gravityPull", 1.65);
    settings = patchMagneticSettings(settings, "noiseFloor", -84);

    expect(settings).toMatchObject({
      overallReaction: 1.8,
      gravityPull: 1.65,
      noiseFloor: -84,
    });
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
    expect(frame.bass.transient).toBeGreaterThan(0);
    expect(frame.high.energy).toBe(0);
    expect(frame.spectrum).toHaveLength(24);
    expect([...frame.spectrum].some((value) => value > 0)).toBe(true);
    expect(frame.spectralCentroid).toBeGreaterThanOrEqual(0);
    expect(frame.spectralCentroid).toBeLessThanOrEqual(1);
    expect(frame.spectralFlatness).toBeGreaterThanOrEqual(0);
    expect(frame.spectralFlatness).toBeLessThanOrEqual(1);
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
