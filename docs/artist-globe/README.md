# Art in Every Corner

Live route: https://abodid.com/lab/art-in-every-corner

Astro page with a lazy-loaded Three.js faceted globe and React artist, nomination, and community interfaces. The page uses the saved cream, ink, cobalt, pink, yellow and lime palette. Its wide rectangular globe and permanently visible artist profile are independent cards, with a single-line title above them. On phones, identity appears beneath the globe and the story remains available by scrolling.

## Artist records and permanent numbering

In the existing `abodid-website` Supabase project, open **Table Editor → art_globe_artists**. Insert one row per artist:

- `id`: your unique text ID; never reuse an existing ID.
- `artist_number`: automatically generated permanent number. Leave this field alone; numbers remain internal metadata and are no longer shown in the profile. Numbers do not change when artists are added or sorted.
- `name`, `current_city`, `country`, `latitude`, `longitude`: public identity and decimal coordinates (south/west negative). Published profiles must have coordinates.
- `disciplines`, `tags`, `artwork_urls`, `sources`: arrays. Use JSON arrays in imports or PostgreSQL array syntax in SQL.
- `origin`, `biography`, `artist_statement`: plain text.
- `portfolio_url`, `instagram_url`: HTTPS links. `public_email`: a publicly listed professional email only.
- `artwork_urls`: at most four displayed. Use only images you have permission to display. Blank/broken images produce no placeholders.
- `is_demo`: false for real artists; true for fictional demonstration records.
- `published`: true to show the profile; defaults to false.
- `nomination_status`: curated by default for your own entries; public nominations start pending.

The 18 original demo profiles are fictional. The top-of-page demo banner has been removed as requested; their biographies, profile footnote, and artist-index labels still identify them as samples. When real records are ready, unpublish the demo rows rather than deleting them. Empty/unavailable data falls back to clearly disclosed fictional records. The API reads explicit public-facing columns and only published rows, caches for 60 seconds with up to five minutes of background revalidation, and returns up to 1,000 records.

## Nomination review — no extra nomination table

Public submissions are inserted into `art_globe_artists` as unpublished, pending records with IDs beginning `nomination-`. `nomination_link` stores the supplied website/social handle. Location is optional; unknown coordinates stay null instead of placing someone at an invented location. Anonymous users cannot read or write these drafts directly.

To approve: verify the artist and permitted public details, complete coordinates and practice/bio fields, change `nomination_status` to approved, then set `published=true`. A database constraint prevents publishing pending/unlocated nominations. Set status to declined to retain a rejected nomination without publishing or deleting it. Identity sequence gaps from unpublished nominations are intentional.

The form uses existing Cloudflare Turnstile configuration, a honeypot, bounded payload validation, same-origin checks, and a durable six-submissions-per-15-minute connection limit. No new API key is required. Local development uses the existing local-preview verification convention; production requires a real Turnstile token. Submissions do not send email or publish automatically.

