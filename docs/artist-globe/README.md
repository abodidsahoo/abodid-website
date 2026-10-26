# Art in Every Corner

Route: https://abodid.com/lab/art-in-every-corner

A standalone Astro lab experiment using a lazy-loaded Three.js scene and a React interface. Page-local styling uses the saved cream, ink, cobalt, pink, yellow and lime tokens. No global header/footer styles are changed.

## Add an artist

In the existing `abodid-website` Supabase project, open **Table Editor → art_globe_artists**. Insert one row per artist:

- `id`: your own unique text ID; never reuse an existing ID.
- `name`, `current_city`, `country`, `latitude`, `longitude`: required. Use decimal coordinates, south/west negative.
- `disciplines`, `tags`, `artwork_urls`, `sources`: arrays, e.g. `["Ceramics", "Installation"]` in JSON import or `{"Ceramics","Installation"}` in PostgreSQL array syntax.
- `origin`, `biography`, `artist_statement`: plain text.
- `portfolio_url`, `instagram_url`: full HTTPS links; `public_email`: publicly listed professional email only.
- `artwork_urls`: up to four images displayed, only use URLs you have permission to display. Blank arrays produce no gallery placeholders. Broken images are removed.
- `sources`: publicly available verification links; displayed in the profile.
- `is_demo`: **false** for your real records, true for fictional demonstration records.
- `published`: **true** to show the profile. New rows default to false while you prepare them.

The 18 `demo-…` rows are entirely fictional and marked individually. To retire them, set `published=false` on those rows once at least one real published artist is available. Nothing needs deleting. The API caches records for 60 seconds and may serve the previous response for up to five minutes while refreshing. Maximum current response size: 1,000 profiles.

## Data path and permissions

`GET /api/artist-globe/artists` reads explicit public-facing columns and only `published=true` rows. Existing server-only Supabase environment configuration is reused. No credentials are sent to the browser. Table RLS allows anonymous/authenticated SELECT of published rows only; public insert/update/delete is revoked. Maintain records through the Supabase dashboard or an administrative service.

The local fictional dataset is the fallback when the table is empty, invalid, unreachable, or server credentials are absent. Thus an all-unpublished table intentionally shows the demo atlas, not a blank page. Every fallback record remains labelled demo. `schema.sql` records the single additive schema change; `seed.sql` adds the demos without overwriting existing IDs. Both were applied to the existing project on 26 October 2026.

## Interaction

- Mouse/touch drag rotates with damping and inertia; two fingers pinch to zoom. The dedicated globe canvas captures gestures; the surrounding page and artist story scroll normally.
- Wheel and +/- buttons zoom within a camera radius of 3.2–4.6. Keyboard arrows rotate; +/- zoom when the canvas has focus.
- Marker buttons expose hover/focus tooltips. The searchable artist index provides a non-spatial keyboard and touch alternative, including artists on the far side.
- Selecting a marker opens a profile; pin reserves space for it on desktop. Escape or Close dismisses it; an unpinned profile also closes when clicking the globe background. Mobile details are a sheet in document flow beneath the globe: identity first, story below by scrolling.
- Each initial view is random; selection through the index or surprise button moves smoothly toward that artist.
- Rotation pauses during direct manipulation. The auto-rotate control can re-enable it. Reduced-motion disables initial automatic rotation and wobble; explicitly choosing Auto rotate can start rotation; hidden/offscreen rendering pauses. WebGL failure leaves a working artist directory.

## Geography and performance

`public/data/artist-globe/land.json` is rounded 110m land polygon geometry from [Natural Earth](https://www.naturalearthdata.com/about/terms-of-use/) via [natural-earth-vector](https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_110m_land.geojson), public domain. This is a cultural discovery interface, not a political boundary map. Original multi-ring polygon geometry is preserved, with coordinates rounded to two decimals (~76 KB uncompressed). A local 2048×1024 canvas texture is generated once; no satellite textures or remote runtime map API is used. Markers use one instanced mesh with accessible projected buttons and front-side occlusion. Pixel ratio is capped at 1.75. All geometries, materials, texture, listeners, observers and renderer are disposed on unmount.

No artwork is bundled with the fictional profiles. No artist research, AI extraction or discovery schedule runs.

## Validation

`npx vitest run tests/artist-globe/data.test.ts`

`npx playwright test tests/artist-globe/globe.spec.ts --workers=1`

`npm run build` (Node 24, as required by the repository)

The browser suite covers marker interactions, pin/unpin sizing and dismissal, search, keyboard and drag interaction, wheel extremes, reduced motion, WebGL fallback, and nine viewport widths from 320px to 1440px, simulated mobile drag and pinch gestures, and long-content pressure. All 14 browser tests and 4 data/geography tests passed. The Astro production build passed. The repository-wide TypeScript check still reports existing errors elsewhere; there are no diagnostics in the new atlas files. Physical-device performance remains dependent on the device GPU; browser automation does not certify every mobile browser.
