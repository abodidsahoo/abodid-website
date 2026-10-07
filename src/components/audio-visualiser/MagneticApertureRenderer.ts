import { AudioFeatureProcessor } from "./AudioFeatureProcessor";
import { mapGravityPullToPhysics } from "./settings";
import type {
  AudioFeatureFrame,
  MagneticApertureSettings,
  MagneticDiagnostics,
} from "./types";

type RendererOptions = {
  canvas: HTMLCanvasElement;
  getAnalyser: () => AnalyserNode | null;
  getSettings: () => MagneticApertureSettings;
  onDiagnostics?: (diagnostics: MagneticDiagnostics) => void;
};

const MAX_PARTICLES = 1200;
const INSTANCE_STRIDE = 9; // pos(2) + size(2) + angle(1) + depth(1) + family(1) + energy(1) + shape(1)
const FIXED_STEP = 1 / 120;
const TAU = Math.PI * 2;

// Physics constants — tuned for dramatic audio reactivity
const MAX_VELOCITY      = 4.2;   // much higher ceiling — bursts travel far
const MAX_ACCELERATION  = 12.0;  // instant kick from drums
const LINEAR_DRAG       = 2.8;   // fast natural decay so movements are crisp, not sluggish
const ANGULAR_DRAG      = 3.2;
const BURST_BASE        = 3.5;   // baseline burst multiplier
const ELONGATION_DECAY  = 6.0;   // s⁻¹  — pluck holds ~160 ms then fades
const SCALE_ATTACK      = 18.0;  // energy-to-size spring rate (fast pop)
const SCALE_DECAY       = 4.5;   // size decay toward rest (slow release = visual sustain)
const CENTER_PULL_REST  = 0.08;  // gentle gravity when quiet
const CENTER_PULL_MUS   = 0.22;  // stronger during music (resist total scatter)

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const hash = (index: number, salt: number) => {
  let value = Math.imul(index + 1, 0x45d9f3b) ^ Math.imul(salt, 0x27d4eb2d);
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
  value ^= value >>> 16;
  return (value >>> 0) / 4294967296;
};

const angleDelta = (target: number, current: number) =>
  Math.atan2(Math.sin(target - current), Math.cos(target - current));

const hslToRgb = (hue: number, saturation: number, lightness: number) => {
  const h = ((hue % 360) + 360) % 360 / 360;
  const s = clamp(saturation, 0, 1);
  const l = clamp(lightness, 0, 1);
  const hueToRgb = (p: number, q: number, tValue: number) => {
    let t = tValue;
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  if (s === 0) return [l, l, l] as const;
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [hueToRgb(p, q, h + 1 / 3), hueToRgb(p, q, h), hueToRgb(p, q, h - 1 / 3)] as const;
};

const createShader = (gl: WebGL2RenderingContext, type: number, source: string) => {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("Unable to create a WebGL shader.");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader) || "Unknown shader error";
    gl.deleteShader(shader);
    throw new Error(message);
  }
  return shader;
};

const createProgram = (
  gl: WebGL2RenderingContext,
  vertexSource: string,
  fragmentSource: string,
) => {
  const program = gl.createProgram();
  if (!program) throw new Error("Unable to create a WebGL program.");
  const vertex = createShader(gl, gl.VERTEX_SHADER, vertexSource);
  const fragment = createShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(program) || "Unable to link WebGL program.");
  }
  return program;
};

const PIECE_VERTEX = `#version 300 es
precision highp float;
layout(location=0) in vec2 aCorner;
layout(location=1) in vec2 aPosition;
layout(location=2) in vec2 aSize;
layout(location=3) in float aAngle;
layout(location=4) in float aDepth;
layout(location=5) in float aFamily;
layout(location=6) in float aEnergy;
layout(location=7) in float aShape;
uniform float uAspect;
uniform float uZoom;
uniform vec2 uCenter;
out float vDepth;
out float vFamily;
out float vEnergy;
out float vShape;
out vec2 vLocal;
out vec2 vHalfSize;
void main() {
  vLocal = aCorner * aSize;
  vHalfSize = aSize;
  float c = cos(aAngle);
  float s = sin(aAngle);
  vec2 world = aPosition + mat2(c, -s, s, c) * vLocal;
  vec2 clip = vec2(world.x / uAspect, world.y) * uZoom + uCenter;
  gl_Position = vec4(clip, 0.0, 1.0);
  vDepth = aDepth;
  vFamily = aFamily;
  vEnergy = aEnergy;
  vShape = aShape;
}`;

const PIECE_FRAGMENT = `#version 300 es
precision highp float;
in float vDepth;
in float vFamily;
in float vEnergy;
in float vShape;
in vec2 vLocal;
in vec2 vHalfSize;
uniform vec3 uBassColor;
uniform vec3 uMidColor;
uniform vec3 uHighColor;
out vec4 outColor;

float sdBox(vec2 p, vec2 b) {
  vec2 d = abs(p) - b;
  return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
}
float sdPill(vec2 p, vec2 b) {
  float r = min(b.x, b.y) * 0.78;
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}
float sdDiamond(vec2 p, vec2 b) {
  vec2 q = abs(p);
  return (q.x / b.x + q.y / b.y) - 1.0;
}
float sdCircle(vec2 p, vec2 b) {
  return length(p) - min(b.x, b.y);
}

void main() {
  vec2 p = vLocal;
  vec2 b = vHalfSize;
  float dist;
  int shape = int(vShape + 0.5);
  if (shape == 0)      dist = sdBox(p, b);
  else if (shape == 1) dist = sdPill(p, b);
  else if (shape == 2) dist = sdDiamond(p, b);
  else                 dist = sdCircle(p, b);

  float edge = fwidth(dist) * 0.9;
  float alpha = 1.0 - smoothstep(-edge, edge, dist);
  if (alpha < 0.012) discard;

  vec3 color = vFamily < 0.5 ? uBassColor : (vFamily < 1.5 ? uMidColor : uHighColor);
  float depthLight = mix(0.42, 1.0, vDepth);
  // Energy brightening: particles glow notably brighter when energised
  float energyLight = 0.68 + vEnergy * 0.72;
  outColor = vec4(color * depthLight * energyLight, alpha);
}`;

const CONTOUR_VERTEX = `#version 300 es
precision highp float;
layout(location=0) in vec2 aPosition;
uniform float uAspect;
uniform float uZoom;
uniform vec2 uCenter;
out vec2 vCoord;
void main() {
  vec2 world = aPosition * 1.8;
  vec2 clip = vec2(world.x / uAspect, world.y) * uZoom + uCenter;
  vCoord = world;
  gl_Position = vec4(clip, 0.0, 1.0);
}
`;

