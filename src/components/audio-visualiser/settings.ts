import type {
  MagneticApertureSettings,
  MagneticPalette,
  MagneticParticleShape,
} from "./types";

export const MAGNETIC_SETTINGS_STORAGE_KEY =
  "audio-visualiser:magnetic-aperture:v12";
const LEGACY_MAGNETIC_SETTINGS_STORAGE_KEY =
  "audio-visualiser:magnetic-aperture:v11";

const GRAVITY_CONTROL_MIN = 0;
const GRAVITY_CONTROL_MAX = 3;
const GRAVITY_PHYSICS_MIN = 1;
const GRAVITY_PHYSICS_MAX = 5;

/** Maps the user-facing 0–3 gravity control to the stronger 1–5 physics range. */
export const mapGravityPullToPhysics = (gravityPull: number) => {
  const controlValue = Math.min(
    GRAVITY_CONTROL_MAX,
    Math.max(GRAVITY_CONTROL_MIN, gravityPull),
  );
  const progress =
    (controlValue - GRAVITY_CONTROL_MIN) /
    (GRAVITY_CONTROL_MAX - GRAVITY_CONTROL_MIN);
  return GRAVITY_PHYSICS_MIN + progress * (GRAVITY_PHYSICS_MAX - GRAVITY_PHYSICS_MIN);
};

export const MAGNETIC_REFERENCE_SETTINGS: MagneticApertureSettings = {
  particleShape: "circle",
  // Overall reactivity — calibrated so initial sweet spot spans entire 0.1–2.0 slider
  overallReaction: 1.0,
  bassPull: 1.2,
  // Gravity pull: strength of the magnetic inward pull toward center
  gravityPull: 1.35,
  // Burst strength: magnetic repulsion outward on drum beats
  burstStrength: 1.0,
  rotationSpeed: 0.24,
  rotationDirection: 1,
  circleSize: 0.19,
  deformation: 0.52,
  fieldSpread: 0.94,
  pieceCount: 760,
  pieceLength: 1.05,
  pieceWidth: 0.82,
  glow: 0.34,
  hueShift: 0,
  palette: "ultraviolet",
  // Aurora Backdrop
  backdropTheme: "purple-red",
  backdropIntensity: 0.65,
  // Impact layer: a low-frequency flash at the core and a travelling pressure wave.
  bassBloom: 1.25,
  bassWave: 0.9,
  // How strongly the perceptual spectrum sculpts the central contour edge.
  spectralDetail: 1.0,
  backdropVisible: true,
  bassVisible: true,
  bassReactive: true,
  midVisible: true,
  midReactive: true,
  highVisible: true,
  highReactive: true,
  bassMidCrossover: 180,
  midHighCrossover: 2500,
  // Per-band sensitivity (Lows, Mids, Highs)
  bassSensitivity: 1.0,
  midSensitivity: 1.0,
  highSensitivity: 1.2,
  noiseFloor: -72,
  normalisation: 1.2,
  // Lower onset threshold = fires more readily on transients
  onsetThreshold: 0.07,
  onsetCooldownMs: 140,
  apertureMinRadius: 0.115,
  apertureBassAmount: -0.3,
  rimWidth: 0.012,
  rimGlow: 0.42,
  contourScale: 1,
  contourDepth: 0.09,
  // Central Amoeba Contours & Black Hole
  contourVisible: true,
  contourRings: 5,
  contourDeformation: 1.0,
  // Fast attack + moderate release = snappy pop, visible sustain
  apertureAttackMs: 10,
  apertureReleaseMs: 130,
  attraction: 1.0,
  softness: 0.11,
  tangentForce: 0.65,
  // Lower homeRestore: formation pull doesn't fight burst during music
  homeRestore: 0.55,
  eccentricity: 0.74,
  petalCount: 5,
  ringCount: 5,
  seedJitter: 0.58,
  burstRadial: 1.0,
  burstAngular: 0.65,
  // Drag is handled internally in renderer — these are legacy no-ops kept for compat
  linearDrag: 1.25,
  angularDrag: 1.75,
  maxVelocity: 1.1,
  maxAcceleration: 3.5,
  pullThreshold: 0.12,
  releaseThreshold: 0.06,
  dwellMs: 55,
  sizeVariation: 0.65,
  density: 1,
  opacity: 0.78,
  depth: 0.66,
  backgroundHue: 225,
  bassHue: 288,
  midHue: 198,
  highHue: 48,
  saturation: 0.92,
  brightness: 1.1,
  zoom: 1,
  centerX: 0,
  centerY: 0,
  guides: false,
  diagnostics: false,
};

const magneticBounds: Partial<
  Record<keyof MagneticApertureSettings, [number, number]>