Location autocomplete searches a local snapshot of **34,188 major cities** and **252 countries/territories**, supports common alternate names, and fills country/coordinates when a suggestion is selected. Free-text cities are accepted for review when there is no match. Data: [GeoNames](https://www.geonames.org/), [cities15000](https://download.geonames.org/export/dump/readme.txt), **CC BY 4.0**, retrieved 26 October 2026. This is city lookup, not exhaustive address/place search. Refresh deliberately with `python3 scripts/update-artist-globe-locations.py`; it is not a scheduled job. The city dataset stays server-side.

## Monthly leaderboard and award

The only additional table is `art_globe_wanderers`. Participation is opt-in: joining publishes the chosen nickname and active seconds, and sets a 40-day HttpOnly, SameSite=Lax random browser cookie. The database stores its SHA-256 digest, never the raw token or IP address. Leaving hides that browser’s public scores and removes the cookie. Names are pseudonyms and are not identity-verified; scores are a discovery feature, not proof of a unique human.

A 15-second heartbeat counts only while the tab and globe are visible and the visitor has interacted within the past minute. Server time limits each credit to 20 seconds and discards idle gaps over 45 seconds. Database row locking serializes concurrent tabs so they cannot count the same elapsed interval twice. Month boundaries use UTC. First-time visitors are not enrolled or tracked by this leaderboard automatically.

In Supabase, inspect the monthly ranking and set `awarded=true` on your selected person’s row to publish the **Art Wanderer of the Month** name. The page shows the latest explicitly awarded, opted-in entry. No winner is invented or automatically declared. Do not mark test/browser pseudonyms as winners.

RLS is enabled and public grants are revoked on the score table. Its two RPCs run as SECURITY INVOKER and are executable only by service_role. The API exposes only public names/times and the current visitor’s own record. Namespaced rate limits reuse the existing rate-limit storage without changing contact-form functions or deleting records. `community.sql` records the additive changes applied on 26 October 2026; `schema.sql` and `seed.sql` describe the first-pass setup.

## Globe interactions and local geography

- The local Three.js globe restores flat polygon shading, directional light and natural flick inertia. Drag or flick to rotate; keyboard arrows rotate and +/- zoom. Rotation slows with frame-rate-aware damping. Rendering sleeps when settled, offscreen, or hidden.
- Every visit chooses a random initial artist, centres the globe on their point, and displays their profile from the beginning. The profile is always pinned; its number, Pin and Close controls have been removed.
- A central radar, subtle connector, glowing nearest marker, and live name identify the artist closest to the viewing direction. The sidebar updates immediately as the globe turns, including during fast flicks and discovery spins. Automatic selection never scrolls the page or re-centres the globe against the visitor's gesture.
- **Discover an Artist!** is a compact 44px touch target in the lower centre of the globe. It makes a three-second multi-axis spin with a heavy eased stop. Reduced motion lands directly without spinning.
- Wheel, trackpad pinch, touch pinch, and controls zoom only inside the globe. Close zoom is capped at a real camera radius equivalent to **500 km above the Earth** (Earth radius 6,371 km), showing regional names and major cities. There are no streets, buildings, satellite imagery, or detailed cityscapes. The zoom-out limit keeps a smaller, comfortably visible whole planet.
- Small artist dots remain visible on the facing hemisphere. The active dot has a radar halo. No screen-distance decluttering hides neighbouring dots; the searchable index remains the accessible alternative for close clusters and rear-side points.
- On phones the globe remains first, followed by the compact name/practice/location summary and the story lower down. The sidebar cannot dismiss accidentally. Escape closes only the artist index.
- Resolution is capped at 1.75×. Geometries, materials, render loop, observers, labels and event listeners are released on unmount. WebGL failure leaves the artist index, default profile and community forms available.

**Local assets, no map-provider overlay:** the globe no longer loads MapLibre, OpenFreeMap, OpenMapTiles, remote tiles, or map fonts. Its public-domain [Natural Earth](https://www.naturalearthdata.com/about/terms-of-use/) land snapshot is triangulated and subdivided into 55,786 curved triangles with 30,480 quantized vertices. `node scripts/build-artist-globe-land.mjs` regenerates `land-mesh.json` from the existing `land.json`; the JSON is approximately 1.4 MB before HTTP compression and the GPU geometry uses shared vertex indices. The faceted coastline is intentionally simplified, not survey/cartographic detail.

`labels.json` contains 5,805 regional and major-city labels. Regional label positions/names come from Natural Earth's public-domain [admin-1 dataset](https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_10m_admin_1_states_provinces.geojson); major cities come from the existing GeoNames snapshot (CC BY 4.0, credited on the page). Labels are fetched only when zooming in. At most 28 DOM labels are placed in a reused pool with collision avoidance. No street network is downloaded. This phase changes no database tables, credentials, nomination workflow or leaderboard storage.

## Validation

`npx vitest run tests/artist-globe/data.test.ts tests/artist-globe/nominations.test.ts`

`npx playwright test tests/artist-globe/globe.spec.ts --workers=1`

The standard browser suite starts/reuses the workspace server on port 4321. For another review server, set `ARTIST_GLOBE_TEST_URL` to its URL; this release was also checked on an isolated review server on port 4322. Production builds require Node 24 (`npm run build`).

Browser checks cover nine widths from 320px to 1440px, rectangular layouts, a default permanent artist card, no provider requests or overlay, compact in-globe discovery placement, flick inertia, live radar/card agreement, a 500 km zoom floor, regional labels, spin/name changes, mobile pinch without page magnification, reduced motion, WebGL fallback, long content, and the existing nomination/leaderboard flows. Data tests verify the nearest-direction selection and physical camera limits. The compiled production assets are also rendered separately before publishing. Physical-device GPU performance and real identities are not certified by automation. Repository-wide TypeScript diagnostics in unrelated areas predate these changes.