const CONTOUR_FRAGMENT = `#version 300 es
precision highp float;
in vec2 vCoord;
uniform int uRingCount;
uniform float uDeformation;
uniform float uTime;
uniform float uContourAngle;
uniform vec4 uHarmonics;
uniform vec4 uHarmonicPhases;
uniform float uBeatExpansion;
uniform float uBeatRippleAge;
uniform float uSpectrum[24];
uniform float uSpectrumStrength;
uniform vec3 uContourColor;
uniform float uGlow;
out vec4 outColor;

void main() {
  vec2 p = vCoord;
  float r = length(p);
  if (r > 1.6 || r < 0.005) discard;
  float theta = atan(p.y, p.x);

  float totalAlpha = 0.0;
  float baseSpacing = 0.038;
  float innerR = 0.065;

  // Place the full perceptual spectrum around the aperture. Low frequencies
  // begin at the top and increasingly bright frequencies travel clockwise.
  float spectralPeak = 0.0;
  float spectralTheta = theta - uContourAngle;
  for (int spectrumIndex = 0; spectrumIndex < 24; spectrumIndex++) {
    float spectrumPosition = float(spectrumIndex) / 24.0;
    float peakAngle = -1.5707963 + spectrumPosition * 6.2831853;
    float angularDistance = abs(atan(
      sin(spectralTheta - peakAngle),
      cos(spectralTheta - peakAngle)
    ));
    float peakShape = exp(-angularDistance * angularDistance * 38.0);
    // Sub-linear shaping deliberately lifts quieter distortion harmonics
    // so individual strings remain visible inside a dense guitar signal.
    float spectrumEnergy = pow(clamp(uSpectrum[spectrumIndex], 0.0, 1.0), 0.54);
    spectralPeak += spectrumEnergy * peakShape;
  }
  spectralPeak = min(spectralPeak, 1.25);

  for (int i = 0; i < 12; i++) {
    if (i >= uRingCount) break;
    float ringIdx = float(i);
    float baseR = innerR + ringIdx * baseSpacing;

    // Bass and drum hits push every string away from the central axis on the
    // onset frame. A ring-index phase offset makes the release travel outward
    // like a water ripple rather than scaling every contour identically.
    float beatSpread = uBeatExpansion * (0.34 + ringIdx * 0.045);
    float travellingRipple =
      sin(ringIdx * 1.85 - uBeatRippleAge * 10.5) *
      uBeatExpansion * 0.11;
    baseR *= 1.0 + beatSpread + travellingRipple;
    
    // Continuous rotation with differential parallax across rings
    float ringAngle = uContourAngle * (1.0 + ringIdx * 0.14);
    float rotTheta = theta - ringAngle;
    float stagger = ringIdx * 0.44;

    // Organic baseline undulation — concentric circles are continuously alive, rotating and morphing
    float baseWave = (
      sin(2.0 * rotTheta + stagger + uTime * 0.75) * 0.036 +
      cos(3.0 * rotTheta - stagger * 1.3 - uTime * 0.55) * 0.026 +
      sin(4.0 * rotTheta + stagger * 0.7 + uTime * 0.40) * 0.016
    ) * clamp(uDeformation, 0.35, 1.8);

    // Audio-reactive amoeba distortion with long harmonic resonance
    float audioWarp = (
      uHarmonics.x * sin(2.0 * rotTheta + uHarmonicPhases.x + stagger) +
      uHarmonics.y * sin(3.0 * rotTheta + uHarmonicPhases.y - stagger * 1.3) +
      uHarmonics.z * sin(4.0 * rotTheta + uHarmonicPhases.z + stagger * 0.7) +
      uHarmonics.w * sin(5.0 * rotTheta + uHarmonicPhases.w - stagger * 0.9)
    ) * uDeformation;

    // Organic breathing ripple
    float breath = sin(uTime * 1.4 + ringIdx * 0.55) * 0.022;

    float distortedR = baseR * (
      1.0 + baseWave + audioWarp + breath
    );

    // The second-outermost ring retains almost the full response; subsequent
    // layers drop rapidly so the effect reads as a spectral echo, not noise.
    float layerDistance = float(uRingCount - 1 - i);
    float layerFalloff = exp(
      -0.60 * pow(max(0.0, layerDistance - 0.55), 1.65)
    );
    distortedR *= 1.0 +
      spectralPeak * uSpectrumStrength * 0.30 * layerFalloff;

    float d = abs(r - distortedR);
    
    // The innermost string is the visual anchor; each following string is
    // progressively lighter. Beat width travels from the core to adjacent
    // rings and loses strength as it moves toward the outer edge.
    float restingWidth = 0.0015 + 0.0048 * exp(-ringIdx * 0.34);
    float relayFront = uBeatRippleAge * 7.5;
    float relayDistance = ringIdx - relayFront;
    float relayPulse = exp(-relayDistance * relayDistance * 1.15);
    float relayFalloff = exp(-ringIdx * 0.24);
    float halfWidth = restingWidth +
      relayPulse * relayFalloff * uBeatExpansion * 0.0045;
    float lineEdge = fwidth(d) * 1.1;
    float lineCore = 1.0 - smoothstep(halfWidth - lineEdge, halfWidth + lineEdge, d);
    float glow = exp(-d * 55.0) * 0.38 * uGlow;
    
    // Depth fade for outermost strings
    float ringAlpha = (lineCore + glow) * (1.0 - ringIdx * 0.04);
    totalAlpha = max(totalAlpha, ringAlpha);
  }

  if (totalAlpha < 0.012) discard;
  outColor = vec4(uContourColor, totalAlpha * 0.92);
}
`;

const BACKDROP_VERTEX = `#version 300 es
precision highp float;
layout(location=0) in vec2 aPosition;
out vec2 vUv;
void main() {
  vUv = aPosition * 0.5 + 0.5;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}`;

const BACKDROP_FRAGMENT = `#version 300 es
precision highp float;
in vec2 vUv;
uniform float uTime;
uniform int uTheme; // 0 = purple-red, 1 = green-blue, 2 = earth-brown, 3 = deep-dark
uniform float uIntensity;
uniform float uEnergy;
uniform float uAspect;
uniform float uBassBloom;
uniform float uBassWaveAge;
uniform float uBassWaveStrength;
uniform vec3 uBassColor;
out vec4 outColor;

vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }

float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                     -0.577350269189626, 0.024390243902439);
  vec2 i  = floor(v + dot(v, C.yy));
  vec2 x0 = v -   i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod289(i);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0))
        + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
  m = m*m;
  m = m*m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
  vec3 g;
  g.x  = a0.x  * x0.x  + h.x  * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

void main() {
  vec2 p = vUv;
  p.x *= uAspect;

  // Ultra-slow atmospheric aurora drift
  float t = uTime * 0.055;
  
  vec2 q = vec2(snoise(p * 0.85 + vec2(t * 0.5, t * 0.3)),
                snoise(p * 0.85 + vec2(-t * 0.4, t * 0.6)));
                
  vec2 r = vec2(snoise(p * 1.3 + q * 0.75 + vec2(t * 0.7, -t * 0.4)),
                snoise(p * 1.3 + q * 0.75 + vec2(-t * 0.5, t * 0.8)));
                
  float f = 0.5 + 0.5 * snoise(p * 1.0 + r * 1.1);
  float f2 = 0.5 + 0.5 * snoise(p * 1.6 - r * 0.85 + vec2(t * 0.25, t * 0.45));

  vec3 colBase, colMid, colHigh;
  if (uTheme == 0) {
    // Purple-Red: Void -> Rich Plum Violet -> Warm Ruby Red
    colBase = vec3(0.038, 0.022, 0.055);
    colMid  = vec3(0.16,  0.035, 0.15);
    colHigh = vec3(0.26,  0.038, 0.075);
  } else if (uTheme == 1) {
    // Green-Blue: Deep ocean navy -> Emerald Teal -> Cyan-Cobalt
    colBase = vec3(0.015, 0.032, 0.058);
    colMid  = vec3(0.020, 0.14,  0.12);
    colHigh = vec3(0.038, 0.16,  0.24);
  } else if (uTheme == 2) {
    // Earth-Brown: Deep charcoal -> Warm Burnt Sienna -> Golden Amber Ochre
    colBase = vec3(0.038, 0.026, 0.018);
    colMid  = vec3(0.14,  0.065, 0.022);
    colHigh = vec3(0.22,  0.12,  0.032);
  } else {
    // Deep Dark: Deep midnight ink
    colBase = vec3(0.014, 0.015, 0.020);
    colMid  = vec3(0.026, 0.028, 0.038);
    colHigh = vec3(0.038, 0.040, 0.055);
  }

  vec3 finalColor = mix(colBase, colMid, smoothstep(0.15, 0.85, f));
  finalColor = mix(finalColor, colHigh, smoothstep(0.35, 0.95, f2) * 0.85);

  // Subtle breathing pulse with audio energy
  finalColor *= (1.0 + uEnergy * 0.28);

  // A kick or bass drum lights the center like a pressure source, then sends
  // a thin wavefront into the field. Both decay independently of sustained bass.
  vec2 centered = vUv - 0.5;
  centered.x *= uAspect;
  float radius = length(centered);
  float coreBloom = exp(-radius * radius * 38.0) * uBassBloom;
  float bloomHalo = exp(-radius * radius * 10.0) * uBassBloom * 0.28;
  float waveRadius = min(1.35, uBassWaveAge * 0.92);
  float pressureWave = exp(-pow((radius - waveRadius) * 25.0, 2.0)) * uBassWaveStrength;
  finalColor += uBassColor * (coreBloom * 0.72 + bloomHalo * 0.36 + pressureWave * 0.42);

  // Intensity blend with deep ink
  finalColor = mix(vec3(0.014, 0.014, 0.018), finalColor, uIntensity);

  outColor = vec4(finalColor, 1.0);
}`;

