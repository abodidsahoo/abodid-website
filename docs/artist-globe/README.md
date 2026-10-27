# Art in Every Corner

Local preview: http://localhost:4321/lab/art-in-every-corner

An Astro/React atlas with a Three.js globe. Public route: https://abodid.com/lab/art-in-every-corner. The user authorized committing, deploying and publishing the imported profiles on 27 October 2026. The Lab project story lives at `/lab/art-in-every-corner/about`.

## Current interface

On laptops/desktops the entire interface fits the viewport: a single-line title and two independent rectangles of equal height. The profile's own body can scroll for long content. Phones and portrait tablets keep the globe first and allow normal page scrolling so the profile remains usable. No nomination, leaderboard, or footer is rendered. Their existing backend endpoints and tables remain intact for later development.

The permanent card shows the artist name, country, city, a specific practice when supplied, and labeled underlined links. Biographies, tags and sample statements are not displayed. Links are provided only when the data contains them; institutional profiles and exhibition sources are not described as personal portfolios. Every research profile is now shown on the preview map; city- and country-level approximate placements are labeled.

The top-right globe menu toggles country names and city/place names independently and opens the artist index. The index uses a native modal dialog with a dark backdrop, native focus containment and Escape dismissal, an explicit close button, a persistent search field, and an independently scrollable card list. Search supports accents, partial text, small spelling errors, and country aliases; it searches names, city/country, practices, tags, and biographies locally.

A rounded 3D die replaces the text discovery button in the lower-right of the globe, beneath the coordinate counters. Click, tap, keyboard-activate, or flick it to discover another artist. Its locally generated Three.js model uses a rounded box, shallow pips, glossy plastic and studio lighting; it needs no remote model or textures. Flicks set the tumble direction and horizontal globe spin direction. Both settle after 2.8 seconds, with the new artist at the crosshair. Globe discovery retains a consistent circular longitude path and monotonic latitude interpolation without axial wobble. Reduced-motion users land directly. The die renders only while manipulated or rolling and releases GPU resources on unmount; a static die keeps the button usable if its renderer is unavailable.

The die uses the clickable finger cursor when idle and the normal arrow while pressed, dragged, loading or rolling; no grab hand or waiting spinner is used. When the roll finishes, a pointer still over the button becomes clickable again automatically. Release velocity sampled from the recent gesture controls tumble strength: faster flicks add revolutions and lift, while click-only discovery keeps its existing three-revolution tumble. Both finish within the same 2.8 seconds.

The small die canvas renders at 2–3× resolution and downsamples to its 112px button. Supersampling replaces transparent MSAA edge resolution to remove the dark edge speckles. Denser rounded geometry, smoother pips and a tighter clearcoat highlight give the plastic a polished finish. Rendering still sleeps while idle.

## Artist data and the CSV import

Use the existing Supabase project **abodid-website**, table **public.art_globe_artists**. No additional artist table was created. One row contains each artist's independent columns:

- `id`: unique text ID. `artist_number` is generated automatically and remains internal.
- `name`, `current_city`, `country`, `origin`, `latitude`, `longitude`: artist identity and documented city-level coordinates; unknown coordinates stay null.
- `disciplines`, `tags`, `artwork_urls`, `sources`: arrays. Tags are searchable but not displayed as chips.
- `biography`, `artist_statement`: text; the statement remains stored but is not shown in the current interface.
- `portfolio_url`, `instagram_url`, `public_email`: optional public contact links. The original CSV had no Instagram URLs or emails; the enriched list now supplies 47 Instagram URLs and 29 public professional emails, with evidence retained.
- `published`, `nomination_status`, `is_demo`: publication and review controls.
- `map_pin_ready`, `verification_status`, `research_notes`, `researched_on`: the additive research-provenance columns introduced by migration `artist_atlas_research_provenance`.

The source `global_artist_atlas_216_research_candidates_2026-10-26.csv` has 216 distinct artists. All 216 were inserted with `atlas-csv-ART-…` IDs, `published=false`, `nomination_status=pending`, and `is_demo=false`. Only 30 are marked `map_pin_ready=yes` in the supplied research. Another 37 have city coordinates pending review; 149 have no artist coordinates. None of the CSV's proxy research locations is used as an artist pin. Artist associations and sources are preserved without claiming independent re-verification.