> = {
  overallReaction: [0, 2], bassPull: [0, 2.5], gravityPull: [0, 3], burstStrength: [0, 2.5],
  rotationSpeed: [0, 1.5], circleSize: [0.1, 0.34], deformation: [0, 1],
  fieldSpread: [0.55, 1.55], pieceCount: [120, 1200], pieceLength: [0.35, 2.2],
  pieceWidth: [0.4, 2], glow: [0, 1], hueShift: [-120, 120],
  bassMidCrossover: [90, 420], midHighCrossover: [900, 7000],
  bassSensitivity: [0, 2.5], midSensitivity: [0, 2.5], highSensitivity: [0, 2.5],
  noiseFloor: [-96, -42], normalisation: [0.4, 2.5], onsetThreshold: [0.04, 0.5],
  onsetCooldownMs: [60, 700], apertureMinRadius: [0.05, 0.24], rimWidth: [0.002, 0.035],
  apertureBassAmount: [-0.5, 0.5], rimGlow: [0, 1],
  contourScale: [0.3, 2], contourDepth: [0, 0.24],
  contourRings: [1, 12], contourDeformation: [0.2, 3.0],
  apertureAttackMs: [8, 240],
  apertureReleaseMs: [50, 900], attraction: [0, 3], softness: [0.03, 0.35],
  tangentForce: [0, 2], homeRestore: [0, 3], eccentricity: [0.4, 1.15],
  petalCount: [2, 10], ringCount: [2, 9], seedJitter: [0, 1],
  burstRadial: [0, 2], burstAngular: [0, 2], linearDrag: [0.3, 4],
  angularDrag: [0.3, 5], maxVelocity: [0.15, 2], maxAcceleration: [0.4, 6],
  pullThreshold: [0.05, 0.65], releaseThreshold: [0.02, 0.5], dwellMs: [0, 500],
  sizeVariation: [0, 1], density: [0.3, 1], opacity: [0.15, 1], depth: [0, 1],
  backdropIntensity: [0, 1], bassBloom: [0, 2.5], bassWave: [0, 2.5], spectralDetail: [0, 2.5],
  backgroundHue: [0, 360], bassHue: [0, 360], midHue: [0, 360], highHue: [0, 360],
  saturation: [0, 1], brightness: [0.35, 1.6], zoom: [0.65, 1.6],
  centerX: [-0.35, 0.35], centerY: [-0.35, 0.35],
};

const booleanKeys: Array<keyof MagneticApertureSettings> = [
  "backdropVisible", "bassVisible", "bassReactive", "midVisible", "midReactive", "highVisible",
  "highReactive", "contourVisible", "guides", "diagnostics",
];

const palettes: MagneticPalette[] = ["crimson-white", "ultraviolet", "aurora", "ember"];
const backdropThemes = ["purple-red", "green-blue", "earth-brown", "deep-dark"];
const particleShapes: MagneticParticleShape[] = ["dash", "pill", "diamond", "circle"];

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export const sanitiseMagneticSettings = (
  candidate: Partial<MagneticApertureSettings> | null | undefined,
): MagneticApertureSettings => {
  const next = { ...MAGNETIC_REFERENCE_SETTINGS };
  if (!candidate) return next;

  for (const [key, range] of Object.entries(magneticBounds) as Array<
    [keyof MagneticApertureSettings, [number, number]]
  >) {
    const value = candidate[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      (next[key] as number) = clamp(value, range[0], range[1]);
    }
  }
  for (const key of booleanKeys) {
    if (typeof candidate[key] === "boolean") (next[key] as boolean) = candidate[key];
  }
  if (candidate.rotationDirection === -1 || candidate.rotationDirection === 1) {
    next.rotationDirection = candidate.rotationDirection;
  }
  if (palettes.includes(candidate.palette as MagneticPalette)) {
    next.palette = candidate.palette as MagneticPalette;
  }
  if (backdropThemes.includes(candidate.backdropTheme as string)) {
    next.backdropTheme = candidate.backdropTheme as any;
  }
  if (particleShapes.includes(candidate.particleShape as MagneticParticleShape)) {
    next.particleShape = candidate.particleShape as MagneticParticleShape;
  }

  next.pieceCount = Math.round(next.pieceCount);
  next.petalCount = Math.round(next.petalCount);
  next.ringCount = Math.round(next.ringCount);
  next.bassMidCrossover = Math.min(next.bassMidCrossover, next.midHighCrossover - 100);
  next.releaseThreshold = Math.min(next.releaseThreshold, next.pullThreshold - 0.01);
  return next;
};

export const loadMagneticSettings = (): MagneticApertureSettings => {
  if (typeof window === "undefined") return { ...MAGNETIC_REFERENCE_SETTINGS };
  try {
    const saved = window.localStorage.getItem(MAGNETIC_SETTINGS_STORAGE_KEY);
    const parsed = saved ? JSON.parse(saved) : null;
    if (parsed?.version === 12) return sanitiseMagneticSettings(parsed.settings);

    const legacySaved = window.localStorage.getItem(LEGACY_MAGNETIC_SETTINGS_STORAGE_KEY);
    const legacy = legacySaved ? JSON.parse(legacySaved) : null;
    if (legacy?.version === 11) {
      const legacySettings = legacy.settings || {};
      return sanitiseMagneticSettings({
        ...legacySettings,
        // Preserve deliberate custom gravity values while upgrading the old default.
        gravityPull: legacySettings.gravityPull === 1
          ? MAGNETIC_REFERENCE_SETTINGS.gravityPull
          : legacySettings.gravityPull,
      });
    }
    return { ...MAGNETIC_REFERENCE_SETTINGS };
  } catch {
    return { ...MAGNETIC_REFERENCE_SETTINGS };
  }
};

export const saveMagneticSettings = (settings: MagneticApertureSettings) => {
  try {
    window.localStorage.setItem(
      MAGNETIC_SETTINGS_STORAGE_KEY,
      JSON.stringify({ version: 12, settings }),
    );
  } catch {
    // Settings remain usable in memory when browser storage is unavailable.
  }
};