const SHAPE_INDEX: Record<string, number> = {
  dash: 0,
  pill: 1,
  diamond: 2,
  circle: 3,
};

export class MagneticApertureRenderer {
  private readonly gl: WebGL2RenderingContext;
  private readonly featureProcessor = new AudioFeatureProcessor();
  private readonly pieceProgram: WebGLProgram;
  private readonly pieceVao: WebGLVertexArrayObject;
  private readonly pieceCornerBuffer: WebGLBuffer;
  private readonly instanceBuffer: WebGLBuffer;
  private readonly contourProgram: WebGLProgram;
  private readonly contourVao: WebGLVertexArrayObject;
  private readonly contourQuadBuffer: WebGLBuffer;
  private readonly backdropProgram: WebGLProgram;
  private readonly backdropVao: WebGLVertexArrayObject;
  private readonly backdropQuadBuffer: WebGLBuffer;
  private readonly instanceData = new Float32Array(MAX_PARTICLES * INSTANCE_STRIDE);
  private readonly x = new Float32Array(MAX_PARTICLES);
  private readonly y = new Float32Array(MAX_PARTICLES);
  private readonly vx = new Float32Array(MAX_PARTICLES);
  private readonly vy = new Float32Array(MAX_PARTICLES);
  private readonly angle = new Float32Array(MAX_PARTICLES);
  private readonly angularVelocity = new Float32Array(MAX_PARTICLES);
  private readonly baseAngle = new Float32Array(MAX_PARTICLES);
  private readonly baseRadius = new Float32Array(MAX_PARTICLES);
  private readonly phase = new Float32Array(MAX_PARTICLES);
  private readonly depth = new Float32Array(MAX_PARTICLES);
  private readonly baseSize = new Float32Array(MAX_PARTICLES);
  private readonly family = new Uint8Array(MAX_PARTICLES);
  private readonly visibility = new Float32Array(MAX_PARTICLES);
  private readonly routedSpectrum = new Float32Array(24);
  // Per-particle dynamic scale — responds to music energy with attack/sustain/decay
  private readonly dynScale = new Float32Array(MAX_PARTICLES);
  // Per-particle elongation for guitar-pluck effect
  private readonly elongation = new Float32Array(MAX_PARTICLES);
  // Per-particle displacement impulse from hi-hat / burst
  private readonly dispX = new Float32Array(MAX_PARTICLES);
  private readonly dispY = new Float32Array(MAX_PARTICLES);

  // Amoeba contour harmonic oscillation states (A2, A3, A4, A5)
  private readonly harmonicAmps = new Float32Array([0, 0, 0, 0]);
  private readonly harmonicVels = new Float32Array([0, 0, 0, 0]);
  private readonly harmonicPhases = new Float32Array([0, 0.8, 1.6, 2.4]);
  private contourAngle = 0;
  private contourAngularVel = 0.35;
  private contourBeatExpansion = 0;
  private contourBeatRippleAge = 4;
  private bassBloomStrength = 0;
  private bassWaveStrength = 0;
  private bassWaveAge = 4;

  // Smooth parameter interpolation states for liquid slider tweaking
  private smoothedSpread = 0.94;
  private smoothedGravityPull = mapGravityPullToPhysics(1.0);
  private smoothedBurst = 1.0;
  private smoothedReaction = 1.0;
  private smoothedPieceLength = 1.05;
  private smoothedPieceWidth = 0.82;
  private smoothedRotationSpeed = 0.24;

  private animationFrame = 0;
  private resizeObserver: ResizeObserver | null = null;
  private lastTime = 0;
  private accumulator = 0;
  private rotationPhase = 0;
  private activeCount = 0;
  private drawnCount = 0;
  private cssWidth = 1;
  private cssHeight = 1;
  private disposed = false;
  private frameCounter = 0;
  private diagnosticsStart = 0;
  private lastDiagnostics = 0;
  private lastFrameMs = 0;
  private lastFeatures: AudioFeatureFrame | null = null;
  private bassOnsetSeen = false;
  private midOnsetSeen = false;
  private highOnsetSeen = false;
  private releaseSeen = false;

  constructor(private readonly options: RendererOptions) {
    const gl = options.canvas.getContext("webgl2", {
      alpha: false,
      antialias: true,
      powerPreference: "high-performance",
      preserveDrawingBuffer: false,
    });
    if (!gl) throw new Error("Magnetic Aperture needs WebGL 2, which is unavailable here.");
    this.gl = gl;
    this.pieceProgram = createProgram(gl, PIECE_VERTEX, PIECE_FRAGMENT);
    this.contourProgram = createProgram(gl, CONTOUR_VERTEX, CONTOUR_FRAGMENT);
    this.backdropProgram = createProgram(gl, BACKDROP_VERTEX, BACKDROP_FRAGMENT);

    const pieceVao = gl.createVertexArray();
    const cornerBuffer = gl.createBuffer();
    const instanceBuffer = gl.createBuffer();
    const contourVao = gl.createVertexArray();
    const contourQuadBuffer = gl.createBuffer();
    const backdropVao = gl.createVertexArray();
    const backdropQuadBuffer = gl.createBuffer();
    if (
      !pieceVao || !cornerBuffer || !instanceBuffer ||
      !contourVao || !contourQuadBuffer ||
      !backdropVao || !backdropQuadBuffer
    ) {
      throw new Error("Unable to allocate WebGL buffers.");
    }
    this.pieceVao = pieceVao;
    this.pieceCornerBuffer = cornerBuffer;
    this.instanceBuffer = instanceBuffer;
    this.contourVao = contourVao;
    this.contourQuadBuffer = contourQuadBuffer;
    this.backdropVao = backdropVao;
    this.backdropQuadBuffer = backdropQuadBuffer;

    gl.bindVertexArray(pieceVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, cornerBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
      gl.STATIC_DRAW,
    );
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, instanceBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.instanceData.byteLength, gl.DYNAMIC_DRAW);
    const stride = INSTANCE_STRIDE * 4;
    const attributes: Array<[number, number, number]> = [
      [1, 2, 0], // aPosition
      [2, 2, 2], // aSize
      [3, 1, 4], // aAngle
      [4, 1, 5], // aDepth
      [5, 1, 6], // aFamily
      [6, 1, 7], // aEnergy
      [7, 1, 8], // aShape
    ];
    for (const [location, size, offset] of attributes) {
      gl.enableVertexAttribArray(location);
      gl.vertexAttribPointer(location, size, gl.FLOAT, false, stride, offset * 4);
      gl.vertexAttribDivisor(location, 1);
    }
    gl.bindVertexArray(null);

