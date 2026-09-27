import type {
  AudioFeatureFrame,
  AudioFeatureSettings,
  BandFeature,
} from "./types";

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const HIGH_SPECTRUM_SLICES = 12;

type BandState = BandFeature & {
  armed: boolean;
  lastOnset: number;
};

const createBand = (): BandState => ({
  energy: 0,
  fast: 0,
  slow: 0,
  onset: false,
  falling: false,
  armed: true,
  lastOnset: -Infinity,
});

/**
 * Reads the analyser once and publishes the compact features used by a scene.
 * The same frame object is mutated each tick to avoid per-frame garbage.
 */
export class AudioFeatureProcessor {
  private frequencyData = new Float32Array(0);
  private lastTime = 0;
  private pullSince = 0;
  private releaseSince = 0;
  private readonly frame: AudioFeatureFrame & {
    bass: BandState;
    mid: BandState;
    high: BandState;
  } = {
    bass: createBand(),
    mid: createBand(),
    high: createBand(),
    highSpectrum: new Float32Array(HIGH_SPECTRUM_SLICES),
    level: 0,
    hasSignal: false,
    pullActive: false,
    released: false,
    sampleRate: 0,
  };

  process(
    analyser: AnalyserNode | null,
    settings: AudioFeatureSettings,
    time = performance.now(),
  ): AudioFeatureFrame {
    const deltaSeconds = Math.min(
      0.1,
      Math.max(1 / 240, (time - (this.lastTime || time)) / 1000),
    );
    this.lastTime = time;

    let bassRaw = 0;
    let midRaw = 0;
    let highRaw = 0;
    if (analyser) {
      if (this.frequencyData.length !== analyser.frequencyBinCount) {
        this.frequencyData = new Float32Array(analyser.frequencyBinCount);
      }
      analyser.getFloatFrequencyData(this.frequencyData);
      const sampleRate = analyser.context.sampleRate;
      this.frame.sampleRate = sampleRate;
      bassRaw = this.aggregateBand(30, settings.bassMidCrossover, sampleRate, settings);
      midRaw = this.aggregateBand(
        settings.bassMidCrossover,
        settings.midHighCrossover,
        sampleRate,
        settings,
      );
      highRaw = this.aggregateBand(
        settings.midHighCrossover,
        Math.min(12_000, sampleRate * 0.48),
        sampleRate,
        settings,
      );
    }

    this.updateBand(this.frame.bass, bassRaw * settings.bassSensitivity, deltaSeconds, time, settings);
    this.updateBand(this.frame.mid, midRaw * settings.midSensitivity, deltaSeconds, time, settings);
    this.updateBand(this.frame.high, highRaw * settings.highSensitivity, deltaSeconds, time, settings);
    this.updateHighSpectrum(Boolean(analyser), settings, deltaSeconds);

    this.frame.level =
      this.frame.bass.energy * 0.36 +
      this.frame.mid.energy * 0.42 +
      this.frame.high.energy * 0.22;
    this.frame.hasSignal = this.frame.level > 0.008;
    this.frame.released = false;
    this.updatePullState(time, settings);
    return this.frame;
  }

  private aggregateBand(
    low: number,
    high: number,
    sampleRate: number,
    settings: AudioFeatureSettings,
  ) {
    const nyquist = sampleRate / 2;
    const safeLow = Math.max(1, low);
    const safeHigh = Math.max(safeLow + 1, Math.min(high, nyquist * 0.98));
    // Equal logarithmic slices prevent the physically wider treble range from
    // dominating simply because it owns many more linear FFT bins.
    const sliceCount = Math.min(
      16,
      Math.max(4, Math.round(Math.log2(safeHigh / safeLow) * 4)),
    );
    const logRange = Math.log(safeHigh / safeLow);
    let aggregate = 0;
    let validSlices = 0;
    for (let slice = 0; slice < sliceCount; slice += 1) {
      const sliceLow = safeLow * Math.exp(logRange * (slice / sliceCount));
      const sliceHigh = safeLow * Math.exp(logRange * ((slice + 1) / sliceCount));
      const start = Math.max(1, Math.floor((sliceLow / nyquist) * this.frequencyData.length));
      const end = Math.min(
        this.frequencyData.length - 1,
        Math.max(start, Math.ceil((sliceHigh / nyquist) * this.frequencyData.length)),
      );
      let power = 0;
      let peak = 0;
      let count = 0;
      for (let bin = start; bin <= end; bin += 1) {
        const db = this.frequencyData[bin];
        if (!Number.isFinite(db)) continue;
        const samplePower = Math.pow(10, db / 10);
        power += samplePower;
        peak = Math.max(peak, samplePower);
        count += 1;
      }
      if (!count || power <= 0) continue;
      const robustPower = power / count * 0.82 + peak * 0.18;
      const db = 10 * Math.log10(robustPower);
      const normalised = clamp01((db - settings.noiseFloor) / (0 - settings.noiseFloor));
      aggregate += Math.pow(normalised, 1.45);
      validSlices += 1;
    }
    return clamp01(aggregate / Math.max(1, validSlices) * settings.normalisation);
  }

