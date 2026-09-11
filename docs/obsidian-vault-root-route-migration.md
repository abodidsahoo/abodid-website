# Obsidian Vault root-route migration

Status: implemented and locally verified; production deployment verification remains pending.

Last audited: 11 September 2026.

## Decision

- Public canonical host remains `https://abodid.com`.
- `https://www.abodid.com/*` remains Vercel's permanent alias to `https://abodid.com/*`.
- Old vault base: `/research/obsidian-vault`.
- New vault base: `/obsidian-vault`.
- Preserve every current note slug exactly during this migration.
- Preserve the visual design, content, data sources, server rendering, cache behavior, forms, search, citations, related-note behavior, topics, directory, tags, and asset delivery.
- Keep permanent path-for-path redirects from the old base indefinitely.
- Do not change the GitHub vault structure, Supabase tables, embeddings, ingestion workflow, or `/api/vault-*` endpoint paths.

## Why slugs will not change in this release

The public sitemap currently contains 347 note URLs. Changing the base path and individual slugs simultaneously would make redirect mapping harder to verify and would increase the chance of orphaned backlinks or citations. This migration changes only the base prefix. Any later slug cleanup must be a separate, explicitly mapped migration.

## Current audit baseline

- Live `/research/obsidian-vault` response: `200`.
- Live `/obsidian-vault` response before migration: `404`.
- Live vault sitemap entries: 347, all using the old prefix.
- Literal old-prefix references: 99 matches across 41 repository files.
  - Application and public source: 83 matches across 34 files.
  - Tests: 13 matches across 5 files.
  - Archived SQL: 3 matches across 2 files.
- The repository working tree was clean at migration start (`57e9485 update`).

## Route mapping

| Current route | New canonical route | Required old-route behavior |
| --- | --- | --- |
| `/research/obsidian-vault` | `/obsidian-vault` | Permanent redirect |
| `/research/obsidian-vault/:note` | `/obsidian-vault/:note` | Permanent path-preserving redirect |
| `/research/obsidian-vault/directory` | `/obsidian-vault/directory` | Permanent redirect |
| `/research/obsidian-vault/topic/:topic` | `/obsidian-vault/topic/:topic` | Permanent path-preserving redirect |
| `/research/obsidian-vault/tag/:tag` | `/obsidian-vault/topic/:tag` | Permanent direct redirect to avoid a two-hop redirect chain |
| `/research/obsidian-vault/assets/:path` | `/obsidian-vault/assets/:path` | Permanent path-preserving redirect |

Redirects must preserve encoded characters and query strings, including `fromVaultSearch`.

## Data and services that must remain unchanged

- GitHub repository and note folders such as `06-main-notes` and `07-assets`.
- Supabase `obsidian_notes` and `obsidian_chunks` data.
- `match_obsidian_chunks` RPC and stored embeddings.
- Obsidian ingestion and synchronization scripts/functions.
- Environment variables and service credentials.
- `/api/vault-chat`, `/api/vault-related-note`, `/api/vault-tag-search.json`, `/api/vault-tags.json`, and `/api/vault-warm.json` routes.
- Existing analytics implementation, apart from the expected new page paths.

## Implementation sequence

- [x] Add a single shared vault base-path helper so future public links are not duplicated as string literals.
- [x] Move the six Astro route files from `src/pages/research/obsidian-vault` to `src/pages/obsidian-vault` with history preserved.
- [x] Correct every relative import after the one-level move.
- [x] Add exact and wildcard permanent redirects in `vercel.json` before relying on the removed route directory.
- [x] Update server-side note, topic, and citation link generation.
- [x] Update Markdown wiki-link and embedded-asset rewriting.
- [x] Update related-note API generation and slug extraction.
- [x] Update tag-search fallback links.
- [x] Update note canonicals, breadcrumbs, and collection structured data.
- [x] Remove the `Research` breadcrumb level from vault pages.
- [x] Update the vault XML sitemap to emit only new URLs.
- [x] Update the HTML/visual sitemap and `llms.txt`.
- [x] Update all current navigation, homepage, services, manifesto, and research-page links.
- [x] Update tests to assert new canonical URLs and old permanent redirects.
- [x] Search the repository again; any remaining old-prefix reference must be an intentional redirect, migration document, archived record, or redirect test.
- [x] Run targeted vault and SEO tests.
- [x] Run the production build.
- [x] Run browser checks without changing the existing design.
- [ ] Verify the final live deployment separately if/when deployment is requested.

