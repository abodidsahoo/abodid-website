---
name: abodid-pop-editorial
description: Apply Abodid Sahoo's saved high-chroma pop-editorial website design system to existing or new pages. Use when the user asks to redesign an old site page in the new homepage look, match abodid.com, use the saved pop-editorial language, or invokes $abodid-pop-editorial. Preserve the page's content and functionality unless the user asks to change them.
---

# Abodid Pop Editorial

Rebuild the requested page so it feels native to Abodid's current homepage: bold, optimistic, research-led, editorial, tactile, and intentionally modular.

Before designing or implementing, read [references/design-system.md](references/design-system.md) completely. Treat its colour, typography, geometry, layout, interaction, responsive, and accessibility guidance as the canonical system.

## Working method

1. Inspect the target page and its implementation. Identify its content hierarchy, reusable components, assets, data sources, routes, interactions, and responsive behaviour.
2. Preserve meaning, content, links, data, and working behaviour by default. Change information architecture only when the prompt requests it or the existing structure prevents a coherent redesign.
3. Recompose the page using the system primitives: colour-blocked editorial sections, an 8px structural rhythm, fine dark keylines, asymmetric grids, Satoshi typography, compact uppercase mono labels, inset media, and restrained motion.
4. Use the canonical tokens from the reference instead of sampling approximate colours or inventing a second visual language. Add page-local semantic aliases when useful, but map them to the canonical tokens.
5. Choose foreground colour by contrast: ink on light/high-chroma surfaces; cream on cobalt and purple. Do not place cream text on pink, yellow, lime, orange, or cyan.
6. Make the result responsive from the start. Desktop compositions may be asymmetric; collapse them deliberately at 980px and 720px without shrinking touch targets or editorial hierarchy.
7. Implement the redesign in the page's existing framework and component conventions. Reuse working shared header, footer, form, and media components when they already express the system.
8. Verify the rendered page at desktop and mobile widths. Check overflow, text wrapping, card rhythm, media crops, focus states, reduced-motion behaviour, and contrast. Run the project's relevant checks before handing off.

## Footer requests

Treat navigation cards and the footer strip as independently selectable parts. “Add a footer” defaults to the footer strip only; “add the navigation cards” or “add the four blocks” means the Work, Curation, Workshops, and About cards only; “add the full footer” means both, with the cards above the strip. Accept “bottom line” and “utility strip” as names for the footer strip. Follow explicit scope and preserve existing page parts unless their removal is requested. See the navigation cards and footer strip section in the design-system reference for styling.

## Design judgment

- Lead with one strong composition per section. The palette is vivid enough; avoid extra gradients, glass effects, decorative shadows, and excessive ornament.
- Use colour as structure and navigation, not random decoration. Adjacent surfaces should alternate purposefully.
- Prefer 1px keylines and spacing over shadows. Use only small, low-opacity shadows for lift on a few interactive or elevated elements.
- Keep radii soft but editorial, never pillowy everywhere. Large containers use 18–28px; inner media 10–16px; controls 14px.
- Preserve visual tension through asymmetry, dense information, oversized headings, and generous section breathing room.
- Keep labels short, uppercase, mono, and tracked. Keep body copy readable and sentence case.
- Use arrow glyphs such as `↗` and `→` consistently for destinations and progression. Underlines belong strictly to the adjacent link text; never underline the arrow, including on hover/focus or wrapped lines.
- Avoid generic SaaS styling, muted neutral dashboards, blue-purple gradients, glassmorphism, giant hero whitespace without structure, and a uniform grid of identical cards.

## Deliverable expectation

When asked to redesign a page, implement and verify it rather than returning only a style recommendation. Report the page changed, the major system choices applied, and any intentionally preserved functionality.