    // Setup Quad for Contour Rings SDF
    gl.bindVertexArray(contourVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, contourQuadBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
      gl.STATIC_DRAW,
    );
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);

    // Setup Quad for Backdrop Aurora
    gl.bindVertexArray(backdropVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, backdropQuadBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
      gl.STATIC_DRAW,
    );
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    this.seedParticles();
    this.reset();
  }

  start() {
    this.resizeObserver = new ResizeObserver(this.resize);
    this.resizeObserver.observe(this.options.canvas);
    document.addEventListener("visibilitychange", this.handleVisibility);
    this.resize();
    this.lastTime = performance.now();
    this.diagnosticsStart = this.lastTime;
    this.scheduleFrame();
  }

  reset() {
    const settings = this.options.getSettings();
    this.activeCount = Math.min(MAX_PARTICLES, Math.round(settings.pieceCount));
    this.rotationPhase = 0;
    this.accumulator = 0;
    this.contourAngle = 0;
    this.contourAngularVel = 0.35 * settings.rotationDirection;
    this.contourBeatExpansion = 0;
    this.contourBeatRippleAge = 4;
    this.bassBloomStrength = 0;
    this.bassWaveStrength = 0;
    this.bassWaveAge = 4;
    this.harmonicAmps.fill(0);
    this.harmonicVels.fill(0);
    for (let index = 0; index < MAX_PARTICLES; index += 1) {
      const home = this.getHome(index, settings, 0);
      this.x[index] = home.x;
      this.y[index] = home.y;
      this.vx[index] = 0;
      this.vy[index] = 0;
      this.angle[index] = home.angle;
      this.angularVelocity[index] = 0;
      this.elongation[index] = 0;
      this.dynScale[index] = 1;
      this.dispX[index] = 0;
      this.dispY[index] = 0;
    }
  }

  private seedParticles() {
    for (let index = 0; index < MAX_PARTICLES; index += 1) {
      const familyRoll = index % 10;
      const family = familyRoll < 2 ? 0 : familyRoll < 8 ? 1 : 2;
      this.family[index] = family;
      this.baseAngle[index] = hash(index, 1) * TAU;
      const range = family === 0 ? [0.24, 0.46] : family === 1 ? [0.38, 0.82] : [0.7, 1.12];
      this.baseRadius[index] = range[0] + (range[1] - range[0]) * hash(index, 2);
      this.phase[index] = hash(index, 3) * TAU;
      this.depth[index] = 0.18 + hash(index, 4) * 0.82;
      this.baseSize[index] = 0.65 + hash(index, 5) * 0.7;
      this.visibility[index] = hash(index, 6);
      this.dynScale[index] = 1;
    }
  }

  private getHome(index: number, settings: MagneticApertureSettings, midEnergy: number) {
    const base = this.baseAngle[index];
    const ring = index % Math.max(2, settings.ringCount);
    const shear = midEnergy * settings.deformation * 0.2 * Math.sin(this.phase[index] + ring);
    const theta = base + this.rotationPhase + shear;
    const petal = Math.sin(theta * settings.petalCount + this.phase[index]);
    const jitter = (hash(index, 7) - 0.5) * settings.seedJitter * 0.08;
    const radius =
      (this.baseRadius[index] + jitter) *
      this.smoothedSpread *
      (1 + petal * settings.deformation * (0.08 + midEnergy * 0.12));
    return {
      x: Math.cos(theta) * radius,
      y: Math.sin(theta) * radius * settings.eccentricity,
      angle: theta + Math.PI / 2 + petal * 0.18,
    };
  }

  private resize = () => {
    const rect = this.options.canvas.getBoundingClientRect();
    this.cssWidth = Math.max(1, Math.round(rect.width));
    this.cssHeight = Math.max(1, Math.round(rect.height));
    const ratio = Math.min(1.75, Math.max(1, window.devicePixelRatio || 1));
    const width = Math.round(this.cssWidth * ratio);
    const height = Math.round(this.cssHeight * ratio);
    if (this.options.canvas.width !== width || this.options.canvas.height !== height) {
      this.options.canvas.width = width;
      this.options.canvas.height = height;
      this.gl.viewport(0, 0, width, height);
    }
  };

  private handleVisibility = () => {
    if (document.hidden) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = 0;
      return;
    }
    this.lastTime = performance.now();
    this.accumulator = 0;
    this.scheduleFrame();
  };

  private scheduleFrame() {
    if (!this.disposed && !document.hidden && !this.animationFrame) {
      this.animationFrame = requestAnimationFrame(this.draw);
    }
  }

  private draw = (time: number) => {
    this.animationFrame = 0;
    if (this.disposed || document.hidden) return;
    const frameStart = performance.now();
    const settings = this.options.getSettings();
    this.activeCount = Math.min(MAX_PARTICLES, Math.round(settings.pieceCount));
    const features = this.featureProcessor.process(this.options.getAnalyser(), settings, time);
    this.lastFeatures = features;
    this.bassOnsetSeen ||= features.bass.onset;
    this.midOnsetSeen ||= features.mid.onset;
    this.highOnsetSeen ||= features.high.onset;
    this.releaseSeen ||= features.released;
    const elapsed = Math.min(0.05, Math.max(0, (time - this.lastTime) / 1000));
    this.lastTime = time;
    this.accumulator = Math.min(0.05, this.accumulator + elapsed);

    // ── ONSET EVENTS (run once per frame, before physics steps) ──────────

    // Bass drum (deep kick / 808s): powerful magnetic repulsion blast towards periphery
    if (features.bass.onset && settings.bassReactive) {
      this.applyBurst(settings, features, "bass");
      const impact = Math.max(0.2, features.bass.transient);
      this.bassBloomStrength = Math.max(
        this.bassBloomStrength,
        impact * settings.bassBloom * settings.overallReaction,
      );
      this.bassWaveStrength = Math.max(
        this.bassWaveStrength,
        impact * settings.bassWave * settings.overallReaction,
      );
      this.bassWaveAge = 0;
    }

    // Soft drum (snare / toms / punchy percussion): crisp magnetic repulsion towards periphery
    if (features.mid.onset && settings.midReactive) {
      this.applyBurst(settings, features, "mid");
    }

    // Direct contour expansion: bypass the slower harmonic springs so the
    // visible diameter changes on the exact frame of a kick, bass pluck, or drum hit.
    if (
      settings.contourVisible &&
      ((features.bass.onset && settings.bassReactive) ||
        (features.mid.onset && settings.midReactive))
    ) {
      const bassHit = settings.bassReactive
        ? features.bass.fast * 1.25
        : 0;
      const drumHit = settings.midReactive
        ? features.mid.fast * 0.85
        : 0;
      const hitStrength = clamp(
        (bassHit + drumHit) * settings.overallReaction,
        0.2,
        1,
      );
      this.contourBeatExpansion = Math.max(this.contourBeatExpansion, hitStrength);
      this.contourBeatRippleAge = 0;
    }

    // Amoeba contour warp impulses on bass / drum onsets
    if (
      ((features.bass.onset && settings.bassReactive) ||
        (features.mid.onset && settings.midReactive)) &&
      settings.contourVisible
    ) {
      const kick = (
        (settings.bassReactive ? features.bass.transient * 1.8 : 0) +
        (settings.midReactive ? features.mid.transient * 1.2 : 0)
      ) * settings.contourDeformation;
      // Multi-frequency directional twist on every beat so distortions occur in dynamic orientations
      this.harmonicVels[0] += (hash(this.activeCount, 31) - 0.5) * kick * 8.5;
      this.harmonicVels[1] += (hash(this.activeCount, 32) - 0.5) * kick * 7.0;
      this.harmonicVels[2] += (hash(this.activeCount, 33) - 0.5) * kick * 5.8;
      this.harmonicVels[3] += (hash(this.activeCount, 34) - 0.5) * kick * 4.8;
      // Impart dynamic rotational impulse to concentric contours on heavy beats
      this.contourAngularVel += (hash(this.activeCount, 48) - 0.5) * kick * 1.8;
    }

    // High frequency / guitar riff & treble: dramatic scale explosion and elongation
    if (features.high.onset && settings.highReactive) {
      this.applyGuitarRiffAndTreble(settings, features);
    }

    let steps = 0;
    while (this.accumulator >= FIXED_STEP && steps < 6) {
      this.simulate(FIXED_STEP, settings, features);
      this.accumulator -= FIXED_STEP;
      steps += 1;
    }

    this.render(settings, features);
    this.lastFrameMs = performance.now() - frameStart;
    this.measureDiagnostics(time, settings);
    this.scheduleFrame();
  };

  private simulate(
    delta: number,
    settings: MagneticApertureSettings,
    features: AudioFeatureFrame,
  ) {
    // Smooth blending on user parameter changes
    const blendRate = 1 - Math.exp(-24 * delta);
    this.smoothedSpread += (settings.fieldSpread - this.smoothedSpread) * blendRate;
    const effectiveGravityPull = mapGravityPullToPhysics(settings.gravityPull);
    this.smoothedGravityPull += (effectiveGravityPull - this.smoothedGravityPull) * blendRate;
    this.smoothedBurst += (settings.burstStrength - this.smoothedBurst) * blendRate;
    this.smoothedReaction += (settings.overallReaction - this.smoothedReaction) * blendRate;
    this.smoothedPieceLength += (settings.pieceLength - this.smoothedPieceLength) * blendRate;
    this.smoothedPieceWidth += (settings.pieceWidth - this.smoothedPieceWidth) * blendRate;
    this.smoothedRotationSpeed += (settings.rotationSpeed - this.smoothedRotationSpeed) * blendRate;
    // Calibrate master sensitivity so the initial sweet spot (0.1–0.4) is comfortably spread across the full 0.1–2.0 slider range
    const effReaction = this.smoothedReaction * 0.40;
    // Sensitivity is applied once in AudioFeatureProcessor. The renderer only
    // applies the creative master response, keeping every band predictable.
    const bass = settings.bassReactive ? features.bass.energy * effReaction : 0;
    const mid = settings.midReactive ? features.mid.energy * effReaction : 0;
    const high = settings.highReactive ? features.high.energy * effReaction : 0;
    const totalEnergy = clamp((bass + mid + high) / 3, 0, 1);

    this.bassBloomStrength *= Math.exp(-6.5 * delta);
    this.bassWaveStrength *= Math.exp(-3.8 * delta);
    this.bassWaveAge += delta;

    // Immediate onset injection above, followed by a smooth watery release.
    // Stronger hits start wider but share the same legible fade duration.
    this.contourBeatExpansion *= Math.exp(-3.25 * delta);
    this.contourBeatRippleAge += delta;

    // Continuous rotation of the concentric contour rings with smooth momentum
    const targetContourSpeed =
      (0.35 + totalEnergy * 0.70) * settings.rotationDirection * this.smoothedRotationSpeed;
    this.contourAngularVel += (targetContourSpeed - this.contourAngularVel) * (1 - Math.exp(-3.5 * delta));
    this.contourAngle += delta * this.contourAngularVel;

    // Amoeba harmonic spring dynamics with ultra-slow, graceful decay (never static)
    for (let k = 0; k < 4; k += 1) {
      const springK = 6.8;   // low spring stiffness -> slow, fluid organic oscillation
      const dampingD = 1.15; // gentle damping -> long, musical resonance with slow decay
      const accel = -springK * this.harmonicAmps[k] - dampingD * this.harmonicVels[k];
      this.harmonicVels[k] += accel * delta;
      this.harmonicAmps[k] += this.harmonicVels[k] * delta;
      this.harmonicAmps[k] = clamp(this.harmonicAmps[k], -0.75, 0.75);
      this.harmonicPhases[k] += delta * (0.24 + k * 0.16) * settings.rotationDirection;
    }

    this.rotationPhase +=
      delta * settings.rotationDirection * this.smoothedRotationSpeed *
      (0.24 + mid * 1.7 + features.spectralCentroid * 0.42);

    const linearDamping = Math.exp(-LINEAR_DRAG * delta);
    const angularDamping = Math.exp(-ANGULAR_DRAG * delta);
    const elongDecay = Math.exp(-ELONGATION_DECAY * delta);
    // Dynamic scale springs: fast attack on riffs/chords, smooth decay
    const scaleAttack = 1 - Math.exp(-SCALE_ATTACK * delta);
    const scaleDecay  = 1 - Math.exp(-SCALE_DECAY  * delta);

    // Center gravity & Magnetic Inward Pull: scaled by smoothedGravityPull
    const centerPull = (features.hasSignal
      ? CENTER_PULL_MUS + totalEnergy * 0.15
      : CENTER_PULL_REST) * this.smoothedGravityPull;

    // Home restore: suppressed during active music
    const homeRestoreStrength = settings.homeRestore * clamp(1 - totalEnergy * 1.3, 0.04, 1);

    for (let index = 0; index < this.activeCount; index += 1) {
      const family = this.family[index];
      const familyEnergy = family === 0 ? bass : family === 1 ? mid : high;

      // ── Dramatic Scale: guitar riffs & high frequencies pop cleanly without exploding ──────
      const trebleMultiplier = family === 2 ? 3.0 : family === 1 ? 1.8 : 1.2;
      const targetScale = 1 + (familyEnergy * trebleMultiplier + high * 1.5);
      if (targetScale > this.dynScale[index]) {
        this.dynScale[index] += (targetScale - this.dynScale[index]) * scaleAttack;
      } else {
        this.dynScale[index] += (1 - this.dynScale[index]) * scaleDecay;
      }

      // ── Elongation decay ─────────────────────────────────────────────
      this.elongation[index] *= elongDecay;

      // ── Displacement decay ───────────────────────────────────────────
      this.dispX[index] *= elongDecay * 0.85;
      this.dispY[index] *= elongDecay * 0.85;

      const home = this.getHome(index, settings, mid);

      const radiusSquared = this.x[index] * this.x[index] + this.y[index] * this.y[index];
      const radius = Math.max(0.025, Math.sqrt(radiusSquared));
      const nx = this.x[index] / radius;
      const ny = this.y[index] / radius;

      // ── Forces ──────────────────────────────────────────────────────
      // 1. Center gravity & Magnetic inward pull to center
      const inwardGravity = centerPull * (1 + (this.smoothedGravityPull * 0.45) / (radius + 0.25));
      let ax = -nx * inwardGravity;
      let ay = -ny * inwardGravity;

      // 2. Home restore (weak during music)
      ax += (home.x - this.x[index]) * homeRestoreStrength;
      ay += (home.y - this.y[index]) * homeRestoreStrength;

      // 3. Continuous magnetic repulsion from central axis towards outer periphery
      // Bass and soft drum push particles radially outward from central axis
      const drumRepulsion = (bass * 1.4 + mid * 0.8) * this.smoothedBurst;
      if (drumRepulsion > 0.005) {
        const outwardForce = Math.min(
          MAX_ACCELERATION * 0.75,
          (drumRepulsion * 2.0) / (radius + 0.35)
        );
        ax += nx * outwardForce;
        ay += ny * outwardForce;
      }

      // 4. Tangential orbital swirl
      const tangent = settings.tangentForce * (0.09 + familyEnergy * 0.5) * settings.rotationDirection;
      ax += -this.y[index] / radius * tangent;
      ay +=  this.x[index] / radius * tangent;

      // 5. Treble shimmer on guitar/high-frequencies
      if (family === 2 && high > 0.04) {
        const shimmer = Math.sin(this.phase[index] + this.rotationPhase * 8) * high *
          (0.48 + features.spectralFlatness * 0.72);
        ax += Math.cos(this.baseAngle[index]) * shimmer;
        ay += Math.sin(this.baseAngle[index]) * shimmer;
      }

      // 6. Black Hole Particle Absorption & Recycling when touching inner Amoeba contour
      if (settings.contourVisible) {
        const thetaP = Math.atan2(this.y[index], this.x[index]) - this.contourAngle;
        const innerWarp = (
          this.harmonicAmps[0] * Math.sin(2 * thetaP + this.harmonicPhases[0]) +
          this.harmonicAmps[1] * Math.sin(3 * thetaP + this.harmonicPhases[1]) +
          this.harmonicAmps[2] * Math.sin(4 * thetaP + this.harmonicPhases[2]) +
          this.harmonicAmps[3] * Math.sin(5 * thetaP + this.harmonicPhases[3])
        ) * settings.contourDeformation;
        const amoebaRadius = 0.072 * Math.max(0.4, (1 + innerWarp));

        if (radius < amoebaRadius * 1.35) {
          // Caught in event horizon: inward suction & whirlpool spin
          const suction = (amoebaRadius * 1.35 - radius) * 14.0;
          ax += -nx * suction - ny * 3.8 * settings.rotationDirection;
          ay += -ny * suction + nx * 3.8 * settings.rotationDirection;
          this.dynScale[index] *= Math.exp(-9.0 * delta);

          // Total absorption into singularity -> recycle to outer boundary
          if (radius < 0.032 || this.dynScale[index] < 0.12) {
            const spawnR = 0.95 + hash(index, 41) * 0.35;
            const spawnTheta = hash(index, 42) * TAU;
            this.x[index] = Math.cos(spawnTheta) * spawnR;
            this.y[index] = Math.sin(spawnTheta) * spawnR * settings.eccentricity;
            this.vx[index] = -Math.sin(spawnTheta) * 0.25 * settings.rotationDirection;
            this.vy[index] =  Math.cos(spawnTheta) * 0.25 * settings.rotationDirection;
            this.dynScale[index] = 1.0;
            this.dispX[index] = 0;
            this.dispY[index] = 0;
            this.elongation[index] = 0;
          }
        }
      }

      // Clamp acceleration
      const accelMag = Math.hypot(ax, ay);
      if (accelMag > MAX_ACCELERATION) {
        ax *= MAX_ACCELERATION / accelMag;
        ay *= MAX_ACCELERATION / accelMag;
      }

      this.vx[index] = (this.vx[index] + ax * delta) * linearDamping;
      this.vy[index] = (this.vy[index] + ay * delta) * linearDamping;

      // Clamp velocity
      const vel = Math.hypot(this.vx[index], this.vy[index]);
      if (vel > MAX_VELOCITY) {
        this.vx[index] *= MAX_VELOCITY / vel;
        this.vy[index] *= MAX_VELOCITY / vel;
      }

      this.x[index] += (this.vx[index] + this.dispX[index]) * delta;
      this.y[index] += (this.vy[index] + this.dispY[index]) * delta;

      // Angular
      const targetAngle = home.angle + this.angularVelocity[index] * 0.03;
      this.angularVelocity[index] += angleDelta(targetAngle, this.angle[index]) * (2.2 + mid * 4) * delta;
      this.angularVelocity[index] *= angularDamping;
      this.angle[index] += this.angularVelocity[index] * delta;

      // Safety boundary
      const safeRadius = Math.hypot(this.x[index], this.y[index]);
      if (safeRadius > 1.75) {
        const scale = 1.75 / safeRadius;
        this.x[index] *= scale;
        this.y[index] *= scale;
        this.vx[index] *= -0.22;
        this.vy[index] *= -0.22;
      }
    }
  }

  /**
   * Drum Magnetic Repulsion:
   * - Lows (bass drum): outward blast from central axis to outer periphery.
   * - Mids (soft drum / snare): outward repulsion with subtle angular dispersion.
   */
  private applyBurst(
    settings: MagneticApertureSettings,
    features: AudioFeatureFrame,
    type: "bass" | "mid",
  ) {
    const isBass = type === "bass";
    const effReaction = settings.overallReaction * 0.40;
    const strength = BURST_BASE * (0.35 + effReaction * 0.65) * settings.burstStrength *
      (isBass ? (0.7 + features.bass.fast * 1.3) : (0.5 + features.mid.fast * 1.0));

    for (let index = 0; index < this.activeCount; index += 1) {
      const family = this.family[index];
      const familyMult = isBass
        ? (family === 0 ? 1.15 : 0.9)
        : (family === 1 ? 1.1 : 0.85);

      const r = Math.max(0.03, Math.hypot(this.x[index], this.y[index]));
      const nx = this.x[index] / r;
      const ny = this.y[index] / r;
      const variation = 0.75 + hash(index, 12) * 0.5;

      if (isBass) {
        // Lows: explosive outward radial repulsion towards periphery
        const blast = strength * settings.burstRadial * familyMult * variation;
        this.vx[index] += nx * blast;
        this.vy[index] += ny * blast;
        this.angularVelocity[index] +=
          settings.rotationDirection * strength * 0.35 * (hash(index, 13) - 0.5);
      } else {
        // Mids: punchy radial repulsion towards periphery
        const perpX = -ny;
        const perpY =  nx;
        const angularJerk = (hash(index, 19) - 0.5) * 0.45;
        const blast = strength * settings.burstRadial * 0.85 * familyMult * variation;
        this.vx[index] += (nx * 0.88 + perpX * angularJerk) * blast;
        this.vy[index] += (ny * 0.88 + perpY * angularJerk) * blast;
        this.angularVelocity[index] +=
          angularJerk * settings.rotationDirection * strength * 0.6;
      }
    }
  }

  /**
   * Guitar riff / Highs onset:
   * - Dramatic instant scale pop on circles / particles.
   * - Sudden elongation along the trajectory (pluck effect).
   * - High-frequency outward micro-flick.
   */
  private applyGuitarRiffAndTreble(settings: MagneticApertureSettings, features: AudioFeatureFrame) {
    const effReaction = settings.overallReaction * 0.40;
    const high = features.high.energy * effReaction;
    for (let index = 0; index < this.activeCount; index += 1) {
      const family = this.family[index];
      // Instant dramatic scale jump on guitar riff:
      const scalePunch = family === 2 ? (2.2 + high * 2.8) : (1.3 + high * 1.5);
      this.dynScale[index] = Math.max(this.dynScale[index], scalePunch);

      // Elongation along velocity vector
      const impulse = family === 2
        ? (2.8 + high * 3.6) * (0.8 + hash(index, 17) * 0.5)
        : (1.0 + high * 1.6) * hash(index, 17);
      this.elongation[index] = Math.min(5.0, this.elongation[index] + impulse);

      // Treble micro-flick
      if (family === 2) {
        const r = Math.max(0.03, Math.hypot(this.x[index], this.y[index]));
        const flick = (0.7 + high * 1.5);
        this.dispX[index] += (this.x[index] / r) * flick * (hash(index, 23) * 0.6 + 0.4);
        this.dispY[index] += (this.y[index] / r) * flick * (hash(index, 24) * 0.6 + 0.4);
      }
    }
  }

  private render(settings: MagneticApertureSettings, features: AudioFeatureFrame) {
    const gl = this.gl;
    const aspect = this.cssWidth / this.cssHeight;
    let bassColor: readonly [number, number, number];
    let midColor: readonly [number, number, number];
    let highColor: readonly [number, number, number];

    if (settings.palette === "crimson-white") {
      // Strong 2-color White & Red palette:
      // Lows (Bass Kick / inner ring): Pure Crisp White
      // Mids (Vocals / Snare): Vivid Crimson Red
      // Highs (Guitar Riff / Treble): Radiant White
      bassColor = [0.98, 0.98, 1.0] as const;
      midColor  = [0.94, 0.08, 0.18] as const;
      highColor = [1.0, 0.96, 0.96] as const;
    } else {
      const paletteOffset = settings.palette === "aurora" ? -45 : settings.palette === "ember" ? 78 : 0;
      const lightness = clamp(0.54 * settings.brightness, 0.18, 0.82);
      bassColor = hslToRgb(settings.bassHue + settings.hueShift + paletteOffset, settings.saturation, lightness);
      midColor  = hslToRgb(settings.midHue  + settings.hueShift + paletteOffset, settings.saturation, lightness);
      highColor = hslToRgb(settings.highHue  + settings.hueShift + paletteOffset, settings.saturation * 0.9, Math.min(0.88, lightness + 0.12));
    }

    const themeIdx = settings.backdropTheme === "purple-red"
      ? 0
      : settings.backdropTheme === "green-blue"
      ? 1
      : settings.backdropTheme === "earth-brown"
      ? 2
      : 3;
    const routedBass = settings.bassReactive ? features.bass.energy : 0;
    const routedMid = settings.midReactive ? features.mid.energy : 0;
    const routedHigh = settings.highReactive ? features.high.energy : 0;
    const energy = features.hasSignal ? (routedBass + routedMid + routedHigh) / 3 : 0;

    // ── 0. Aurora Atmospheric Backdrop Pass ─────────────────────────
    gl.disable(gl.BLEND);
    if (
      (settings.backdropVisible && settings.backdropIntensity > 0.001) ||
      this.bassBloomStrength > 0.001 ||
      this.bassWaveStrength > 0.001 ||
      routedBass > 0.001
    ) {
      gl.useProgram(this.backdropProgram);
      gl.bindVertexArray(this.backdropVao);
      gl.uniform1f(gl.getUniformLocation(this.backdropProgram, "uTime"), this.lastTime / 1000);
      gl.uniform1i(gl.getUniformLocation(this.backdropProgram, "uTheme"), themeIdx);
      gl.uniform1f(
        gl.getUniformLocation(this.backdropProgram, "uIntensity"),
        settings.backdropVisible ? settings.backdropIntensity : 0,
      );
      gl.uniform1f(gl.getUniformLocation(this.backdropProgram, "uEnergy"), energy);
      gl.uniform1f(gl.getUniformLocation(this.backdropProgram, "uAspect"), aspect);
      gl.uniform1f(
        gl.getUniformLocation(this.backdropProgram, "uBassBloom"),
        clamp(this.bassBloomStrength + routedBass * settings.bassBloom * 0.16, 0, 2.5),
      );
      gl.uniform1f(gl.getUniformLocation(this.backdropProgram, "uBassWaveAge"), this.bassWaveAge);
      gl.uniform1f(
        gl.getUniformLocation(this.backdropProgram, "uBassWaveStrength"),
        clamp(this.bassWaveStrength, 0, 2.5),
      );
      gl.uniform3f(
        gl.getUniformLocation(this.backdropProgram, "uBassColor"),
        bassColor[0], bassColor[1], bassColor[2],
      );
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      gl.bindVertexArray(null);
    } else {
      gl.clearColor(0.014, 0.014, 0.018, 1.0);
      gl.clear(gl.COLOR_BUFFER_BIT);
    }

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    // ── 1. Central Amoeba Contour Strings Pass ───────────────────────
    if (settings.contourVisible && settings.contourRings > 0) {
      gl.useProgram(this.contourProgram);
      gl.bindVertexArray(this.contourVao);
      gl.uniform1f(gl.getUniformLocation(this.contourProgram, "uAspect"), aspect);
      gl.uniform1f(gl.getUniformLocation(this.contourProgram, "uZoom"), settings.zoom);
      gl.uniform2f(gl.getUniformLocation(this.contourProgram, "uCenter"), settings.centerX, settings.centerY);
      gl.uniform1i(gl.getUniformLocation(this.contourProgram, "uRingCount"), Math.round(settings.contourRings));
      gl.uniform1f(gl.getUniformLocation(this.contourProgram, "uDeformation"), settings.contourDeformation);
      gl.uniform1f(gl.getUniformLocation(this.contourProgram, "uTime"), this.lastTime / 1000);
      gl.uniform1f(gl.getUniformLocation(this.contourProgram, "uContourAngle"), this.contourAngle);
      gl.uniform4f(
        gl.getUniformLocation(this.contourProgram, "uHarmonics"),
        this.harmonicAmps[0],
        this.harmonicAmps[1],
        this.harmonicAmps[2],
        this.harmonicAmps[3],
      );
      gl.uniform4f(
        gl.getUniformLocation(this.contourProgram, "uHarmonicPhases"),
        this.harmonicPhases[0],
        this.harmonicPhases[1],
        this.harmonicPhases[2],
        this.harmonicPhases[3],
      );
      gl.uniform1f(
        gl.getUniformLocation(this.contourProgram, "uBeatExpansion"),
        this.contourBeatExpansion,
      );
      gl.uniform1f(
        gl.getUniformLocation(this.contourProgram, "uBeatRippleAge"),
        this.contourBeatRippleAge,
      );
      const spectrumHigh = Math.min(12_000, features.sampleRate * 0.48 || 12_000);
      const spectrumRange = Math.log(spectrumHigh / 30);
      for (let index = 0; index < this.routedSpectrum.length; index += 1) {
        const frequency = 30 * Math.exp(spectrumRange * ((index + 0.5) / this.routedSpectrum.length));
        const enabled = frequency < settings.bassMidCrossover
          ? settings.bassReactive
          : frequency < settings.midHighCrossover
            ? settings.midReactive
            : settings.highReactive;
        this.routedSpectrum[index] = enabled ? features.spectrum[index] : 0;
      }
      gl.uniform1fv(
        gl.getUniformLocation(this.contourProgram, "uSpectrum[0]"),
        this.routedSpectrum,
      );
      gl.uniform1f(
        gl.getUniformLocation(this.contourProgram, "uSpectrumStrength"),
        clamp(
          settings.spectralDetail * settings.overallReaction *
            (0.28 + features.spectralFlux * 1.6 + features.spectralFlatness * 0.32),
          0,
          4.5,
        ),
      );
      gl.uniform3f(gl.getUniformLocation(this.contourProgram, "uContourColor"), midColor[0], midColor[1], midColor[2]);
      gl.uniform1f(gl.getUniformLocation(this.contourProgram, "uGlow"), settings.glow);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      gl.bindVertexArray(null);
    }

    // ── 2. Instanced Particle Pass ──────────────────────────────────
    this.writeInstances(settings, features);
    gl.useProgram(this.pieceProgram);
    gl.bindVertexArray(this.pieceVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceBuffer);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.instanceData, 0, this.drawnCount * INSTANCE_STRIDE);
    gl.uniform1f(gl.getUniformLocation(this.pieceProgram, "uAspect"), aspect);
    gl.uniform1f(gl.getUniformLocation(this.pieceProgram, "uZoom"), settings.zoom);
    gl.uniform2f(gl.getUniformLocation(this.pieceProgram, "uCenter"), settings.centerX, settings.centerY);
    gl.uniform3f(gl.getUniformLocation(this.pieceProgram, "uBassColor"), bassColor[0], bassColor[1], bassColor[2]);
    gl.uniform3f(gl.getUniformLocation(this.pieceProgram, "uMidColor"),  midColor[0],  midColor[1],  midColor[2]);
    gl.uniform3f(gl.getUniformLocation(this.pieceProgram, "uHighColor"), highColor[0], highColor[1], highColor[2]);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, this.drawnCount);
    gl.bindVertexArray(null);
  }

  private writeInstances(settings: MagneticApertureSettings, features: AudioFeatureFrame) {
    let drawn = 0;
    const shapeIdx = SHAPE_INDEX[settings.particleShape] ?? 0;
    for (let index = 0; index < this.activeCount; index += 1) {
      const family = this.family[index];
      const visible =
        family === 0 ? settings.bassVisible : family === 1 ? settings.midVisible : settings.highVisible;
      if (!visible || this.visibility[index] > settings.density) continue;
      const energy = family === 0
        ? (settings.bassReactive ? features.bass.energy : 0)
        : family === 1
          ? (settings.midReactive ? features.mid.energy : 0)
          : (settings.highReactive ? features.high.energy : 0);
      const base = drawn * INSTANCE_STRIDE;
      const sizeVariation = 1 + (this.baseSize[index] - 1) * settings.sizeVariation;

      // Dynamic scale (guitar riff / treble / energy driven size pop)
      const dynS = this.dynScale[index];

      // Elongation multiplier on long axis (guitar pluck / hi-hat)
      const textureStretch = family === 2
        ? 1 + features.spectralFlatness * energy * 1.4
        : 1 + features.spectralFlatness * energy * 0.35;
      const pluck = (1 + this.elongation[index]) * textureStretch;

      let widthRatio: number;
      if (settings.particleShape === "dash") {
        widthRatio = 0.09 + hash(index, 15) * 0.06;
      } else if (settings.particleShape === "circle") {
        widthRatio = 1.0;
      } else if (settings.particleShape === "pill") {
        const shapeSeed = hash(index, 14);
        widthRatio = shapeSeed < 0.5 ? 0.40 + hash(index, 15) * 0.18 : 0.20 + hash(index, 15) * 0.12;
      } else {
        // diamond
        widthRatio = 0.45 + hash(index, 15) * 0.25;
      }

      const baseRadius = (0.006 + this.depth[index] * 0.008) * sizeVariation * dynS;
      const isCircle = settings.particleShape === "circle";
      const halfLength = baseRadius * this.smoothedPieceLength * (isCircle ? 1 : pluck);
      const halfWidth = baseRadius * this.smoothedPieceWidth * widthRatio;

      this.instanceData[base]     = this.x[index];
      this.instanceData[base + 1] = this.y[index];
      this.instanceData[base + 2] = halfLength;
      this.instanceData[base + 3] = halfWidth;
      this.instanceData[base + 4] = this.angle[index];
      this.instanceData[base + 5] = this.depth[index] * settings.depth + (1 - settings.depth) * 0.7;
      this.instanceData[base + 6] = family;
      this.instanceData[base + 7] = energy;
      this.instanceData[base + 8] = shapeIdx;
      drawn += 1;
    }
    this.drawnCount = drawn;
  }

  private measureDiagnostics(time: number, settings: MagneticApertureSettings) {
    this.frameCounter += 1;
    if (!this.diagnosticsStart) this.diagnosticsStart = time;
    if (time - this.lastDiagnostics < 200) return;
    const elapsed = Math.max(1, time - this.diagnosticsStart);
    const fps = Math.round(this.frameCounter * 1000 / elapsed);
    if (settings.diagnostics && this.lastFeatures) {
      this.options.onDiagnostics?.({
        bass: this.lastFeatures.bass.energy,
        mid: this.lastFeatures.mid.energy,
        high: this.lastFeatures.high.energy,
        bassOnset: this.bassOnsetSeen,
        midOnset: this.midOnsetSeen,
        highOnset: this.highOnsetSeen,
        centroid: this.lastFeatures.spectralCentroid,
        texture: this.lastFeatures.spectralFlatness,
        pullActive: this.lastFeatures.pullActive,
        released: this.releaseSeen,
        particles: this.drawnCount,
        fps,
        frameTime: this.lastFrameMs,
        renderer: "WebGL2 · SDF particles",
      });
    }
    this.bassOnsetSeen = false;
    this.midOnsetSeen = false;
    this.highOnsetSeen = false;
    this.releaseSeen = false;
    this.lastDiagnostics = time;
    if (elapsed >= 1000) {
      this.frameCounter = 0;
      this.diagnosticsStart = time;
    }
  }

  destroy() {
    this.disposed = true;
    cancelAnimationFrame(this.animationFrame);
    this.animationFrame = 0;
    this.resizeObserver?.disconnect();
    document.removeEventListener("visibilitychange", this.handleVisibility);
    this.gl.deleteProgram(this.pieceProgram);
    this.gl.deleteBuffer(this.pieceCornerBuffer);
    this.gl.deleteBuffer(this.instanceBuffer);
    this.gl.deleteVertexArray(this.pieceVao);
    this.gl.deleteProgram(this.contourProgram);
    this.gl.deleteBuffer(this.contourQuadBuffer);
    this.gl.deleteVertexArray(this.contourVao);
    this.gl.deleteProgram(this.backdropProgram);
    this.gl.deleteBuffer(this.backdropQuadBuffer);
    this.gl.deleteVertexArray(this.backdropVao);
  }
}
