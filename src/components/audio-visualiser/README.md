# Audio Visualiser

The visualiser has five deliberately separate layers:

- `AudioSourceManager.ts` owns the single `AudioContext`, local media playback,
  microphone and display capture, and source cleanup. Live microphone input is
  analysed in-browser without being connected to the speakers, recorded, or
  uploaded. The device selector follows the system default or switches the live
  stream to any connected microphone; browser privacy rules mean device names
  become available only after microphone permission is granted.
- `audioAnalysis.ts` converts the newest analyser frame into logarithmic bars for
  the original scene. `AudioFeatureProcessor.ts` reads the analyser once per
  Magnetic Aperture frame and publishes bass, mid, high, transient, onset,
  spectral-centroid, spectral-texture, spectral-flux, pull, and release features
  using the real sample rate and FFT bins.
- `WaveformRenderer.ts` applies time-based attack/release smoothing and draws the
  original scene in one Canvas 2D animation loop.
- `MagneticApertureRenderer.ts` owns a fixed-step particle simulation and a
  WebGL2 instanced renderer. Particle state and GPU upload arrays are
  preallocated; solid square/rectangle pieces are drawn in one instanced batch,
  and no DOM particle nodes are created. The centre is a black occluding shape
  without a separate outline or rim pass.
- `AudioVisualiserApp.tsx` owns controls and infrequent UI state only. It never
  receives per-frame particle state. `MagneticControlsV2.tsx` separates friendly
  Basic controls, compositional Advanced controls, and raw Hyper micro-controls.

Magnetic Aperture routes sound by visual meaning rather than applying every band
to everything. Bass drives the central bloom, pressure wave, and radial impact;
mids articulate the petal contour, twist, and orbit; highs carve 24-band edge
detail and add shimmer/sparks. Impacts, sustained energy, and slow atmosphere
have independent timing, so a kick can strike immediately without forcing the
whole field to flicker. Disabling a band now disables its entire visual route.

Both scenes share the same `AudioSourceManager`, `AudioContext`, and analyser.
Only the selected renderer runs. Magnetic settings are saved as a versioned
local preset and sanitised on load; the render order is background → particles
→ black aperture → rim/guide, leaving a clean insertion point for future
timeline-driven property evaluation. The property contract is manual base value
→ optional future keyframe override → audio modulation → safety clamp → fixed-step
simulation → render.

The header's full-screen action requests browser full screen with navigation UI
hidden. While active, every interface layer is removed so only the selected
canvas remains; `Escape` exits and restores the controls.
