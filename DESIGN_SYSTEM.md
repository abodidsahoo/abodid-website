# Design Studio token architecture

Design Studio is the editable source of truth for the shared visual language. It controls colour roles and numeric primitives. Pages and components consume these shared roles.

## Token layers

1. **Editable primitives** — values saved by Design Studio, such as `--color-primary`, `--ds-card-title-weight`, and `--ds-radius-card`.
2. **Semantic roles** — computed values such as `--type-role-card-title-size`, `--type-role-reading-size`, and `--design-radius-panel`.
3. **Component aliases** — local names such as `--services-blue` or `--paper-font` that point to a semantic role or canonical palette token.

New components should consume semantic roles instead of introducing another unrelated scale.

## Surface and foreground contracts

Colour-bearing components declare their surface explicitly with `data-pop-surface`. The shared system then supplies the background, foreground, muted text, focus outline and text-selection colours as one contract.

- Background, raised surface, secondary, accent, Additional Colour 1 and Additional Colour 3 use `--color-text`.
- Primary and Additional Colour 2 use `--color-primary-text` for their foreground.
- Action surfaces use `--color-button-text`, independently of body text.
- Text selection reverses the local surface family using the primary and button roles.
- Nested colour blocks declare their own `data-pop-surface` and naturally reset the inherited contract.

Do not infer a surface from partial class names or inline-style text. Do not force descendant colours with `!important`. This prevents an outer blue panel from corrupting a nested yellow button, while still allowing the button to inherit a complete accessible pairing.

Design Studio evaluates nine base pairings and four derived hover/pressed pairings continuously and blocks publishing if any normal-text pairing falls below 4.5:1.

## Editable colour roles

| Control | CSS variable | Existing uses |
| --- | --- | --- |
| Primary colour | `--color-primary` | Site canvas, navigation, structural bands |
| Secondary colour | `--color-secondary` | Editorial panels and writing sections |
| Button colour | `--color-button` | Primary actions, active controls and highlighted cards |
| Accent colour | `--color-accent` | Occasional actions, navigation cards and hover states |
| Additional Colour 1 | `--color-additional-1` | Supporting panels and notices |
| Additional Colour 2 | `--color-additional-2` | Forms, closing bands and focus outlines |
| Additional Colour 3 | `--color-additional-3` | Optional cards and highlights |
| Background colour | `--color-background` | Reading panels, inputs and foreground on deep surfaces |
| Raised surface colour | `--color-surface` | Utility controls and neutral cards |
| Text colour | `--color-text` | Text, icons and keylines |
| Button text colour | `--color-button-text` | Shared action labels and icons |
| Primary surface text colour | `--color-primary-text` | Foreground on primary and deep supporting surfaces |
| Success colour | `--color-success` | Positive feedback |
| Error colour | `--color-error` | Failure and validation feedback |

These are the existing ten palette slots with role-based names and the same initial values. A role can serve several component types. Button colour also controls existing highlighted cards and badges.

Saved drafts, history and browser caches using the previous colour-named keys are translated on read. Explicit role keys take precedence. Publications also include compatibility keys for older open pages. No database rewrite is needed. The existing `data-pop-surface` identifiers and visual modifier classes remain compatibility identifiers for component markup.

The Creative Companies Database, lab experiments such as Punctum, archived editions and the separately deployed Podcast Studio intentionally own their palettes. Photography-derived colours and user-selected board backgrounds are content. Third-party identity controls retain official brand colours. Historical design references describe earlier editions. New shared CSS should use the role variables in this table.

## Universal UI colours

`src/styles/ui-colors.css` defines shared action, field, border, overlay, shadow, focus and disabled roles. Hover and pressed colours mix the selected background with its label colour at 8% and 14%. These exact blends are checked by `evaluateSurfaceContracts`. Components alias these roles instead of storing their own highlight hex values. The newsletter, enquiry form, header, footer, PWA prompt and generic primary actions use this system.

Derived values are declared at body, surface and preview boundaries so nested palettes can recompute locally. The primary/button foreground choices fall back to the previous background/text roles when loading older saved settings. Form feedback includes readable text as well as semantic colour.

The light/dark canvas, surface and text controls remain distinct. Their secondary text, hover surfaces, borders, header and footer values derive from those mode controls. Admin and Land layouts load the published palette too. The global surface contract applies to each surface itself, allowing a nested action or paper panel to own its foreground.

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
- While the Colours tab is active, Defaults and History load colours only.
- Publishing from Colours merges the colour values into the current published numeric settings. A version check rejects stale or concurrent publications.
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
