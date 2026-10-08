export type AudioSourceKind = "none" | "local" | "microphone" | "tab";

export type AudioSourceSnapshot = {
  kind: AudioSourceKind;
  label: string;
  isPlaying: boolean;
  hasAudioTrack: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  contextState: AudioContextState | "not-started";
};

export type MagneticPalette = "ultraviolet" | "aurora" | "ember" | "crimson-white";
export type MagneticParticleShape = "dash" | "pill" | "diamond" | "circle";
export type MagneticBackdropTheme = "purple-red" | "green-blue" | "earth-brown" | "deep-dark";

export type MagneticApertureSettings = {
  particleShape: MagneticParticleShape;
  overallReaction: number;
  bassPull: number;
  gravityPull: number;
  burstStrength: number;
  rotationSpeed: number;
  rotationDirection: -1 | 1;
  circleSize: number;
  deformation: number;
  fieldSpread: number;
  pieceCount: number;
  pieceLength: number;
  pieceWidth: number;
  glow: number;
  hueShift: number;
  palette: MagneticPalette;
  backdropTheme: MagneticBackdropTheme;
  backdropIntensity: number;
  bassBloom: number;
  bassWave: number;
  spectralDetail: number;
  backdropVisible: boolean;
  bassVisible: boolean;
  bassReactive: boolean;
  midVisible: boolean;
  midReactive: boolean;
  highVisible: boolean;
  highReactive: boolean;
  bassMidCrossover: number;
  midHighCrossover: number;
  bassSensitivity: number;
  midSensitivity: number;
  highSensitivity: number;
  noiseFloor: number;
  normalisation: number;
  onsetThreshold: number;
  onsetCooldownMs: number;
  apertureMinRadius: number;
  apertureBassAmount: number;
  rimWidth: number;
  rimGlow: number;
  contourScale: number;
  contourDepth: number;
  contourVisible: boolean;
  contourRings: number;
  contourDeformation: number;
  apertureAttackMs: number;
  apertureReleaseMs: number;
  attraction: number;
  softness: number;
  tangentForce: number;
  homeRestore: number;
  eccentricity: number;
  petalCount: number;
  ringCount: number;
  seedJitter: number;
  burstRadial: number;
  burstAngular: number;
  linearDrag: number;
  angularDrag: number;
  maxVelocity: number;
  maxAcceleration: number;
  pullThreshold: number;
  releaseThreshold: number;
  dwellMs: number;
  sizeVariation: number;
  density: number;
  opacity: number;
  depth: number;
  backgroundHue: number;
  bassHue: number;
  midHue: number;
  highHue: number;
  saturation: number;
  brightness: number;
  zoom: number;
  centerX: number;
  centerY: number;
  guides: boolean;
  diagnostics: boolean;
};

export type AudioFeatureSettings = Pick<
  MagneticApertureSettings,
  | "bassMidCrossover"
  | "midHighCrossover"
  | "bassSensitivity"
  | "midSensitivity"
  | "highSensitivity"
  | "noiseFloor"
  | "normalisation"
  | "onsetThreshold"
  | "onsetCooldownMs"
  | "apertureAttackMs"
  | "apertureReleaseMs"
  | "pullThreshold"
  | "releaseThreshold"
  | "dwellMs"
>;

export type BandFeature = {
  energy: number;
  fast: number;
  slow: number;
  transient: number;
  onset: boolean;
  falling: boolean;
};

export type AudioFeatureFrame = {
  bass: BandFeature;
  mid: BandFeature;
  high: BandFeature;
  spectrum: Float32Array;
  spectralCentroid: number;
  spectralFlatness: number;
  spectralFlux: number;
  level: number;
  hasSignal: boolean;
  pullActive: boolean;
  released: boolean;
  sampleRate: number;
};

export type MagneticDiagnostics = {
  bass: number;
  mid: number;
  high: number;
  bassOnset: boolean;
  midOnset: boolean;
  highOnset: boolean;
  centroid: number;
  texture: number;
  pullActive: boolean;
  released: boolean;
  particles: number;
  fps: number;
  frameTime: number;
  renderer: string;
};
