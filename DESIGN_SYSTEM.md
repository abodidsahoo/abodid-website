# Design Studio token architecture

Design Studio is the editable source of truth for the shared visual language. It controls primitives; pages and components consume semantic roles.

## Token layers

1. **Editable primitives** — values saved by Design Studio, such as `--pop-blue`, `--ds-card-title-weight`, and `--ds-radius-card`.
2. **Semantic roles** — computed values such as `--type-role-card-title-size`, `--type-role-reading-size`, and `--design-radius-panel`.
3. **Component aliases** — local names such as `--services-blue` or `--paper-font` that point to a semantic role or canonical palette token.

New components should consume semantic roles instead of introducing another unrelated scale.

## Surface and foreground contracts

Colour-bearing components declare their surface explicitly with `data-pop-surface`. The shared system then supplies the background, foreground, muted text, focus outline and text-selection colours as one contract.

- Cream, white, pink, yellow, lime, orange and cyan always use `--pop-ink`.
- Cobalt and purple always use `--pop-cream`.
- Text selection on light/high-chroma surfaces uses cobalt with cream text.
- Text selection on cobalt or purple uses yellow with ink text.
- Nested colour blocks declare their own `data-pop-surface` and naturally reset the inherited contract.

Do not infer a surface from partial class names or inline-style text. Do not force descendant colours with `!important`. This prevents an outer blue panel from corrupting a nested yellow button, while still allowing the button to inherit a complete accessible pairing.

Design Studio evaluates all nine canonical pairings continuously and blocks publishing if any normal-text pairing falls below 4.5:1.

## Typography roles

- Display / masthead: the largest identity or index statement.
- Page title: the primary `h1` for a page or article.
- Section title: major divisions inside a page.
- Card title: project, resource, research, note and editorial-card titles.
- Body copy: navigation descriptions, summaries and interface copy.
- Long-form reading: article, note and research prose.
- Metadata / eyebrow: dates, categories, labels and compact technical context.

Each responsive role exposes minimum size, fluid viewport value, maximum size, weight, line height and letter spacing.

## Publishing model

- Editing updates the Design Studio preview only.
- **Save draft** stores work without changing the public site.
- **Publish across site** atomically promotes the complete token set.
- Published values are cached in the browser and refreshed from Supabase on page load.
- Bundled CSS values remain as fallbacks when the network or database is unavailable.
- Every publication is captured in `design_system_versions` and can be loaded back as a draft.

## Exception policy

Art-directed experiments may keep local tokens when their difference is meaningful. Local tokens should still alias the shared system where possible. A literal colour, size or weight should be reserved for a genuine exception and documented next to the declaration.

An exception must never override the semantic foreground of an entire descendant tree. If an element introduces a new colour field, give that element its own surface contract instead.

## Relevant files

- `src/lib/designTokens.js` — editable token schema, labels, limits and defaults.
- `src/styles/design-system.css` — semantic role calculations.
- `src/styles/design-studio.css` — the Pop Editorial Creator Studio interface.
- `src/components/admin/DesignStudio.jsx` — Creator Studio interface.
- `src/components/DesignTokenRuntime.astro` — public runtime loader.
- `supabase/migrations/20260923120000_create_design_system_settings.sql` — persistence, permissions and version history.
