# Art in Every Corner

Live route: https://abodid.com/lab/art-in-every-corner

Astro page with a lazy-loaded MapLibre GL JS vector globe and React artist, nomination, and community interfaces. The page uses the saved cream, ink, cobalt, pink, yellow and lime palette. Its square globe and rectangular profile are independent cards, with a single-line title above them. On phones, identity appears beneath the globe and the story remains available by scrolling.

## Artist records and permanent numbering

In the existing `abodid-website` Supabase project, open **Table Editor → art_globe_artists**. Insert one row per artist:

- `id`: your unique text ID; never reuse an existing ID.
- `artist_number`: automatically generated permanent number. Leave this field alone; the UI renders “Great artist 001”, etc. Numbers do not change when artists are added or sorted.
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

## Globe interactions and map data

- Drag to rotate/pan with inertia; keyboard arrows and +/- are supported.
- Wheel, trackpad pinch, touch pinch, and controls change the map inside its viewport. Native page zoom/scroll is not disabled globally. Touch listeners cover marker hit areas as well as canvas, and Safari gesture events are handled locally.
- Zoom out stops at a comfortably visible whole globe. Deep zoom loads vector coastline, regional boundaries, rivers, roads, and place names. Maximum zoom adapts to latitude and viewport size for an **approximate 5 km camera height**; this is not a terrain/satellite altitude guarantee. A scale bar shows actual map distance. The whole-globe control resets the view.
- **Discover an Artist!** makes a three-second multi-axis spin with fast initial motion, a heavy eased stop, and an artist exactly at the viewport centre. Reduced motion lands directly without spinning. Random starting views remain enabled on each fresh load. Latitude-adjusted zoom keeps the whole globe the same size when discovery lands near the poles.
- Projected marker buttons have geographic occlusion and decluttering; the selected artist has priority over nearby points. The searchable index gives keyboard/touch access to every artist, including points on the rear side.
- Profiles can be pinned to resist background dismissal; independent card sizing is preserved. Escape/Close dismisses the profile. Missing WebGL leaves the index functional.
- MapLibre redraws on demand rather than running a permanent render loop. Resolution is capped at 1.75×. The map container uses an explicit full-size positioned selector that outranks lazily loaded SDK CSS, preventing a production-only collapsed viewport. Spin pauses when the tab is hidden. Observer/listener/map/worker resources are cleaned up on unmount.

MapLibre uses [OpenFreeMap](https://openfreemap.org/quick_start/) vector tiles, with OpenMapTiles/OpenStreetMap attribution inside the viewport. The public service requires no API key or paid account. Detailed geography requires that external service/network; it is not an offline map. The original public-domain Natural Earth snapshot remains in the repository as a historical asset, but is no longer loaded by the globe. No satellite imagery, Street View, artist scraping, or AI discovery service runs.

## Validation

`npx vitest run tests/artist-globe/data.test.ts tests/artist-globe/nominations.test.ts`

`npx playwright test tests/artist-globe/globe.spec.ts --workers=1`

The standard browser suite starts/reuses the workspace server on port 4321. For another review server, set `ARTIST_GLOBE_TEST_URL` to its URL; this release was also checked on an isolated review server on port 4322. Production builds require Node 24 (`npm run build`).

Browser checks cover nine widths from 320px to 1440px, independent card layout, a single-line title, no horizontal overflow, marker/profile interactions, permanent numbering, spin duration/centering, approximate five-kilometre zoom, globe reset, location autocomplete and payload, opt-in/leave flows, simulated mobile pinch without page magnification, reduced motion, WebGL fallback, long names/tags, and API rejection paths. Database transaction checks verify score credits, duplicate/idle heartbeats, rate limiting, service-role draft inserts, and anonymous draft occlusion, then roll back all QA records. Physical-device GPU performance and real identities are not certified by automation. Repository-wide TypeScript diagnostics in unrelated areas predate these changes.

Release validation: 21 browser tests and 14 unit/API tests passed, plus the production build. New atlas files have no TypeScript diagnostics; the global check continues to report pre-existing issues elsewhere.
