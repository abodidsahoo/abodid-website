# Unified Work portfolio

This feature adds a project-first Work portfolio and a controlled portfolio CMS. It is additive: the existing Photography and Film tables, storage, pages and routes are unchanged.

## Routes

- `/work` - responsive, two-column published project index with strict AND filters and shareable query-string state.
- `/work/[slug]` - currently published project snapshot rendered with the shared block renderer.
- `/work-sitemap.xml` - published, search-visible Work URLs.
- `/admin/dashboard?section=portfolio_projects` - project list, search, lifecycle filters, archive action and drag ordering inside the shared admin panel. The legacy `/admin/projects` URL redirects here.
- `/admin/projects/new` - creates a private first draft.
- `/admin/projects/[slug]` - desktop editor, properties, preview, explicit draft saving, publishing and version recovery. Legacy UUID URLs resolve and are replaced with the canonical slug URL.

## Data and publishing model

All new tables use the `portfolio_` prefix. `portfolio_projects` owns stable identity, slug, status, public order and pointers to a mutable draft and an immutable published revision. Metadata, semantic blocks, taxonomy relationships, organisations, collaborators and links are attached to revisions.

The editor saves only when **Save draft** is clicked or as the first explicit step of **Publish**. Unsaved changes are clearly marked and leaving the editor triggers a browser warning. The RPC compares `lock_version`; a stale tab receives `PORTFOLIO_CONFLICT` rather than overwriting newer work. Publish validates the project, clones a complete immutable snapshot and atomically changes `published_revision_id`. Restore copies an earlier published snapshot into a new draft without changing the live version.

Anonymous access is limited to the sanitised public views. In limited Work in Progress mode, blocks marked **Visible** are the explicitly selected public blocks; hidden blocks, contribution, outcome, collaborator details and links remain omitted. Admin mutations require an authenticated `profiles.role = 'admin'` user. The service-role key is never used by browser code.

The publishing panel exposes one **Public mode** choice. **Full project** publishes all visible project information. **Work in progress** publishes the cover, summary and visible blocks while automatically keeping contribution, outcome, collaborators and links private. The underlying WIP and limited-public flags remain an implementation detail so older revisions stay compatible.

## Editor blocks

The shared renderer and editor support body text, H2/H3 heading, quotation, highlight, testimonial, single image, two/three-column image grid, gallery/lightbox, YouTube/Vimeo embed, media with text, external CTA and controlled divider/spacing. Content stores semantic JSON plus controlled width, alignment, columns, media fit, visibility and spacing tokens. Public routes never import drag-and-drop or editor code.

To add a block later:

1. Add its stable identifier to `BLOCK_TYPES` and its default semantic payload to `createEmptyBlock` in `src/lib/portfolio/schema.js`.
2. Add the identifier to the database `block_type` constraint in a new additive migration.
3. Add one public rendering branch in `PortfolioProjectRenderer.jsx` and one editing branch in `PortfolioBlockEditor.jsx`.
4. Add validation and a fixture test. Never change the meaning of an existing identifier.

## Media

The migration creates the public `portfolio-media` bucket with a 20 MB limit for JPEG, PNG, WebP and GIF. Only admins can upload, update or remove objects. Each image field presents separate **Add image link** and **Upload image** actions; the URL input appears only for the link path, while the upload path opens the computer file picker. Paths use a stable first-five-words project folder and preserve the original filename base before a short collision suffix. Exact original filenames, dimensions, MIME type, alt text, caption, credit and focal point are stored in `portfolio_media_assets`. Video remains on YouTube or Vimeo.

Uploaded media is available to drafts regardless of publication status. Removing an uploaded image queues storage cleanup until the draft has been manually saved successfully. Unreferenced objects are then removed from both the `portfolio-media` bucket and `portfolio_media_assets`. An object still used by a published or recoverable revision is retained so version restoration and the live site cannot be broken; the editor reports this protected-retention case.

## Environment and setup

The existing `PUBLIC_SUPABASE_URL` and `PUBLIC_SUPABASE_ANON_KEY` are required. `SUPABASE_SERVICE_ROLE_KEY` is not required by the browser feature. Apply the three `2026071116` Supabase migrations in order. The linked schema snapshot is generated at `src/lib/portfolio/supabase.generated.ts`; regenerate it after later database migrations.

The seed migration adds the six primary filter terms and the role library from the PRD. The wording `Client Servicing / Developer` is preserved as one combined role because that exact wording is supplied by the brief and no existing canonical split was found.

Three limited WIP starter projects are also seeded from existing Research records and link back to their existing routes. Their public copy and images are reused rather than invented; they are intended to be completed in the editor with contribution, collaborators and narrative blocks before full publication.

## Verification

`npm run test:portfolio` covers strict AND filtering, URL state, taxonomy normalisation, validation, filename preservation, draft isolation, optimistic conflicts and revision restoration. `npm run test:e2e:portfolio` covers the public filter flow, mobile stacking and Photography/Film route regression. `supabase/tests/portfolio_rls.sql` is intended for a disposable or staging database after migrations.

## Rollback

The feature is route-isolated. A code rollback can remove the Work and portfolio-admin routes/components without affecting Photography or Film. Database rollback is documented in `supabase/rollback/20260711_unified_work_portfolio.sql`; it deletes only namespaced portfolio objects and the dedicated bucket, and must be run only after exporting any portfolio content/media that should be retained. Do not run the rollback merely to disable the feature - hiding the Work navigation and routes is safer.