Production queries still read only published rows. Development additionally reads only the namespaced CSV drafts and omits demos when research records exist. It returns all 216 profiles for the local index and maps all 216 profiles using the preview placement policy below. A server-only local snapshot supports preview if the database is unavailable. No draft snapshot is imported into the browser bundle. Imported drafts remain hidden by the existing RLS policy, which allows public reads only where `published=true`.

The 18 pre-existing demo records were preserved unchanged. New records were inserted with `ON CONFLICT (id) DO NOTHING`; no artist or unrelated record was deleted or overwritten. The initial import required exact coordinates before publication. The public-release migration now permits approved or curated profiles with country-level placement; pending nominations still cannot be published. Coordinate verification and publication approval remain separate.

To regenerate the prepared snapshot without changing any database:

```sh
python3 scripts/prepare-artist-atlas-import.py \
  --csv /path/to/global_artist_atlas_216_research_candidates_2026-10-26.csv \
  --output src/data/artist-globe/research-candidates.json
```

The input SHA-256 was `3a224e09805018e346d849f3f94ebc7ba74d3dec7fd45971b8b2ba791c6c5408`. The import was verified by counting 216 drafts, 30 pin-ready records, 37 review locations, and 149 null locations. Existing RLS and grants were preserved. Project-wide security advisors include unrelated existing notices; the artist table's public policy was separately checked for `published=true`.

## Globe and label behavior

Dragging feeds a critically damped angular spring with frame-time-based integration. It starts pulling immediately, accelerates gently, and settles without a visible step. Release adds a short decaying coast; reduced motion uses direct dragging. Dragging now uses simple north-up yaw and pitch everywhere, with latitude constrained to ±85°. Rim-specific roll has been removed. Elastic acceleration and short release inertia remain.

Zoom works inside the globe through wheel, touch/trackpad pinch, buttons, and +/- keys. Camera radius is bounded to 2.13–5.4 Earth radii: the close limit adds approximately 10% magnification over the prior 2.3 limit; the widest planet stays about 55% of the viewport height. This is a stylized globe, with no streets, buildings, or remote tiles.

Country labels are the primary tier, in mixed-case normal-weight text on translucent yellow. The country containing the actual crosshair direction gets first collision priority, before retained neighboring labels. Country containment uses simplified Natural Earth polygons, not proximity to a country label anchor. A shore-only tolerance of approximately 6km accommodates city centroids just beyond the simplified coast. Bounding boxes are cached so the lookup does not scan every polygon vertex during each frame. Where enabled and visible, that country's label is always admitted first. Country labels disappear above 4.75 radii (4.9 for retained entries); state labels appear below 2.85 radii and cities below 2.65. At the widest view, only artist dots remain. The small crosshair and rings are preserved.

Labels keep persistent elements and fade in/out gradually. At most 20 labels are admitted; only active labels are projected every frame, with full collision layout at most every 160ms during motion. The loop sleeps when settled, hidden, or offscreen, and all resources and listeners are released on unmount. WebGL failure leaves profiles and the modal index available.

## Local geography and attribution

No MapLibre, OpenFreeMap, OpenMapTiles, remote map fonts, or tile requests are used.