## Critical application dependencies

### Route files to move

- `src/pages/research/obsidian-vault/index.astro`
- `src/pages/research/obsidian-vault/[...slug].astro`
- `src/pages/research/obsidian-vault/directory.astro`
- `src/pages/research/obsidian-vault/topic/[...topic].astro`
- `src/pages/research/obsidian-vault/tag/[...tag].astro`
- `src/pages/research/obsidian-vault/assets/[...path].js`

### Link and response generators

- `src/lib/vault-rag.js`
  - `sourceHrefForFilePath()` creates AI citation/source URLs.
- `src/lib/vault-note-index.js`
  - Supabase note results, GitHub fallback results, and topic results expose public URLs.
- `src/pages/api/vault-related-note.js`
  - Generates target URLs and parses the public prefix to recover a slug.
- `src/pages/api/vault-tag-search.json.js`
  - GitHub fallback results generate note URLs.
- `src/pages/vault-sitemap.xml.ts`
  - Generates all public note sitemap entries.
- `scripts/ingest-obsidian-vault.mjs`
  - Removes its downloaded temporary vault after ingestion so unusual Obsidian filenames cannot be pulled into a later Vercel server bundle.

### Rendering and assets

- `src/pages/research/obsidian-vault/[...slug].astro`
  - Converts Obsidian image embeds to the public asset proxy.
  - Converts wiki-links to note or topic URLs.
  - Generates note JSON-LD and breadcrumbs.
  - Provides fallbacks back to the vault homepage.
- `src/pages/research/obsidian-vault/topic/[...topic].astro`
  - Generates fallback note links and homepage navigation.
- `src/pages/research/obsidian-vault/tag/[...tag].astro`
  - Redirects legacy tag URLs to topic URLs.
- `src/pages/research/obsidian-vault/directory.astro`
  - Provides vault-home navigation and structured-data breadcrumbs.

### SEO and discovery

- `src/lib/seoData.ts`
- `src/lib/seoData.js`
- `src/pages/vault-sitemap.xml.ts`
- `src/pages/sitemap.astro`
- `public/llms.txt`
- Supabase `page_metadata` rows, if any exist for the old path, must be reviewed because metadata lookup uses the exact pathname.

### Site navigation and presentation references

- `src/components/HeroVaultTagsCard.jsx`
- `src/components/NavigationCards.astro`
- `src/components/SideMenuRail.jsx`
- `src/components/SiteFooter.astro`
- `src/components/VisualSitemap.astro`
- `src/components/landing/LandingGridPrototype.jsx`
- `src/lib/homeNextArchive20260828Content.ts`
- `src/lib/homeNextContent.ts`
- `src/lib/homePositioningContent.ts`
- `src/lib/homeStorytellingContent.ts`
- `src/lib/services/content.ts`
- `src/pages/august-2026.astro`
- `src/pages/blur-phrase-centered.astro`
- `src/pages/home-next.astro`
- `src/pages/landing-grid-test.astro`
- `src/pages/manifesto.astro`
- `src/pages/research.astro`
- `src/pages/research/lab/index.astro`
- `src/pages/research/second-brain/index.astro`
- `src/pages/services.astro`

### Tests to update or extend

- `tests/obsidian-vault.spec.ts`
- `tests/vault/vault-ask-lifecycle.test.mjs`
- `tests/seo/entity-graph.test.mjs`
- `tests/seo/sitemap-generation.test.mjs`
- `tests/seo/trailing-slash.test.mjs`
- Add route-helper tests for new URLs and legacy redirects.

### Historical references

These do not control production and may retain the old route when documenting history:

- `sql/archive/migrate_research_cleanup.sql`
- `sql/archive/update_research_schema.sql`
- This migration runbook.

## Functional acceptance checklist

### Vault home

- [x] New vault home returns `200`.
- [x] Existing layout, typography, spacing, colors, responsive behavior, form, note list, topic list, and AI question interface are visually unchanged.
- [x] Every note card opens a new-prefix note URL.
- [x] Every topic opens a new-prefix topic URL.
- [x] Directory link opens `/obsidian-vault/directory`.

### Notes

