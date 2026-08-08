export type ScratchDirection = 1 | -1;

export type ScratchSoundName =
    | "scratch-short"
    | "scratch-medium"
    | "scratch-long"
    | "scratch-fast"
    | "scratch-backspin"
    | "vinyl-stop";

export type ScratchTrigger = {
    velocity: number;
    direction: ScratchDirection;
    gestureDuration: number;
    nowMs?: number;
};

export type ScratchAudioDebugState = {
    ready: boolean;
    selectedSound: ScratchSoundName | "silent";
    playbackRate: number;
    activeVoices: number;
};

export const SCRATCH_AUDIO_TUNING = {
    minimumVelocity: 0.14,
    slowVelocity: 1.8,
    mediumVelocity: 4.5,
    fastVelocity: 8.5,
    backspinVelocity: 6.5,
    cooldownMs: {
        slow: 108,
        medium: 74,
        fast: 46,
        backspin: 260,
        stop: 520,
    },
    playbackRateVariation: 0.05,
    gainVariation: 0.04,
    maxActiveVoices: 4,
    attackSeconds: 0.004,
    releaseSeconds: 0.035,
    masterGain: 0.15,
} as const;

const SCRATCH_ASSETS: Record<ScratchSoundName, string> = {
    "scratch-short": "/audio/dj-scratch/scratch-short.wav",
    "scratch-medium": "/audio/dj-scratch/scratch-medium.wav",
    "scratch-long": "/audio/dj-scratch/scratch-long.wav",
    "scratch-fast": "/audio/dj-scratch/scratch-fast.wav",
    "scratch-backspin": "/audio/dj-scratch/scratch-backspin.wav",
    "vinyl-stop": "/audio/dj-scratch/vinyl-stop.wav",
};

type CachedBuffer = {
    normal: AudioBuffer;
    reversed: AudioBuffer;
};

type ActiveVoice = {
    source: AudioBufferSourceNode;
    gain: GainNode;
    startedAt: number;
};

type AudioContextWindow = Window &
    typeof globalThis & { webkitAudioContext?: typeof AudioContext };

const clamp = (value: number, minimum: number, maximum: number) =>
    Math.min(Math.max(value, minimum), maximum);

const randomAround = (amount: number) => 1 + (Math.random() * 2 - 1) * amount;

export class ScratchAudioEngine {
    private context: AudioContext | null = null;
    private masterGain: GainNode | null = null;
    private highpass: BiquadFilterNode | null = null;
    private lowpass: BiquadFilterNode | null = null;
    private loadPromise: Promise<void> | null = null;
    private buffers = new Map<ScratchSoundName, CachedBuffer>();
    private voices: ActiveVoice[] = [];
    private lastTriggerAt = -Infinity;
    private lastBackspinAt = -Infinity;
    private lastStopAt = -Infinity;
    private lastDirection: ScratchDirection = 1;
    private lastSound: ScratchSoundName | "silent" = "silent";
    private muted = false;
    private debugState: ScratchAudioDebugState = {
        ready: false,
        selectedSound: "silent",
        playbackRate: 1,
        activeVoices: 0,
    };

    async init() {
        const context = await this.ensureContext();
        if (!context) return;
        if (!this.loadPromise) this.loadPromise = this.loadBuffers(context);
        await this.loadPromise;
    }

    async resume() {
        const context = await this.ensureContext();
        if (context?.state === "suspended") await context.resume();
    }

    setMuted(muted: boolean) {
        this.muted = muted;
        if (!this.context || !this.masterGain) return;
        const now = this.context.currentTime;
        this.masterGain.gain.cancelScheduledValues(now);
        this.masterGain.gain.setTargetAtTime(
            muted ? 0.0001 : SCRATCH_AUDIO_TUNING.masterGain,
            now,
            0.012,
        );
    }

    trigger({ velocity, direction, gestureDuration, nowMs = performance.now() }: ScratchTrigger) {
        const speed = Math.abs(velocity);
        if (speed < SCRATCH_AUDIO_TUNING.minimumVelocity || !this.context) {
            this.debugState.selectedSound = "silent";
            return false;
        }

        const sound = this.selectSound(speed, gestureDuration);
        const cooldown = this.cooldownFor(speed);
        const changedDirection = direction !== this.lastDirection;
        const upgradedIntensity = this.soundIntensity(sound) > this.soundIntensity(this.lastSound);
        const effectiveCooldown = changedDirection || upgradedIntensity
            ? cooldown * 0.46
            : cooldown;

        if (nowMs - this.lastTriggerAt < effectiveCooldown) return false;

        const playbackRate = this.playbackRateFor(speed) *
            randomAround(SCRATCH_AUDIO_TUNING.playbackRateVariation);
        const gain = clamp(0.34 + speed / 24, 0.36, 0.68) *
            randomAround(SCRATCH_AUDIO_TUNING.gainVariation);

        const played = this.playVoice(sound, {
            direction,
            playbackRate,
            gain,
            varyOffset: true,
        });

        if (played) {
            this.lastTriggerAt = nowMs;
            this.lastDirection = direction;
            this.lastSound = sound;
        }

        return played;
    }