- Land: public-domain [Natural Earth](https://www.naturalearthdata.com/about/terms-of-use/), 55,786 curved triangles and 30,480 shared quantized vertices. `node scripts/build-artist-globe-land.mjs` rebuilds the mesh from `land.json`.
- Country anchors, ranks and simplified containment polygons: [Natural Earth admin-0 1:50m](https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_50m_admin_0_countries.geojson), public domain; local `countries.json` and `country-regions.json`, 242 countries/territories. The coastlines are simplified at 0.08° tolerance, not survey boundaries. Rebuild with `python3 scripts/build-artist-globe-countries.py /path/to/ne_50m_admin_0_countries.geojson`.
- Regional labels: [Natural Earth admin-1](https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_10m_admin_1_states_provinces.geojson), public domain.
- City names (credited with a license link in the globe menu): [GeoNames](https://www.geonames.org/), CC BY 4.0. Regional/city labels are fetched only near the close zoom levels. Existing location autocomplete data remains available for the deferred nomination interface.

## Verification

```sh
npx vitest run tests/artist-globe --exclude '**/*.spec.ts'
npx playwright test tests/artist-globe/globe.spec.ts --workers=2
npm run build
```

Use Node 24 for the production build. Browser coverage includes 320–1920px layouts, laptop screen fitting, equal rectangles, actual UK crosshair containment, label toggles, layered place labels, elastic motion, consistent edge dragging and polar limits, discovery landing, modal search and scrolling, unmapped profiles, phone pinch, and WebGL fallback. Unit coverage includes production/draft separation, CSV provenance, country containment, search, frame-rate-independent motion, and the retained backend nomination protections. Full-repository TypeScript checking still has unrelated pre-existing errors; no atlas files appear in its diagnostics. Physical-device GPU performance remains outside automated certification.

## Enriched links update — 27 October 2026

The enriched source `global_artist_atlas_216_enriched_verified_links_2026-10-26.csv` updated the same 216 rows by ID, with name matching and an atomic comparison against each original row. It provides 115 website/profile URLs (official sites preferred), 47 Instagram URLs, 29 public professional emails, and 126 additional supporting source links. Evidence URLs, review status, re-geocoding flags, and research-quality caveats remain in `research_notes`; evidence URLs also remain in `sources`. No search-result URL was treated as a verified artist link.

The CSV also corrects 25 city entries and 10 country associations. Three coordinate pairs were cleared as required by the revised location evidence. The current preview therefore has 28 pin-ready records, 36 coordinate-bearing records pending review, and 152 records without usable coordinates. The 25 entries flagged for re-geocoding remain unpinned; no proxy coordinates were substituted. The original 30/37/149 counts above describe the first import, not the enriched revision.

All 216 remain unpublished and pending. Their IDs, permanent numbers, creation timestamps and original identities were preserved; no rows, policies or schemas were added or removed for this update. The local snapshot and importer support the enriched columns. Source SHA-256: `bfd63bf714ca4e979c544209202c27a59d43608aa96280b89ed801d7e853e433`. Pre-update row backup: `/tmp/artist-atlas-before-enrichment-20261027.json` (local only).

## All-profile localhost map — 27 October 2026

At the user's request, location verification no longer gates map visibility in the local preview. All 216 profiles are plotted and eligible for discovery. The 64 existing coordinate pairs are used as supplied, 22 further cities are matched against the local GeoNames snapshot, and the remaining 130 profiles use explicitly approximate country-level placements. Country-level points are deterministically distributed inside the country's main land polygon so a whole country's artists do not collapse into one dot. No research-city proxies are used as claimed artist locations.

`map-placement.ts` runs on the server in both development and production. The response includes `map_placement` (`city` or `country`) and retains original coordinates in `source_latitude`/`source_longitude`. It does not change any Supabase latitude, longitude, review, publication, or verification fields. Original import counts and verification flags elsewhere in this document describe stored research evidence, not the number of displayed pins. The imported collection displays 86 city-level and 130 country-level placements, with no awaiting-verification message.

Pins sharing city coordinates are visually fanned around their shared location; the selected pin stays at the crosshair. The fan contracts near the globe's rim. Every artist has a marker, while the globe naturally hides its rear hemisphere. The bottom-left readout shows the local clock, followed by “Designed and developed by Abodid Sahoo.” The name links to https://abodid.com/. Artist-count and “your local time” labels are omitted. The credit wraps on narrow screens to leave room for the coordinate counters, and its link remains interactive above the globe.

## Source-backed profile card — 27 October 2026

The right panel no longer renders biographies, generic exhibition-participation text, generic contemporary-art practice labels, or placement notices. It shows identity/location, a specific practice only when supplied, and available source-backed links. Instagram is first and displays its actual handle; website/profile and professional email follow. Shared roster URLs repeated across multiple artists are omitted from the card; artist-specific evidence remains available. Evidence and original biographies remain stored for reference/search.

**Learn more about [first name]** opens a Google search in a new tab using the artist's full name, country and specific practice; without a specific practice it searches the full name alone. The button label skips initial-only name tokens, using the next complete middle/last name (for example, “T. Vinoja” becomes “Learn more about Vinoja”). Its visible text is also its accessible name. External navigation uses `noopener noreferrer`. Map approximation disclosure is in the globe menu.

All 68 country/territory names in the dataset have a local PNG flag (27,490 bytes total). Source: [Flagpedia / FlagCDN](https://flagpedia.net/download), public-domain flags based on Wikimedia Commons, downloaded 27 October 2026. The 80px-wide originals are displayed with reserved 80×56px bounds below the globe settings button, using object-fit containment; the page makes no flag requests to third parties. Rebuild the cache with `python3 scripts/download-artist-atlas-flags.py`.

## Simplified navigation and card transitions — 27 October 2026

The coordinates sit directly below the country flag in a compact blue mechanical-counter housing with yellow directional knobs. Each axis has three cream digit drums, a degree mark and N/S/E/W, displaying whole-degree coordinates at the central pointer. Zero-padded digits give it a physical odometer appearance. The digit wheels use ten CSS 3D faces and short transform transitions, including carry/wrap changes, without repeated React renders or live screen-reader announcements. Reduced motion disables the drum transitions.

Latitude uses an up/down arrow, an `ns-resize` cursor and vertical dragging. Longitude uses a left/right arrow, an `ew-resize` cursor and horizontal dragging; vertical pulls do not change longitude. Both cursor directions remain in effect while adjusting. Pointer capture keeps a drag active outside the control. Hover-wheel scrolling remains available on either axis; a horizontal trackpad swipe over longitude also turns east/west. The controls prevent page zoom/scroll without changing the globe's zoom.

Accessible spinbutton values follow the rendered pointer position rather than a pending destination. Focused controls support arrow keys (1°), Page Up/Down (10°), and Home/End; latitude stays within ±85° and longitude wraps across the date line. Each row retains a 44px touch target and visible keyboard focus. The narrower phone housing hides the tiny LAT/LON captions while preserving accessible names. Phone globe frames have at least 400px of height to keep the flag, counters, die and local-clock credit clear of each other.

Camera navigation is fixed north-up yaw/pitch with a ±85° latitude limit. The earlier free-pole and edge-roll behavior is superseded by this user-requested simpler model. Dot-click and index-selection flights suppress intermediate nearest-artist card changes; the explicitly selected artist remains visible until the camera arrives. Discovery keeps the prior card until landing. A brief, subtle 150ms opacity refresh accompanies card changes and is skipped for reduced motion; rapid changes do not repeatedly restart the fade.

## Country-first profile hierarchy — 27 October 2026

The pink summary shows the artist name, a smaller regular-weight country name aligned to the same left edge, and the city on its own line underneath. The larger flag appears below the globe settings button instead of beside the country text. Country type uses bounded, font-relative sizing; unusually long country names can wrap rather than overflow small screens. The specific practice is in the cream body. A 24px gap and a thin rule separate practice content from the links only when that practice exists; otherwise no rule appears. Instagram, websites, professional email, and source links all use the same font size, weight, underline thickness and spacing. The Google search action remains a separate button.

## Public release and Lab project — 27 October 2026

The former production mismatch came from two development-only paths: imported `atlas-csv-*` profiles were visible locally before publication, and approximate map placements were only applied in development. Production now retains its `published=true` database query, filters out fictional demo records whenever real profiles are available, and applies the same presentation placements as localhost. The user-approved release sets `published=true` and `nomination_status=approved` on the 216 imported rows; source coordinates, verification status, pin-ready flags and research notes remain intact. Migration `20261027051216_allow_country_level_artist_publication.sql` retains the approval requirement and permits country-level placement when source coordinates are missing. RLS remains enabled with the existing published-profile SELECT policy.

The globe uses the shared `SiteHeader` through `BaseLayout`, with a flex layout that accounts for the header's actual height. Its own footer and newsletter popup remain hidden. The Lab entry leads to a project story about discovering and sharing artists beyond familiar art-world routes, with the current interactions and technical stack explained. Two cropped WebP screenshots show only the working globe and artist card. The 960×486 GIF cycles four actual artist views (Quito, Tashkent, Cape Town and Australia) and weighs about 308 KB; reduced-motion visitors receive a static WebP through `<picture>` instead. Published catalogue copy remains editable in Supabase.

The release was verified against the public API: 216 non-demo artist records match localhost exactly, with 86 city-level and 130 country-level presentation placements. The live globe renders all 216 markers. The 152 missing source coordinate pairs and 28 pin-ready flags are preserved.
