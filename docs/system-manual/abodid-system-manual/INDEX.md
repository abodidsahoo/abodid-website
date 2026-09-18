# Master Documentation Index

This index provides direct navigation to every chapter, section, and specification file within the Abodid System Manual.

---

## 00 — Manual, Index and Versioning
- **[00.00 — Manual Charter and Audiences](./00-manual/00.00-manual-charter.md)**: Purpose, target reader personas (developer, intern, designer, recruiter, LLM), long-term horizon.
- **[00.01 — Numbering and Versioning Rules](./00-manual/00.01-numbering-and-versioning.md)**: Hierarchical numbering standards, stability constraints, semver tracking.
- **[00.02 — Source of Truth and Exclusion Principles](./00-manual/00.02-source-of-truth-and-exclusions.md)**: Ground-truth hierarchy, commit archaeology guidelines, status classification tags, secrets exclusion.
- **[00.03 — Modular Generation and Maintenance Guide](./00-manual/00.03-modular-generation-and-maintenance.md)**: Generating targeted sub-manuals (design, recruiter, developer, LLM ingestion), isolated chapter editing.
- **[00.04 — Documentation Gaps Audit](./00-manual/00.04-documentation-gaps.md)**: Unverified implementations, schema deprecations, pending migrations.

---

## 01 — Philosophy, Manifesto and Creative Practice
- **[01.00 — Core Manifesto and Professional Positioning](./01-philosophy-manifesto/01.00-core-manifesto-and-positioning.md)**: Mission statement, creative technologist definition, CV milestones, personal philosophy.
- **[01.01 — Creative and Research Practice](./01-philosophy-manifesto/01.01-creative-and-research-practice.md)**: Research-through-making, documentary filmmaking, fine-art photography, exhibition technology, spatial computing.
- **[01.02 — Human-Directed AI Principles](./01-philosophy-manifesto/01.02-human-directed-ai-principles.md)**: Directing AI under human editorial taste, rejection of autonomous genericism, prompt constraint design.
- **[01.03 — Taste and Editorial Standards](./01-philosophy-manifesto/01.03-taste-and-editorial-standards.md)**: Pop Editorial aesthetic tenets, intentional friction vs friction-free homogenization, digital craftsmanship.

---

## 02 — Information Architecture and Content System
- **[02.00 — Route Hierarchy and Subdomain Architecture](./02-information-architecture/02.00-route-hierarchy-and-subdomains.md)**: Root origin `abodid.com`, subdomains `lab.abodid.com`, `curation.abodid.com`, `photos.abodid.com`, Astro & Vercel routing.
- **[02.01 — Navigation System and Visitor Journeys](./02-information-architecture/02.01-navigation-and-visitor-journeys.md)**: Primary header, mobile navigation drawer, contextual footer, breadcrumbs, journey tracking hooks.
- **[02.02 — Slug Generation, Canonical URLs, and Redirects](./02-information-architecture/02.02-slug-logic-canonical-and-redirects.md)**: Deterministic slug algorithms, canonical URL headers, 308 permanent redirect matrix, legacy path migrations.
- **[02.03 — SEO, Structured Data, and Machine Discovery](./02-information-architecture/02.03-seo-structured-data-and-discovery.md)**: Dynamic Satoshi OpenGraph cards, JSON-LD Schema, XML sitemaps, `robots.txt`, `llms.txt`.
- **[02.04 — Content Authoring and Publishing Workflows](./02-information-architecture/02.04-content-authoring-workflows.md)**: Publishing runbooks for Work projects, Research papers, Lab experiments, Photography series, Films, and Notes.

---

