# Audio Visualiser

The visualiser has five deliberately separate layers:

- `AudioSourceManager.ts` owns the single `AudioContext`, local media playback,
  display capture, and source cleanup.
- `audioAnalysis.ts` converts the newest analyser frame into logarithmic bars for
  the original scene. `AudioFeatureProcessor.ts` reads the analyser once per
  Magnetic Aperture frame and publishes reusable bass, mid, high, onset,
  falling, pull, and release features using the real sample rate and FFT bins.
- `WaveformRenderer.ts` applies time-based attack/release smoothing and draws the
  original scene in one Canvas 2D animation loop.
- `MagneticApertureRenderer.ts` owns a fixed-step particle simulation and a
  WebGL2 instanced renderer. Particle state and GPU upload arrays are
  preallocated; solid square/rectangle pieces are drawn in one instanced batch,
  and no DOM particle nodes are created. The centre is a black occluding shape
  without a separate outline or rim pass.
- `AudioVisualiserApp.tsx` owns controls and infrequent UI state only. It never
  receives per-frame particle state. `MagneticControls.tsx` leads with the three
  musical forces and a compact look/movement section, then progressively reveals
  only motion, shape, and crossover refinements.

Both scenes share the same `AudioSourceManager`, `AudioContext`, and analyser.
Only the selected renderer runs. Magnetic settings are saved as a versioned
local preset and sanitised on load; the render order is background → particles
→ black aperture → rim/guide, leaving a clean insertion point for future
timeline-driven property evaluation. The property contract is manual base value
→ optional future keyframe override → audio modulation → safety clamp → fixed-step
simulation → render.
