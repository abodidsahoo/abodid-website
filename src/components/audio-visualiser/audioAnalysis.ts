import type {
  AudioVisualiserSettings,
  ProcessedAudioFrame,
} from "./types";

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const lerp = (from: number, to: number, amount: number) =>
  from + (to - from) * amount;

const frequencyWeight = (
  frequency: number,
  settings: AudioVisualiserSettings,
) => {
  if (frequency < 180) return settings.bassInfluence;
  if (frequency < 380) {
    return lerp(
      settings.bassInfluence,
      settings.midInfluence,
      (frequency - 180) / 200,
    );
  }
  if (frequency < 3200) return settings.midInfluence;
  if (frequency < 6500) {
    return lerp(
      settings.midInfluence,
      settings.trebleInfluence,
      (frequency - 3200) / 3300,
    );
  }
  return settings.trebleInfluence;
};

export class AudioAnalyserProcessor {
  private frequencyData = new Float32Array(0);
  private bars = new Float32Array(0);
  private silentBars = new Float32Array(0);

  process(
    analyser: AnalyserNode | null,
    settings: AudioVisualiserSettings,
  ): ProcessedAudioFrame {
    const barCount = settings.barCount;
    if (this.bars.length !== barCount) {
      this.bars = new Float32Array(barCount);
      this.silentBars = new Float32Array(barCount);
    }

    if (!analyser) {
      return {
        bars: this.silentBars,
        bass: 0,
        mid: 0,
        treble: 0,
        level: 0,
        hasSignal: false,
      };
    }

    if (this.frequencyData.length !== analyser.frequencyBinCount) {
      this.frequencyData = new Float32Array(analyser.frequencyBinCount);
    }
    analyser.getFloatFrequencyData(this.frequencyData);

    const nyquist = analyser.context.sampleRate / 2;
    const minFrequency = 42;
    const maxFrequency = Math.min(16_000, nyquist * 0.92);
    const logRange = Math.log(maxFrequency / minFrequency);
    let bassSum = 0;
    let bassCount = 0;
    let midSum = 0;
    let midCount = 0;
    let trebleSum = 0;
    let trebleCount = 0;
    let total = 0;

    for (let barIndex = 0; barIndex < barCount; barIndex += 1) {
      const startFrequency =
        minFrequency * Math.exp(logRange * (barIndex / barCount));
      const endFrequency =
        minFrequency * Math.exp(logRange * ((barIndex + 1) / barCount));
      const centerFrequency = Math.sqrt(startFrequency * endFrequency);
      const startBin = Math.max(
        1,
        Math.floor((startFrequency / nyquist) * this.frequencyData.length),
      );
      const endBin = Math.min(
        this.frequencyData.length - 1,
        Math.max(
          startBin,
          Math.ceil((endFrequency / nyquist) * this.frequencyData.length),
        ),
      );

      let power = 0;
      let samples = 0;
      for (let bin = startBin; bin <= endBin; bin += 1) {
        const db = this.frequencyData[bin];
        if (!Number.isFinite(db)) continue;
        power += Math.pow(10, db / 10);
        samples += 1;
      }

      const rmsDb =
        samples > 0 && power > 0
          ? 10 * Math.log10(power / samples)
          : -100;
      const gated = clamp01((rmsDb + 78) / 60);
      const shaped = Math.pow(gated, 1.35);
      const weighted = clamp01(
        shaped *
          settings.sensitivity *
          frequencyWeight(centerFrequency, settings),
      );

      this.bars[barIndex] = weighted;
      total += weighted;

      if (centerFrequency < 250) {
        bassSum += weighted;
        bassCount += 1;
      } else if (centerFrequency < 4000) {
        midSum += weighted;
        midCount += 1;
      } else {
        trebleSum += weighted;
        trebleCount += 1;
      }
    }

    const level = total / Math.max(1, barCount);
    return {
      bars: this.bars,
      bass: bassSum / Math.max(1, bassCount),
      mid: midSum / Math.max(1, midCount),
      treble: trebleSum / Math.max(1, trebleCount),
      level,
      hasSignal: level > 0.008,
    };
  }
}

