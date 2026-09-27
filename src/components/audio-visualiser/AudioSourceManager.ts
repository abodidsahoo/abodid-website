import type { AudioSourceSnapshot } from "./types";

type SnapshotListener = (snapshot: AudioSourceSnapshot) => void;
type MessageListener = (message: string) => void;

const INITIAL_SNAPSHOT: AudioSourceSnapshot = {
  kind: "none",
  label: "No source selected",
  isPlaying: false,
  hasAudioTrack: false,
  currentTime: 0,
  duration: 0,
  volume: 0.8,
  contextState: "not-started",
};

export class AudioSourceManager {
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private localNode: MediaElementAudioSourceNode | null = null;
  private captureNode: MediaStreamAudioSourceNode | null = null;
  private captureStream: MediaStream | null = null;
  private objectUrl: string | null = null;
  private snapshot: AudioSourceSnapshot = { ...INITIAL_SNAPSHOT };
  private readonly audio = new Audio();

  constructor(
    private readonly onSnapshot: SnapshotListener,
    private readonly onMessage: MessageListener,
  ) {
    this.audio.preload = "metadata";
    this.audio.volume = INITIAL_SNAPSHOT.volume;
    this.audio.addEventListener("play", this.handleMediaUpdate);
    this.audio.addEventListener("pause", this.handleMediaUpdate);
    this.audio.addEventListener("timeupdate", this.handleMediaUpdate);
    this.audio.addEventListener("durationchange", this.handleMediaUpdate);
    this.audio.addEventListener("volumechange", this.handleMediaUpdate);
    this.audio.addEventListener("ended", this.handleMediaUpdate);
  }

  getAnalyser = () => this.analyser;

  getSnapshot = () => this.snapshot;

  private ensureGraph() {
    if (this.audioContext && this.analyser) return;

    const AudioContextClass = window.AudioContext ||
      (window as typeof window & { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioContextClass) {
      throw new Error("Web Audio is not supported in this browser.");
    }

    this.audioContext = new AudioContextClass();
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.minDecibels = -90;
    this.analyser.maxDecibels = -10;
    this.analyser.smoothingTimeConstant = 0;

    this.localNode = this.audioContext.createMediaElementSource(this.audio);
    this.updateSnapshot({ contextState: this.audioContext.state });
    this.audioContext.addEventListener("statechange", this.handleContextState);
  }

  private resumeContext = async () => {
    this.ensureGraph();
    if (this.audioContext?.state === "suspended") {
      await this.audioContext.resume();
    }
  };

  private disconnectActiveNode() {
    this.localNode?.disconnect();
    this.captureNode?.disconnect();
    this.captureNode = null;
  }

  private stopCaptureTracks() {
    if (!this.captureStream) return;
    this.captureStream.getTracks().forEach((track) => {
      track.onended = null;
      track.stop();
    });
    this.captureStream = null;
  }

  private updateSnapshot(patch: Partial<AudioSourceSnapshot>) {
    this.snapshot = { ...this.snapshot, ...patch };
    this.onSnapshot(this.snapshot);
  }

  private handleContextState = () => {
    this.updateSnapshot({
      contextState: this.audioContext?.state || "not-started",
    });
  };

  private handleMediaUpdate = () => {
    if (this.snapshot.kind !== "local") return;
    this.updateSnapshot({
      isPlaying: !this.audio.paused && !this.audio.ended,
      currentTime: Number.isFinite(this.audio.currentTime)
        ? this.audio.currentTime
        : 0,
      duration: Number.isFinite(this.audio.duration) ? this.audio.duration : 0,
      volume: this.audio.volume,
    });
  };

  loadLocalFile = async (file: File) => {
    if (!file.type.startsWith("audio/")) {
      throw new Error("Choose an audio file supported by your browser.");
    }

    await this.resumeContext();
    this.stopCaptureTracks();
    this.disconnectActiveNode();
    this.audio.pause();

    if (this.objectUrl) URL.revokeObjectURL(this.objectUrl);
    this.objectUrl = URL.createObjectURL(file);
    this.audio.src = this.objectUrl;
    this.audio.load();

    this.localNode?.connect(this.analyser!);
    this.localNode?.connect(this.audioContext!.destination);
    this.updateSnapshot({
      kind: "local",
      label: file.name,
      isPlaying: false,
      hasAudioTrack: true,
      currentTime: 0,
      duration: 0,
    });
    this.onMessage("Local file ready. Press play to begin.");
  };

  toggleLocalPlayback = async () => {
    if (this.snapshot.kind !== "local") return;
    await this.resumeContext();
    if (this.audio.paused) {
      await this.audio.play();
    } else {
      this.audio.pause();
    }
  };

  seekLocal = (time: number) => {
    if (this.snapshot.kind !== "local" || !Number.isFinite(time)) return;
    this.audio.currentTime = Math.min(
      Math.max(0, time),
      Number.isFinite(this.audio.duration) ? this.audio.duration : time,
    );
    this.handleMediaUpdate();
  };

  setVolume = (volume: number) => {
    this.audio.volume = Math.min(1, Math.max(0, volume));
    this.handleMediaUpdate();
  };

  captureTab = async () => {
    if (!navigator.mediaDevices?.getDisplayMedia) {
      throw new Error("Tab audio capture is not supported in this browser.");
    }

    await this.resumeContext();
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: true,
      preferCurrentTab: false,
      selfBrowserSurface: "exclude",
      surfaceSwitching: "include",
      systemAudio: "exclude",
    } as DisplayMediaStreamOptions);