  private updateHighSpectrum(
    hasAnalyser: boolean,
    settings: AudioFeatureSettings,
    deltaSeconds: number,
  ) {
    const sampleRate = this.frame.sampleRate || 48_000;
    const low = Math.max(1, settings.midHighCrossover);
    const high = Math.min(12_000, sampleRate * 0.48);
    const logRange = Math.log(high / low);

    for (let index = 0; index < HIGH_SPECTRUM_SLICES; index += 1) {
      const sliceLow = low * Math.exp(logRange * (index / HIGH_SPECTRUM_SLICES));
      const sliceHigh = low * Math.exp(logRange * ((index + 1) / HIGH_SPECTRUM_SLICES));
      const target = hasAnalyser
        ? clamp01(
            this.aggregateBand(sliceLow, sliceHigh, sampleRate, settings) *
            settings.highSensitivity,
          )
        : 0;
      const current = this.frame.highSpectrum[index];
      // Guitar harmonics and pick noise need an almost immediate visual attack,
      // followed by enough release time for each pulled-string peak to read.
      const response = target > current ? 0.008 : 0.14;
      this.frame.highSpectrum[index] +=
        (target - current) * (1 - Math.exp(-deltaSeconds / response));
    }
  }

  private updateBand(
    band: BandState,
    raw: number,
    deltaSeconds: number,
    time: number,
    settings: AudioFeatureSettings,
  ) {
    const target = clamp01(raw);
    const attack = Math.max(0.001, settings.apertureAttackMs / 1000);
    const release = Math.max(0.001, settings.apertureReleaseMs / 1000);
    const response = target > band.energy ? attack : release;
    band.energy += (target - band.energy) * (1 - Math.exp(-deltaSeconds / response));
    band.fast += (target - band.fast) * (1 - Math.exp(-deltaSeconds / 0.035));
    band.slow += (target - band.slow) * (1 - Math.exp(-deltaSeconds / 0.18));
    const diff = band.fast - band.slow;
    const normalizedNovelty = diff / Math.max(0.06, band.slow * 0.6);
    const isCooldownOver = time - band.lastOnset >= settings.onsetCooldownMs;
    band.onset = false;
    if (
      band.armed &&
      (diff > settings.onsetThreshold || normalizedNovelty > 0.38) &&
      isCooldownOver
    ) {
      band.onset = true;
      band.armed = false;
      band.lastOnset = time;
    } else if (diff < settings.onsetThreshold * 0.3 || (isCooldownOver && band.fast < band.slow * 1.05)) {
      band.armed = true;
    }
    band.falling = band.energy > 0.05 && target < band.energy * 0.68;
  }

  private updatePullState(time: number, settings: AudioFeatureSettings) {
    const bass = this.frame.bass.energy;
    if (!this.frame.pullActive) {
      this.releaseSince = 0;
      if (bass >= settings.pullThreshold) {
        this.pullSince ||= time;
        if (time - this.pullSince >= settings.dwellMs) this.frame.pullActive = true;
      } else {
        this.pullSince = 0;
      }
      return;
    }

    this.pullSince = 0;
    if (bass <= settings.releaseThreshold) {
      this.releaseSince ||= time;
      if (time - this.releaseSince >= settings.dwellMs) {
        this.frame.pullActive = false;
        this.frame.released = true;
        this.releaseSince = 0;
      }
    } else {
      this.releaseSince = 0;
    }
  }
}
