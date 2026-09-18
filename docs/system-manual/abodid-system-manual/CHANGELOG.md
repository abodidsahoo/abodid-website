# System Manual Changelog

This changelog records structural additions, architectural updates, and significant revisions to the Abodid System Manual and the underlying digital ecosystem.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), adhering to permanent numeric chapter mapping.

---

## [1.0.0] — 2026-09-18

### Initial Release of the Permanent System Manual
- Established permanent 11-chapter hierarchy (`00` through `10`) in `docs/system-manual/abodid-system-manual/`.
- Created master index ([INDEX.md](./INDEX.md)), system glossary ([GLOSSARY.md](./GLOSSARY.md)), and changelog ([CHANGELOG.md](./CHANGELOG.md)).
- Documented full Astro 5.x application architecture, routing layers, and Vercel hosting rules.
- Documented unified multi-subdomain routing (`abodid.com`, `lab.abodid.com`, `curation.abodid.com`, `photos.abodid.com`).
- Documented complete Supabase database schema (`portfolio_*`, `resources_*`, `analytics_*`, `network_*`, `punctum_*`, `reading_digest_*`).
- Documented Cloudflare R2 media storage, variant optimization, and WebP asset pipeline.
- Documented Obsidian Vault sync, pgvector RAG pipeline, and public note routing.
- Documented Punctum research suite, interactive Lab experiments (Image Flick, Sequence Room, Glyph Loom), and Pop Editorial visual design system.
- Documented OpenRouter AI integrations, Daily Reading Digest cron edge functions, Opportunity Radar, and Resend email pipelines.
- Documented operational postmortems, security invariants, service quotas, and zero-to-one developer onboarding runbooks.
- Established 10–15 year digital continuity and platform portability framework.

---

## Pre-Manual Architectural Milestones (Historical Context)

### [2026-09-16] — Opportunities Assistant & Revenue Intelligence
- Added AI-assisted opportunity discovery cron, database priorities, and revenue analytics models.

### [2026-09-13] — Lab & Sequence Room Unified Portfolio Integration
- Renamed Photo Board to Sequence Room.
- Unified Lab and Research projects under shared `portfolio_blocks` schema.

### [2026-09-11] — Obsidian Vault Root Route Migration
- Migrated public vault routes from `/research/obsidian-vault` to `/obsidian-vault`.
- Added 308 permanent redirect mappings preserving 347 canonical note slugs.

### [2026-08-27] — Curation Layer & Subdomain Realignment
- Published Curation product at `curation.abodid.com` with curator submission workflows and admin moderation.

### [2026-08-04] — Daily Reading Digest Automated Pipeline
- Deployed Supabase pg_cron + Edge Function pipeline for autonomous web research, deduplication, and Resend delivery.

### [2026-07-28] — Punctum Research Suite & AI Worlds
- Launched Invisible Punctum interactive coordinate mapping, AI world generation, and human consensus comparative engine.

### [2026-07-11] — Unified Work Portfolio CMS
- Created `portfolio_projects`, `portfolio_revisions`, and `portfolio_blocks` tables replacing disparate legacy models.