    backspin({ velocity, direction, nowMs = performance.now() }: Omit<ScratchTrigger, "gestureDuration">) {
        const speed = Math.abs(velocity);
        if (
            speed < SCRATCH_AUDIO_TUNING.backspinVelocity ||
            nowMs - this.lastBackspinAt < SCRATCH_AUDIO_TUNING.cooldownMs.backspin
        ) {
            return false;
        }

        const played = this.playVoice("scratch-backspin", {
            direction,
            playbackRate: clamp(0.86 + speed / 36, 0.9, 1.28) * randomAround(0.035),
            gain: 0.48 * randomAround(0.035),
            varyOffset: false,
        });
        if (played) this.lastBackspinAt = nowMs;
        return played;
    }

    stopEffect(nowMs = performance.now()) {
        if (nowMs - this.lastStopAt < SCRATCH_AUDIO_TUNING.cooldownMs.stop) return false;
        const played = this.playVoice("vinyl-stop", {
            direction: 1,
            playbackRate: randomAround(0.025),
            gain: 0.42,
            varyOffset: false,
        });
        if (played) this.lastStopAt = nowMs;
        return played;
    }

    getDebugState(): ScratchAudioDebugState {
        return {
            ...this.debugState,
            activeVoices: this.voices.length,
        };
    }

    destroy() {
        for (const voice of [...this.voices]) this.fadeAndStop(voice);
        this.voices = [];
        this.buffers.clear();
        if (this.context && this.context.state !== "closed") void this.context.close();
        this.context = null;
        this.masterGain = null;
        this.highpass = null;
        this.lowpass = null;
        this.loadPromise = null;
    }

    private async ensureContext() {
        if (!this.context) {
            const AudioContextClass =
                window.AudioContext || (window as AudioContextWindow).webkitAudioContext;
            if (!AudioContextClass) return null;

            this.context = new AudioContextClass({ latencyHint: "interactive" });
            this.masterGain = this.context.createGain();
            this.highpass = this.context.createBiquadFilter();
            this.lowpass = this.context.createBiquadFilter();

            this.highpass.type = "highpass";
            this.highpass.frequency.value = 82;
            this.highpass.Q.value = 0.55;
            this.lowpass.type = "lowpass";
            this.lowpass.frequency.value = 9200;
            this.lowpass.Q.value = 0.35;
            this.masterGain.gain.value = this.muted
                ? 0.0001
                : SCRATCH_AUDIO_TUNING.masterGain;
            this.masterGain
                .connect(this.highpass)
                .connect(this.lowpass)
                .connect(this.context.destination);
        }

        if (this.context.state === "suspended") await this.context.resume();
        return this.context;
    }

    private async loadBuffers(context: AudioContext) {
        const entries = Object.entries(SCRATCH_ASSETS) as Array<[ScratchSoundName, string]>;
        const results = await Promise.allSettled(
            entries.map(async ([name, url]) => {
                const response = await fetch(url, { cache: "force-cache" });
                if (!response.ok) throw new Error(`${url} returned ${response.status}`);
                const normal = await context.decodeAudioData(await response.arrayBuffer());
                this.buffers.set(name, {
                    normal,
                    reversed: this.reverseBuffer(context, normal),
                });
            }),
        );

        const failures = results.filter((result) => result.status === "rejected");
        this.debugState.ready = this.buffers.size > 0;
        if (failures.length && this.buffers.size === 0) {
            console.warn("Scratch samples could not be loaded; visual scratching remains available.");
        }
    }

    private reverseBuffer(context: AudioContext, source: AudioBuffer) {
        const reversed = context.createBuffer(
            source.numberOfChannels,
            source.length,
            source.sampleRate,
        );
        for (let channel = 0; channel < source.numberOfChannels; channel += 1) {
            const input = source.getChannelData(channel);
            const output = reversed.getChannelData(channel);
            for (let index = 0, end = input.length - 1; index < input.length; index += 1) {
                output[end - index] = input[index];
            }
        }
        return reversed;
    }

