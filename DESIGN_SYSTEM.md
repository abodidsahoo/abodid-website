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

Typography contract **v2** uses Satoshi upright throughout ordinary site UI. The
seven treatments share eight size anchors. Page title and section title retain
their separate compatibility keys but use the same heading scale; reading uses
the body size and rhythm.

| Treatment | Mobile → desktop at the default root size | Default weight | Line height |
| --- | --- | --- | --- |
| Display / masthead | 48 → 96px | 750 | 1.05 |
| Page / section heading | 48 → 80px | 750 | 1.05 |
| Card title | 24 → 32px | 750 | 1.2 |
| Lead / featured quote | 24 → 32px | 450 | 1.4 |
| Body / long-form reading | 18px | 450 | 1.6 |
| Interface / controls | 16px | 600 | 1.4 |
| Small / metadata | 14px | 600 | 1.4 |

The table describes rendered CSS pixels for a 16px root. Implement sizes in
`rem`, using the semantic roles in `src/styles/design-system.css`. Responsive
headings combine a rem contribution with a viewport contribution and clamp to
the shared endpoints. Body, controls and metadata keep a fixed rem size.

Use **350 light**, **450 regular**, **600 medium**, and **750 bold**. Reserve
light weight for large editorial text, paired with bold text at the same size.
Do not use light weight for small labels or reading copy. The shared wordmark
has a documented brand size; decorative arrows can use contextual `em` sizing.

Prefer the full role shorthand and its matching tracking value:

```css
.project-title {
  font: var(--type-role-card-title-font);
  letter-spacing: var(--type-role-card-title-track);
}
.project-summary {
  font: var(--type-role-body-font);
  max-inline-size: var(--type-measure-body);
}
```

Utility classes include `t-display`, `t-title`, `t-heading`, `t-card-title`,
`t-lead`, `t-body`, `t-ui`, and `t-label`. Use `--type-role-subheading-font`
for compact article subsections: 24px / 600, subordinate to card-sized section
headings and above body copy. The newsletter byline uses the compact 24px lead
size, rather than inventing another fluid scale.

Cap reading columns with `--type-measure-body` (62ch), introductory text with
`--type-measure-lead` (32ch), and headings where appropriate with
`--type-measure-heading` (20ch). Narrow containers can shrink below these caps.
Use natural wrapping and content-driven heights. Adjust layout or stack adjacent
actions when text needs room; do not shrink text to fit a card. Keep semantic
heading order independent of visual size. Test at 320px and with enlarged text.

`npm run check:typography` checks migrated page families and shared components
for new local font-size/weight scales. New standard components should join its
file list. Intentional art direction requires a documented exception, rather
than a broad override of ordinary UI.

Old saved token publications are upgraded **in memory** to v2 typography while
retaining their colours, layout values, corner settings and stored history.
New saves include `__typographyVersion: 2`; later edits made in Design Studio
remain effective on reload. Colour-only publication preserves the effective
typography. No database rewrite or additional table is required.

## Publishing model

- Editing updates the Design Studio preview only.
- While the Colours tab is active, Defaults and History load colours only.
- Publishing from Colours merges the colour values into the current published numeric settings. A version check rejects stale or concurrent publications.
- **Save draft** stores work without changing the public site.
- **Publish across site** atomically promotes the complete token set.
- Published values are cached in the browser and refreshed from Supabase on page load.
- Bundled CSS values remain as fallbacks when the network or database is unavailable.
- Every publication is captured in `design_system_versions` and can be loaded back as a draft.

## Site themes

Creator Studio → Site Design → Themes previews and publishes the public site's
appearance. **Original** uses the existing published design tokens and local
page styles. **Crimson & Cream** ships as a saved two-colour preset. Saved themes
can be edited independently and previewed on real pages in the admin panel.
Publishing takes a snapshot of the selected pair. Saving a preset does not
update its live snapshot.

Select **Original** and **Publish theme** to switch back. Theme publication
updates only `published_theme` in the settings row. The Original colours,
existing history and shared typography and layout values remain in the design
tokens. The existing Colors tab edits the Original palette.

Two-colour themes use one background and one foreground role for light and
dark display modes. The Vite PostCSS transform supplies those roles to older
colour declarations when the theme is active. Embedded component styles can
use the same optional roles with their original CSS values as fallbacks.
Independently themed routes are listed in `src/lib/siteThemes.js`.

Each theme also saves a corner style. **Sharp** squares off authored corners,
including local and inline component styles, across the Astro site. **Rounded**
uses each component's regular styles and can override the shared panel, card,
control and media radii. **Use original radii** clears those four overrides.
Switching to Sharp retains the theme's saved Rounded values.

Original inherits the existing published palette and starts with its regular
radii. Crimson & Cream is seeded with Sharp. Saving either theme updates its
draft, and **Publish theme** promotes its saved appearance. Earlier published
themes without a corner setting render with their regular component radii.

**Header and footer** is saved per theme. The shared header pairs the abodid.com
wordmark with journal navigation and the Visual Index menu. The shared footer
uses the Friday Evenings postcard and colophon. Compact-footer pages show the
colophon alone. **Divider lines** uses full-width separators. **Boxed** frames
the menu button and applies the theme’s panel corners to the postcard.
Earlier themes without a layout setting use Boxed.

Use upright type throughout the site. Pair light and bold weights for
editorial contrast and preserve semantic emphasis in article markup.

Use `NativeSelect` for styled dropdown fields. It keeps the browser's picker
and sets a shared text inset, chevron inset, and gap. The chevron is centered
vertically and follows the inline end in either reading direction.

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
