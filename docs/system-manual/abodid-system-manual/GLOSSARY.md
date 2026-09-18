# System Glossary

This glossary provides standardized definitions for technical concepts, architectural components, proprietary terms, and domain models used throughout the Abodid digital ecosystem and this manual.

---

### Abodid Pop Editorial
The proprietary visual design philosophy powering `abodid.com`. It balances bold editorial typography (Satoshi), monospace data surfaces (Inconsolata), high-contrast monochrome structures, electric accent tones, film-like grain textures, and interactive micro-animations.

### Anonymous Session Auth
The authentication mechanism in Supabase (`auth.signInAnonymously()`) enabling privacy-preserving client identification for interactive experiments (e.g., Punctum, Sequence Room, saved curated items) without requiring upfront user email registration.

### Boudoir Viewer
An interactive moodboard component that loads high-resolution photography collections, computes dominant color palettes via ColorThief, and exposes click-to-filter chromatic exploration mechanics.

### Curation Layer (`curation.abodid.com`)
A dedicated subdomain and resource management product offering curated tools, books, articles, and media for creative technologists, featuring curator submissions, bookmarking, and administrative review.

### Fluid Active CPU
The Vercel compute billing metric measuring the actual CPU execution time of Serverless and Edge functions. The architecture uses aggressive static prerendering (`output: 'static'`) to keep Fluid Active CPU usage near zero.

### Glyph Loom
An interactive creative technology experiment exploring parametric typography, dynamic letterform generation, and canvas rendering.

### Human-Directed AI
The development and operational principle where LLMs are used strictly as execution engines under rigid prompt constraints, structured schema validators, and human editorial taste, rather than autonomous agents with unconstrained agency.

### Image Flick
A gesture-controlled Lab experiment utilizing MediaPipe and TensorFlow.js to track hand movements via webcam, allowing users to physically "flick" and browse through image stacks in real-time.

### Invisible Punctum
A research framework and interactive tool exploring Roland Barthes' concept of photographic *punctum*—the involuntary, personal detail in an image that wounds or pierces the viewer—comparing human emotional annotations against multimodal vision model interpretations.

### Island Architecture
A frontend pattern implemented via Astro where the page is rendered as pure static HTML by default, and interactive components ("islands") hydrate client-side JavaScript only where explicitly specified (e.g., `client:load`, `client:visible`).

### Network Intelligence Admin
A private, owner-only dashboard (`/admin/network`) for exploring professional connection networks, featuring pgvector semantic search, full-text keyword matching, and public web entity verification.

### Opportunity Radar
An automated discovery engine combining web scrapers, OpenRouter LLM extraction, and priority ranking to detect relevant creative grants, exhibitions, residencies, and client RFPs.

### pgvector
The PostgreSQL extension running inside Supabase that stores and indexes high-dimensional vector embeddings (e.g., 1,536-dimension embeddings) for semantic search across Obsidian notes and professional networks.

### Pop Editorial Block
The standardized JSON data unit within `portfolio_blocks` used to render structured rich media (text, image grids, audio players, interactive embeds, quote callouts) across Work, Lab, and Research case studies.

### Reading Digest
An autonomous system running via Supabase pg_cron and Edge Functions that crawls, canonicalizes, deduplicates, and ranks 5 foundational and recent articles daily, delivering a formatted email via Resend at 08:00 Asia/Kolkata.

### Sequence Room (formerly Photo Board)
An interactive spatial workspace in the Lab allowing users to sequence, reorder, group, and annotate photographs in a tactile Polaroid-style canvas.

### Unified Work Portfolio
The project-first content model introduced in July 2026 (`portfolio_projects`, `portfolio_revisions`, `portfolio_blocks`) replacing disparate legacy blog/journal tables with an atomic draft/publish revision lifecycle.

### Vault RAG (Retrieval-Augmented Generation)
The pipeline that ingests local Obsidian Markdown notes, generates semantic embeddings, stores them in Supabase, and provides semantic retrieval and conversational AI answers via `/api/vault-chat`.