    private selectSound(speed: number, gestureDuration: number): ScratchSoundName {
        if (speed < 0.62 && gestureDuration < 240) return "scratch-short";
        if (speed < SCRATCH_AUDIO_TUNING.slowVelocity) return "scratch-long";
        if (speed < SCRATCH_AUDIO_TUNING.mediumVelocity) return "scratch-medium";
        if (speed < SCRATCH_AUDIO_TUNING.fastVelocity) return "scratch-fast";
        return "scratch-fast";
    }

    private cooldownFor(speed: number) {
        if (speed < SCRATCH_AUDIO_TUNING.slowVelocity) {
            return SCRATCH_AUDIO_TUNING.cooldownMs.slow;
        }
        if (speed < SCRATCH_AUDIO_TUNING.mediumVelocity) {
            return SCRATCH_AUDIO_TUNING.cooldownMs.medium;
        }
        return SCRATCH_AUDIO_TUNING.cooldownMs.fast;
    }

    private soundIntensity(sound: ScratchSoundName | "silent") {
        if (sound === "scratch-fast" || sound === "scratch-backspin") return 2;
        if (sound === "scratch-medium") return 1;
        return 0;
    }

    private playbackRateFor(speed: number) {
        if (speed < SCRATCH_AUDIO_TUNING.slowVelocity) {
            return clamp(0.78 + speed * 0.09, 0.78, 0.95);
        }
        if (speed < SCRATCH_AUDIO_TUNING.mediumVelocity) {
            return clamp(0.9 + (speed - SCRATCH_AUDIO_TUNING.slowVelocity) * 0.09, 0.9, 1.15);
        }
        return clamp(1.1 + (speed - SCRATCH_AUDIO_TUNING.mediumVelocity) * 0.045, 1.1, 1.5);
    }

    private playVoice(
        name: ScratchSoundName,
        options: {
            direction: ScratchDirection;
            playbackRate: number;
            gain: number;
            varyOffset: boolean;
        },
    ) {
        if (!this.context || !this.masterGain) return false;
        const cached = this.buffers.get(name);
        if (!cached) return false;

        while (this.voices.length >= SCRATCH_AUDIO_TUNING.maxActiveVoices) {
            const oldest = this.voices.shift();
            if (oldest) this.fadeAndStop(oldest);
        }

        const context = this.context;
        const now = context.currentTime;
        const buffer = options.direction < 0 ? cached.reversed : cached.normal;
        const source = context.createBufferSource();
        const gain = context.createGain();
        const maximumOffset = Math.min(0.018, buffer.duration * 0.08);
        const offset = options.varyOffset ? Math.random() * maximumOffset : 0;
        const audibleDuration = Math.max(
            0.025,
            (buffer.duration - offset) / options.playbackRate,
        );
        const releaseStart = Math.max(
            now + SCRATCH_AUDIO_TUNING.attackSeconds + 0.008,
            now + audibleDuration - SCRATCH_AUDIO_TUNING.releaseSeconds,
        );

        source.buffer = buffer;
        source.playbackRate.value = options.playbackRate;
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(
            Math.max(0.0002, options.gain),
            now + SCRATCH_AUDIO_TUNING.attackSeconds,
        );
        gain.gain.setValueAtTime(Math.max(0.0002, options.gain), releaseStart);
        gain.gain.exponentialRampToValueAtTime(
            0.0001,
            releaseStart + SCRATCH_AUDIO_TUNING.releaseSeconds,
        );
        source.connect(gain).connect(this.masterGain);

        const voice: ActiveVoice = { source, gain, startedAt: now };
        this.voices.push(voice);
        source.onended = () => {
            const index = this.voices.indexOf(voice);
            if (index >= 0) this.voices.splice(index, 1);
            source.disconnect();
            gain.disconnect();
        };
        source.start(now, offset);

        this.debugState = {
            ready: true,
            selectedSound: name,
            playbackRate: options.playbackRate,
            activeVoices: this.voices.length,
        };
        return true;
    }

    private fadeAndStop(voice: ActiveVoice) {
        if (!this.context) return;
        const now = this.context.currentTime;
        try {
            voice.gain.gain.cancelScheduledValues(now);
            voice.gain.gain.setTargetAtTime(0.0001, now, 0.008);
            voice.source.stop(now + 0.04);
        } catch {
            // The source may already have ended. Its onended handler will clean up.
        }
    }
}