    const audioTrack = stream.getAudioTracks()[0];
    if (!audioTrack) {
      stream.getTracks().forEach((track) => track.stop());
      this.onMessage(
        "No audio track was shared. In Chrome, choose a tab and enable “Share tab audio”, then try again.",
      );
      throw new Error("The selected source did not provide an audio track.");
    }

    this.audio.pause();
    this.stopCaptureTracks();
    this.disconnectActiveNode();
    this.captureStream = stream;
    this.captureNode = this.audioContext!.createMediaStreamSource(stream);
    this.captureNode.connect(this.analyser!);
    audioTrack.onended = this.handleCaptureEnded;

    this.updateSnapshot({
      kind: "tab",
      label: audioTrack.label || "Shared Chrome tab",
      isPlaying: true,
      hasAudioTrack: true,
      currentTime: 0,
      duration: 0,
    });
    this.onMessage(
      "Tab audio is being analysed. Keep the shared tab playing for a visible response.",
    );
  };

  private handleCaptureEnded = () => {
    this.stopCapture("Tab capture ended.");
  };

  stopCapture = (message = "Tab capture stopped.") => {
    if (this.snapshot.kind !== "tab" && !this.captureStream) return;
    this.captureNode?.disconnect();
    this.captureNode = null;
    this.stopCaptureTracks();
    this.updateSnapshot({
      kind: "none",
      label: "No source selected",
      isPlaying: false,
      hasAudioTrack: false,
    });
    this.onMessage(message);
  };

  destroy = async () => {
    this.audio.pause();
    this.disconnectActiveNode();
    this.stopCaptureTracks();
    this.audio.removeAttribute("src");
    this.audio.load();
    if (this.objectUrl) URL.revokeObjectURL(this.objectUrl);
    this.objectUrl = null;
    if (this.audioContext) {
      this.audioContext.removeEventListener("statechange", this.handleContextState);
      if (this.audioContext.state !== "closed") await this.audioContext.close();
    }
    this.audio.removeEventListener("play", this.handleMediaUpdate);
    this.audio.removeEventListener("pause", this.handleMediaUpdate);
    this.audio.removeEventListener("timeupdate", this.handleMediaUpdate);
    this.audio.removeEventListener("durationchange", this.handleMediaUpdate);
    this.audio.removeEventListener("volumechange", this.handleMediaUpdate);
    this.audio.removeEventListener("ended", this.handleMediaUpdate);
  };
}

