# Abodid System Manual

The Abodid System Manual is the canonical technical, creative, and operational reference for the complete `abodid.com` digital ecosystem.

This manual serves as the permanent source of truth for software engineers, designers, researchers, operational maintainers, and automated reasoning agents interacting with the system.

## Primary Access Points

- **[Master Index (INDEX.md)](./INDEX.md)**: Direct links to every permanent chapter and section.
- **[System Glossary (GLOSSARY.md)](./GLOSSARY.md)**: Precise definitions of domain concepts, technical terms, and architectural acronyms.
- **[System Changelog (CHANGELOG.md)](./CHANGELOG.md)**: Audit record of architectural revamps, schema migrations, and documentation updates.

## Structural Overview

The manual is organized into 11 permanent top-level chapters (`00` through `10`):

| Chapter | Title | Primary Scope |
| :--- | :--- | :--- |
| **00** | [Manual, Index and Versioning](./00-manual/00.00-manual-charter.md) | Charter, audience personas, numbering rules, source-of-truth invariants, documentation gap audit. |
| **01** | [Philosophy, Manifesto and Creative Practice](./01-philosophy-manifesto/01.00-core-manifesto-and-positioning.md) | Creative technologist ethos, research-through-making, human-directed AI constraints. |
| **02** | [Information Architecture and Content System](./02-information-architecture/02.00-route-hierarchy-and-subdomains.md) | Multi-subdomain hierarchy, route maps, canonical URL rules, SEO metadata, authoring pipelines. |
| **03** | [Visual System, Pop Editorial and Moodboards](./03-visual-system/03.00-abodid-pop-editorial-design-system.md) | "Abodid Pop Editorial" tokens, typography hierarchy, palette extraction, moodboards, rejected concepts. |
| **04** | [Projects, Research and Editorial Examples](./04-projects-research/04.00-project-taxonomy-and-structure.md) | Work, Research, Lab, Punctum suite, long-form editorial formats, commercial platforms. |
| **05** | [Application and Code Architecture](./05-application-code-architecture/05.00-astro-core-and-rendering-strategy.md) | Astro 5 SSR/SSG models, middleware execution order, client island hydration, build pipelines. |
| **06** | [Data, Media, Obsidian and Knowledge Systems](./06-data-media-knowledge/06.00-supabase-database-architecture.md) | Supabase Postgres schema, RLS policies, Cloudflare R2 media pipelines, Obsidian RAG ingestion. |
| **07** | [Interlude / Field Notes / Reserved](./07-field-notes/07.00-about-this-chapter.md) | Speculative interface prototypes, temporary technical explorations, emerging technology buffer. |
| **08** | [AI, APIs and Automation](./08-ai-automation/08.00-ai-architecture-and-model-routing.md) | OpenRouter model dispatching, Daily Reading Digest cron, Opportunity Radar, AI error postmortems. |
| **09** | [Infrastructure, Security, Operations and Limits](./09-infrastructure-security-ops/09.00-infrastructure-topology-and-dns.md) | Cloudflare DNS, Vercel compute quotas, incident postmortems, zero-secrets security posture. |
| **10** | [Evolution, Alternatives and Onboarding](./10-evolution-alternatives-onboarding/10.00-zero-to-one-setup-guide.md) | Zero-to-one onboarding runbook, vendor lock-in mitigation, 10–15 year system continuity plan. |

## Documentation Rules

1. **Working Repository as Ground Truth**: Specifications reflect the live production implementation. Planned or deprecated systems are explicitly labeled.
2. **Zero-Secret Exposure**: No credentials, private API keys, environment secret values, or client tokens are ever committed to documentation.
3. **Permanent Numbering**: Numbering hierarchy remains stable across additions. Subsections expand indefinitely without shifting primary chapter keys.
