# Photography portfolio

Standalone Astro portfolio at `/photography-portfolio`, with `photos.abodid.com/` as its canonical public URL. The main site's shared layout is intentionally not imported.

## Media

The verified R2 inventory (7 September 2026) contains 56 photographs in `photos/originals/exhibition-photos/`, grouped into nine series. There is currently no `exhibitions/` folder. Both names are supported. Originals are never moved or renamed. All images are served directly by `assets.abodid.com`.

`src/lib/photography/server.ts` lists originals and variants server-side with a five-minute cache and a six-second timeout. It coalesces simultaneous refreshes and uses the last good catalog, or the checked-in verified inventory, if R2 is unavailable. Successful empty results stay empty. Images awaiting either responsive variant are not published until processing completes. The loader matches current original ETags to fingerprinted filenames, and also supports plain `.webp` names.

Server environment:

- `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`: existing R2 read credentials.
- `PHOTOGRAPHY_R2_BUCKET`: defaults to `assets`, independently of older bucket settings.
- `PHOTOGRAPHY_FOLDERS`: optional comma-separated additional public portfolio folders.

Default public folders: `exhibitions`, `exhibition-photos`, `documentary`, `editorial`, `fine-art`, `commercial`. Nested folders become series. Other categories require explicit inclusion so personal photographs do not appear automatically. Punctum, avatars, landing-page and site-graphics folders remain blocked even if accidentally configured.

`src/data/photographyMetadata.json` holds verified dimensions and descriptive alt text for the current photographs. Optional per-original fields: `series`, `title`, `label`, `location`, `story`, `camera`, `alt`, `width`, `height`. Add metadata here when publishing new work. Camera details are not invented when EXIF is absent. Series descriptions identify the exhibition, not an unverified commissioning relationship.

## Interaction and reference

Reference: https://www.athulprasad.com/ — white canvas, small fixed navigation, staggered uncropped photographs, two-column italic index, hover previews and fixed category controls. This implementation uses Abodid's own wordmark and local Satoshi/system serif typography; it does not bundle the reference's proprietary Cardinal Fruit font. Native View Transitions animate image/index and category changes, with a fallback and reduced-motion support. Scrolling stays native.

The lightbox includes previous/next buttons, arrow keys, mobile swipes, metadata and licensing. Native dialogs provide modal focus containment; Escape and closing return focus to the triggering link. The inquiry form opens a prefilled email draft to `hello@abodid.com`; it does not silently send or claim a successful delivery. An image licensing inquiry includes the exact selected original URL. Availability is the requested Q4 2026 text and should be updated as the schedule changes.

## Search and routing

`src/middleware.ts` rewrites the photography hostname without looping. `vercel.json` also defines host-specific rewrites, including robots.txt, which would otherwise be served from the main site's static public file before middleware. Astro development serves that static robots.txt directly; verify the portfolio robots endpoint at `/photography-portfolio/robots.txt` locally.

Structured data uses valid `Person` + `jobTitle: Photographer`, `ImageGallery`, `ImageObject`, and worldwide `Service` nodes. Schema.org does not define a `Photographer` type. Each image includes creator, credit, copyright and licensing inquiry URL. The subdomain sitemap includes all 56 images. Search ranking or inclusion is not guaranteed.

## Release

The existing Vercel project is `abodid-website`. Attach `photos.abodid.com` to that project and use the DNS record Vercel supplies. Keep existing R2 credentials available in its production environment. Deploy the reviewed changes through the existing release workflow. This task does not publish other in-progress edits in the shared working directory.

After release verify `/`, `/robots.txt`, `/sitemap.xml`, all nine series, one licensing draft, and a mobile viewport on the actual subdomain.

## Validation

- `node --test tests/photography/catalog.test.mjs`: media scope, 56-image inventory, fingerprint matching, pending variants, future folders, and domain routing.
- Targeted TypeScript check for the loader, client controller and endpoints.
- `npm run build` with Node 24 and network access: passed.
- Browser checks: desktop and mobile gallery/index, responsive images, next image, metadata, licensing context, Escape dismissal and focus return.
- Local host-header check: portfolio homepage and 56-image sitemap served correctly.

### Route confirmed

The user selected `/photography-portfolio`. The completed portfolio and its search endpoints now live there. Both Astro middleware and Vercel host rewrites target that route. The original `/photography` page is preserved.

### Mobile image and palette audit

The current catalog previously defaulted to original URLs when per-folder variants were absent. The resolver now also reuses variants for renamed originals when full ETags match, prefers 1600, then 800, then retains the original only if neither exists. At this audit: 820 images resolve to 1600, 49 to 800 only, and 409 have no usable variant. Bulk upload of 867 missing responsive files requires the user's explicit approval; `scripts/backfill-photography-variants.mjs` is dry-run unless passed `--upload`.

The first two gallery covers use existing optimized files, are preloaded responsively, and have high fetch priority. Mobile captions are server-rendered with a compact 11px wordmark. Whole-archive/whole-album preloading was removed; only one likely next image is warmed. Requests receive the checked-in catalog immediately while live inventory refreshes in the background. Palette image downloads no longer block page rendering.

Hover colors use populated color bins and an actual sampled pixel, without warm-tone weighting or saturation/lightness forcing. Foreground black or white is selected by contrast. Precomputed cover palettes are keyed by image URL in `photographyPalettes.generated.json`.

Refresh cached inventory with `node scripts/audit-photography-r2.mjs`, then `node scripts/cache-photography-preview.mjs` to refresh the local catalog, cover dimensions and palette cache. Both read Cloudflare/public images without uploading. Publish the resulting code/data changes through the existing release workflow.