## 03 — Visual System, Pop Editorial and Moodboards
- **[03.00 — Abodid Pop Editorial Design System](./03-visual-system/03.00-abodid-pop-editorial-design-system.md)**: Aesthetic foundation, layout grids, brutalist-editorial balance, grain texture overlays.
- **[03.01 — Typography Hierarchy and Type Scale](./03-visual-system/03.01-typography-and-type-scale.md)**: Font stack (Satoshi, Inconsolata, serif fallbacks), fluid rem scales, line-height geometry.
- **[03.02 — Color Palette, Design Tokens, and Overlays](./03-visual-system/03.02-color-palettes-and-tokens.md)**: CSS custom properties, HSL token definitions, stark neutrals, high-contrast neon accents.
- **[03.03 — Component Specifications and Interaction Patterns](./03-visual-system/03.03-components-and-interaction-patterns.md)**: Interactive cards, buttons, progress bars, lightboxes, modal dialogs, native view transitions.
- **[03.04 — Moodboard and Dynamic Palette Extraction](./03-visual-system/03.04-moodboard-and-palette-system.md)**: Boudoir moodboard viewer, client-side & server-side ColorThief palette extraction, click-to-explore color mechanics.
- **[03.05 — Rejected Visual Directions and Postmortems](./03-visual-system/03.05-rejected-visual-directions.md)**: Abandoned aesthetic directions, generic minimalism failures, Tailwind bloat postmortem.

---

## 04 — Projects, Research and Editorial Examples
- **[04.00 — Project Taxonomy and Case Study Structure](./04-projects-research/04.00-project-taxonomy-and-structure.md)**: Standard case study methodology (`Problem → Idea → Research → Design → Architecture → Implementation → Problems → Corrections → Current State → Future Possibilities`).
- **[04.01 — The Punctum Research Suite](./04-projects-research/04.01-the-punctum-suite.md)**: Invisible Punctum, Roland Barthes theory, AI Worlds, human vs machine consensus analysis, coordinate mapping.
- **[04.02 — Lab Experiments and Creative Technology Prototypes](./04-projects-research/04.02-lab-experiments-and-creative-tech.md)**: Image Flick (MediaPipe gesture tracking), Sequence Room (Polaroid sequencer), Glyph Loom, XR Showcase.
- **[04.03 — Long-Form Editorial and Research Papers](./04-projects-research/04.03-long-form-editorial-and-research-papers.md)**: Editorial layout structure, abstracts, multi-tier narrative blocks, interactive embeds, dynamic citation links.
- **[04.04 — Commercial Platforms, Tutoring, and Client Delivery](./04-projects-research/04.04-commercial-work-and-client-delivery.md)**: Supercut Club, video editing mentorship platforms, consulting workflows, private delivery architecture.

---

## 05 — Application and Code Architecture
- **[05.00 — Astro Core and Rendering Strategy](./05-application-code-architecture/05.00-astro-core-and-rendering-strategy.md)**: Astro 5.x architecture, static prerendering default, selective SSR (`prerender = false`), React island hydration.
- **[05.01 — Codebase Directory Layout and Conventions](./05-application-code-architecture/05.01-directory-structure-and-code-conventions.md)**: Repository layout (`src/pages`, `src/components`, `src/lib`, `src/data`, `scripts`, `apps`), coding standards.
- **[05.02 — Middleware Pipeline and Request Routing](./05-application-code-architecture/05.02-routing-and-middleware-pipeline.md)**: Astro middleware execution in Node.js runtime, host rewriting, header sanitization.
- **[05.03 — Client-Side State, DnD, and Animations](./05-application-code-architecture/05.03-client-state-and-interactions.md)**: Vanilla JS state, DnD Kit drag-and-drop, Chart.js analytics rendering, GSAP/Framer Motion animations.
- **[05.04 — Build Pipeline, Vite Optimization, and Vercel Output](./05-application-code-architecture/05.04-build-asset-pipeline-and-deployment.md)**: Vite cache separation, asset hashing, Vercel build output structure, continuous deployment flow.
- **[05.05 — Major Architectural Revamps and Structural Refactors](./05-application-code-architecture/05.05-architectural-evolution-and-refactors.md)**: Transition from Webflow to Astro, unified portfolio CMS migration, subdomain restructuring.

---

## 06 — Data, Media, Obsidian and Knowledge Systems
- **[06.00 — Supabase Postgres Schema and Table Specifications](./06-data-media-knowledge/06.00-supabase-database-architecture.md)**: Full database schema (`portfolio_*`, `resources_*`, `analytics_*`, `network_*`, `punctum_*`, `reading_digest_*`), relational indexes.
- **[06.01 — Row Level Security, Policies, and Authentication](./06-data-media-knowledge/06.01-security-rls-and-auth.md)**: RLS policies, anonymous session auth, admin role gating, service-role isolation.
- **[06.02 — Cloudflare R2 Media Library and Image Delivery](./06-data-media-knowledge/06.02-cloudflare-r2-media-pipeline.md)**: R2 bucket taxonomy, Sharp image optimization, WebP migration, dimension caching, signed presigned URLs.
- **[06.03 — Obsidian Vault Sync, Ingestion, and RAG Pipeline](./06-data-media-knowledge/06.03-obsidian-vault-and-rag-pipeline.md)**: Local Obsidian Markdown format, GitHub vault sync, ingestion script, pgvector embeddings, public note routing.