- [x] Representative normal, uppercase, apostrophe, space/encoded, and punctuation slugs return `200`.
- [x] GitHub asset delivery and Supabase note delivery work on the new routes; fallback control flow is otherwise unchanged.
- [x] Obsidian wiki-links use the new prefix.
- [x] Obsidian embedded images load through `/obsidian-vault/assets/...`.
- [x] External links retain their existing target and security attributes.
- [x] Related-note preload and navigation return new-prefix URLs.
- [x] Share URLs reflect the new canonical path.
- [x] Search-return state using `fromVaultSearch` survives note navigation and back navigation.

### Search and topics

- [ ] Optional live-provider smoke test for a generated vault answer and citations. The browser lifecycle suite passes, and retrieval/citation code is unchanged apart from centralized new-prefix links; a live model call was not made because it would send retrieved vault excerpts to an external provider.
- [x] Citation inspector links use the new prefix.
- [x] Topic pages retain indexing/noindex behavior based on result count.
- [x] Legacy `/tag/...` routes redirect to new `/topic/...` routes.
- [x] Related-note vector, tag, GitHub, and random fallbacks remain unchanged apart from target URLs.

### SEO and discovery

- [x] New pages emit new-prefix canonical and Open Graph URLs.
- [x] Note and collection JSON-LD use new-prefix URLs.
- [x] Vault breadcrumbs contain Home → Obsidian Vault → Note, without the removed Research level.
- [x] `vault-sitemap.xml` contains the same 347-note inventory with only new-prefix URLs.
- [x] `llms.txt` advertises the new vault and directory URLs.
- [x] No new page canonicalizes back to the old route.
- [x] Old URLs return one permanent redirect, not a chain and not a rendered duplicate.

### Redirect validation

- [x] Old root redirects to new root.
- [x] Old note redirects to the same note slug.
- [x] Old directory redirects to new directory.
- [x] Old topic redirects to the same new topic.
- [x] Old tag redirects directly to the matching new topic without losing the tag.
- [x] Old asset redirects to the corresponding new asset.
- [x] Query strings survive redirects.
- [x] `www.abodid.com/obsidian-vault` continues its existing hostname redirect to `abodid.com/obsidian-vault`.

## Verification result

- Focused vault and SEO tests: 37 passed, 0 failed.
- Browser regression: 1 passed, covering the vault home, 347 note cards, 514 topics, normal and special-character note slugs, directory, topic, tag, real WebP asset, canonical URLs, new-prefix-only internal links, and permanent redirects.
- Vault XML sitemap: 347 entries, all under `/obsidian-vault`.
- Production Astro/Vercel build using the repository-required Node 24 runtime: passed.
- Moved route source comparison: no CSS or visual-design rules changed; differences are limited to relative imports, route URLs, canonical data, and removal of the obsolete Research breadcrumb level.
- Supabase `page_metadata` audit: no old-path or new-path override row exists, so no database migration is needed.
- Generated ingestion cache: cleanup was added after a stale `.astro/tmp-vault` download exposed a Vercel file-tracing failure on valid Obsidian filenames ending in `?`.
- Remaining old-prefix references are intentionally limited to redirect configuration/runtime logic, redirect tests, this migration record, and two archived SQL files.

## Automated verification commands

Run the repository's existing focused suites, followed by the build:

```sh
node --test tests/vault/vault-ask-lifecycle.test.mjs
node --test tests/seo/*.test.mjs
npx playwright test tests/obsidian-vault.spec.ts
npm run build
```

Run the old-prefix audit after implementation:

```sh
rg --count-matches \
  --glob '!node_modules/**' \
  --glob '!.vercel/**' \
  --glob '!dist/**' \
  '/research/obsidian-vault|research/obsidian-vault' .
```

Every remaining match must be reviewed and classified as one of:

- required permanent redirect;
- redirect test;
- historical documentation/archive;
- this migration record.

## Release and recrawl expectations

- Keep the permanent redirects indefinitely.
- Submit or refresh `https://abodid.com/vault-sitemap.xml` in Search Console after production deployment.
- Google can begin replacing old paths after recrawling, but a complete 347-URL migration can take days to several weeks. There is no guaranteed few-day deadline.
- Temporary ranking or reporting fluctuations are normal during recrawl.
- A Search Console Change of Address request is not needed because the hostname remains the same; this is a path-only migration.
- Monitor 404s, redirect responses, sitemap discovery, indexed-page counts, and vault traffic after release.

## Rollback rule

If new routes, note content, assets, search citations, or redirects fail in production, restore the previous route implementation while retaining this runbook. Do not remove the old redirects until the new routes have passed the complete acceptance checklist.
