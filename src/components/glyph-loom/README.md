# Glyph Loom

Glyph Loom is a browser-based research instrument for reconstructing type from repeated geometric modules. It lives at `/research/glyph-loom` as a React + TypeScript island inside the existing Astro/Vite site. There is no backend: fonts, presets, scene generation, animation, rendering, and export all run locally in the browser.

## Pipeline

The tool deliberately separates the source glyph from its visual treatment:

1. `engine/glyph` loads the bundled open-source Inconsolata font through `opentype.js`, or parses a local TTF/OTF/WOFF selected by the user. Uploaded files never leave the device.
2. `engine/mask` normalises the outline into a square offscreen Canvas, then stores only sampled alpha values. Fill, outline, and edge modes are transformations of this cached mask.
3. `engine/sampling` produces regular, offset, checker, jittered, or contour-aware coordinates. Every point receives mask coverage and is filtered against the selected threshold.
4. `engine/modules` replaces accepted points with serialisable `ModuleInstance` records. The module records—not either renderer—are the source of truth.
5. `engine/deformation` applies reproducible variation.
6. `engine/animation` returns a time-dependent transform without mutating the scene.
7. `engine/renderers` draws that same scene to Canvas or writes it as actual SVG geometry.

## Glyph mask

`createGlyphMask` asks `opentype.js` for each character path, measures the combined bounds, scales the result into a normalised sampling canvas, and draws it once. The cache key contains only text and font inputs, so changing motion, colour, or module parameters does not redraw the font. Fill mode uses alpha directly. Edge and outline modes compare neighbouring alpha samples to estimate a local boundary.

## Grid sampling

`generateGridCoordinates` creates a geometry-only point field. Offset grids shift alternating rows; checker grids discard alternating parity; jittered grids use the seeded generator; contour grids estimate an alpha gradient around every candidate and rotate modules along the tangent. `sampleGlyphMask` then filters candidates by mask coverage, keeping sampling independent from module style.

## Module replacement and woven rules

`generateScene` maps sampled points to modules. Each instance records its id, glyph index, row, column, position, dimensions, rotation, opacity, primitive, colours, stroke, and animation phase. Woven orientation is a pure parity rule: even `(row + column)` cells are horizontal and odd cells are vertical. Bar length is controlled by aspect ratio and defaults to three times thickness. Scene order is sorted from the selected even/odd over-under rule.

The Fabric Specimen layout uses proportions measured from a 2048 × 1406 reference rather than fixed output pixels. Its large panel includes a six-step `initialScale × 0.73^index` progression and reserves an open band between its upper and lower glyph families.

## Seeded randomness

`math/random.ts` implements Mulberry32. Every scene-affecting random value derives from the user-visible seed plus a stable module index; no render path calls `Math.random`. A seed and unchanged settings therefore rebuild the same scene. The R shortcut changes only the seed.

## Seamless looping

Animations are pure functions of scene, settings, and time. Periodic modes use sine and normalised loop progress. The noise-drift mode samples 4D simplex noise with circular time coordinates `(cos θ, sin θ)`, so time zero and the loop duration address the same point in noise space. Canvas animation updates transforms only; it does not rebuild the scene.

## Adding a module style

1. Add the primitive name to `PrimitiveType` in `types.ts`.
2. Map the name in `modulePrimitive` and expose it in `ControlPanel.tsx`.
3. Implement the shape in both `drawCanvasPrimitive` and `svgPrimitive`.
4. Add a small deterministic test if the style introduces a mathematical rule.

## Adding an animation mode

1. Add the name to `AnimationMode`.
2. Expose it in the Motion selector.
3. Add one pure case to `animateModule`. Use `loopProgress` or circular noise coordinates for a seamless mode.
4. Verify that transforms match at time `0` and `loopDuration`.

## Adding a layout preset

Simple product presets belong in `presets/index.ts` and can override any subset of `DEFAULT_SETTINGS`. A layout with new spatial rules should return panels and module families from `generateScene.ts`. Keep spatial measurements normalised against `canvasWidth` and `canvasHeight`.

## Tests and exports

`npm run test:glyph-loom` covers seeded reproducibility, scale progression, grid coordinates, woven alternation, wave periodicity, seamless endpoints, distance stagger, and scene round-tripping. SVG output contains vector primitives and no embedded raster image. PNG is redrawn at the selected resolution, JSON includes both settings and the serialised scene, and WebM records the live Canvas stream.