---

## 07 — Interlude / Field Notes / Reserved
- **[07.00 — About Chapter 07: Intentional Buffer Space](./07-field-notes/07.00-about-this-chapter.md)**: Architectural purpose of Chapter 07 as an uncommitted staging ground for future paradigms.
- **[07.01 — Speculative Interfaces and Emergent Technology Notes](./07-field-notes/07.01-speculative-interfaces-and-notes.md)**: Active explorations (WebGPU compute shaders, neural audio synthesis, spatial WebXR interfaces).

---

## 08 — AI, APIs and Automation
- **[08.00 — AI Architecture and Multi-Model Dispatching](./08-ai-automation/08.00-ai-architecture-and-model-routing.md)**: OpenRouter SDK integration, model routing (Gemini 2.5/3, Claude 3.5, GPT-4o), structured JSON validation.
- **[08.01 — Automated Pipelines: Reading Digest and Opportunity Radar](./08-ai-automation/08.01-automated-pipelines-digest-and-opportunities.md)**: Daily Reading Digest cron execution, Opportunity Radar web scraper, Resend notification pipeline.
- **[08.02 — Embeddings, Semantic Search, and Vault Chat](./08-ai-automation/08.02-embeddings-and-semantic-search.md)**: Text embedding generation, pgvector cosine similarity matching, RAG context assembly, Vault Chat agent.
- **[08.03 — AI Failure Modes, Hallucination Postmortems, and Lessons](./08-ai-automation/08.03-ai-failure-modes-and-human-corrections.md)**: Structured postmortems: `AI Assumption → Problem Caused → Human Correction → Permanent Lesson`.

---

## 09 — Infrastructure, Security, Operations and Limits
- **[09.00 — Infrastructure Topology, Edge Networks, and DNS](./09-infrastructure-security-ops/09.00-infrastructure-topology-and-dns.md)**: Cloudflare DNS, Vercel edge/serverless compute, Supabase Postgres, Resend SMTP, R2 object store.
- **[09.01 — Service Quotas, CPU Limits, and Cost Optimization](./09-infrastructure-security-ops/09.01-limits-quotas-and-performance-tuning.md)**: Vercel Fluid Active CPU boundaries, Supabase connection limits, R2 egress optimization.
- **[09.02 — Operational Incident Postmortems and Troubleshooting](./09-infrastructure-security-ops/09.02-operational-incident-postmortems.md)**: Real postmortems (`Problem → Cause → Fix → Prevention`): hydration mismatch, Vercel file descriptor leak, CDN cache bleeding.
- **[09.03 — Security Invariants, Privacy Policies, and Backups](./09-infrastructure-security-ops/09.03-security-model-privacy-and-backups.md)**: Zero-secrets standard, anonymous analytics privacy, database point-in-time recovery, R2 replication.

---

## 10 — Evolution, Alternatives and Onboarding
- **[10.00 — Zero-to-One Developer Onboarding Runbook](./10-evolution-alternatives-onboarding/10.00-zero-to-one-setup-guide.md)**: Complete setup from git clone to local dev server, database migration execution, seed data hydration.
- **[10.01 — Technology Substitutes and Portability Analysis](./10-evolution-alternatives-onboarding/10.01-technology-alternatives-and-portability.md)**: Independent migration paths for Vercel, Supabase, Cloudflare, Resend, OpenRouter; vendor lock-in index.
- **[10.02 — Ten-to-Fifteen Year System Continuity Architecture](./10-evolution-alternatives-onboarding/10.02-ten-to-fifteen-year-continuity-plan.md)**: Long-term survival strategy: static HTML fallbacks, SQLite/flat-file portability, markdown permanence.
