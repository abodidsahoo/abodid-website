# Abodid Pop Editorial Design System

This reference captures the visual language rendered by the current `abodid.com` homepage on 1 September 2026. Use it as a reusable system, not as a mandate to copy the homepage section-for-section.

## 1. Character

The style combines Swiss/editorial hierarchy with playful high-chroma colour blocking. It should feel confident, human, culturally engaged, and slightly tactile: large neo-grotesk type, compressed metadata, asymmetric card grids, warm paper surfaces, documentary imagery, thin ink keylines, and small physical hover movements.

The signature is the relationship between colour, type, and geometry. Do not reproduce it as a generic colourful card UI.

## 2. Canonical colour tokens

```css
:root {
  --pop-blue: #2444ca;
  --pop-pink: #ff7eb5;
  --pop-yellow: #ffe44f;
  --pop-lime: #caff48;
  --pop-orange: #ff875c;
  --pop-purple: #5524c7;
  --pop-cyan: #62e6ff;
  --pop-cream: #fff8e8;
  --pop-ink: #15130f;
  --pop-border: rgba(21, 19, 15, 0.78);
  --pop-line: rgba(21, 19, 15, 0.24);
}
```

### Roles

- Cobalt `#2444ca`: site canvas, navigation, evidence/trust sections, dark cards, major structural bands.
- Hot pink `#ff7eb5`: primary editorial surface, hero copy, service and writing sections, warm cards.
- Acid yellow `#ffe44f`: calls to action, highlighted cards, badges, active accordion rows.
- Lime `#caff48`: occasional accent, workshop/navigation card, hover state. Use sparingly.
- Purple `#5524c7`: enquiry/form band and focus accent.
- Warm cream `#fff8e8`: paper panels, inputs, light cards, and text on dark chromatic surfaces.
- Near-black ink `#15130f`: primary text, borders, icons, and dark media placeholders.
- Orange and cyan are secondary accents. Do not make every page use the full palette.

### Colour distribution

Choose one dominant field colour per section, one contrasting surface colour for its cards, and at most one accent. A typical full page is approximately 35–45% cobalt, 30–40% pink, 10–20% cream, and 5–15% yellow/lime/purple accents, adjusted to the content.

### Contrast ratios

Measured WCAG contrast ratios:

| Pair | Ratio | Use |
|---|---:|---|
| Ink on cream | 17.53:1 | Body, controls, light panels |
| Ink on lime | 15.82:1 | Accent panels and labels |
| Ink on yellow | 14.54:1 | CTAs, badges, cards |
| Ink on cyan | 12.62:1 | Optional accent surfaces |
| Ink on pink | 7.87:1 | Primary editorial surfaces |
| Ink on orange | 7.84:1 | Optional accent surfaces |
| Cream on purple | 8.06:1 | Forms and deep bands |
| Cream on cobalt | 7.20:1 | Navigation, dark cards, evidence sections |

Ink on cobalt is only 2.43:1 and ink on purple is 2.18:1. Cream on pink, yellow, lime, orange, or cyan is also too weak for text. Use the accessible pairings above. The existing system may compute foreground colour per solid surface; retain that behaviour when surfaces can vary.

For normal body text, target at least 4.5:1. For large text, target at least 3:1. The 78% ink lede on pink measures about 5.33:1. Do not use 60% ink on pink for normal text; it is about 3.51:1. Borders and purely decorative lines need not meet text contrast but interactive boundaries should remain obvious.

## 3. Typography

### Families

- Primary/display/body/UI: `"Satoshi-Variable", "Satoshi-Regular", "Poppins", sans-serif`
- Mono/labels/actions: `"Satoshi-Variable", "Satoshi-Regular", "Space Mono", "Inconsolata", monospace`

Satoshi Variable supports weights 300–900. The mono stack intentionally begins with Satoshi in the current implementation, creating compact technical labels without a dramatic font change. Retain the stack unless a page already has a purposeful true-mono treatment.

### Hierarchy

```css
/* Hero identity */
font: 720 clamp(2.8rem, 4.5vw, 5rem)/0.82 var(--font-display);
letter-spacing: -0.075em;

/* Hero descriptor */
font: 480 clamp(1.2rem, 1.75vw, 1.85rem)/1.15 var(--font-display);
letter-spacing: -0.025em;

/* Hero statement */
font: 300 clamp(2.25rem, 3.6vw, 4.2rem)/0.96 var(--font-display);
letter-spacing: -0.03em;

/* Major section heading */
font: 620 clamp(3rem, 6.7vw, 7rem)/0.9 var(--font-display);
letter-spacing: -0.065em;

/* Project/card heading */
font: 620 clamp(1.65rem, 2.6vw, 3.2rem)/0.96 var(--font-display);
letter-spacing: -0.045em;

/* Body */
font: 450 clamp(0.94rem, 1.12vw, 1.1rem)/1.45 var(--font-body);

/* Eyebrow / metadata */
font: 750 clamp(0.68rem, 0.9vw, 0.78rem)/1.35 var(--font-mono);
letter-spacing: 0.08em to 0.11em;
text-transform: uppercase;
```

Use tight negative tracking and compressed line-height only on large headings. Body copy stays around 1.45–1.6 line-height. Keep body width around 36–48rem or 24–36ch for large statements. Use `text-wrap: balance` on display lines and `text-wrap: pretty` on summaries.

## 4. Spacing and geometry

```css
:root {
  --pop-gap: 8px;
  --pop-page-gutter: clamp(1rem, 3vw, 3.5rem);
  --pop-section-inline: clamp(1rem, 6vw, 6rem);
  --pop-section-block: clamp(4rem, 6.5vw, 7rem);
  --pop-card-inset: 10px;
  --pop-radius-panel: clamp(18px, 2vw, 28px);
  --pop-radius-card: clamp(14px, 1.5vw, 22px);
  --pop-radius-control: 14px;
  --pop-radius-media: clamp(10px, 1.2vw, 16px);
  --pop-control-height: 52px;
  --pop-motion: 180ms ease;
}
```

- The 8px gap is the defining structural seam between cards and panels.
- Full-bleed card grids use 8px outer padding and 8px internal gaps.
- Editorial content bands use responsive 64–112px vertical breathing room and 16–96px side padding.
- Content bands cap inner width near 1480px.
- Large cards typically use 10px media inset, then 18–26px copy padding.
- Buttons are 44–52px tall. Do not reduce touch targets below 44px.
- Borders are normally 1px solid `--pop-border`; internal dividers may use `currentColor` or `--pop-line`.

## 5. Layout grammar

### Page frame

- Use full-width colour bands rather than a white page centered in a neutral canvas.
- Keep the header at 72px, sticky, cobalt, with compact yellow/pink pill controls and a centered uppercase navigation row.
- Separate sections primarily by colour change, not by extra whitespace or large shadows.

### Hero

- Desktop: two-column grid, approximately `1.55fr 1fr`, minimum right rail 360px, 8px gap.
- Left is a dominant editorial copy panel; right is a stacked project/media rail.
- Use a viewport-aware height around `clamp(720px, calc(100svh - 112px), 1000px)` when content permits.
- Pair a strong name/identity line with a lighter, larger statement. Do not make every line equally bold.

### Project grids

- Build on 12 columns and alternate 7/5, 5/7, 7/5 spans. This creates rhythm without masonry randomness.
- Cards are tall, image-led, and self-contained. Use a minimum height around 540–720px on desktop when project imagery is central.
- Media fills the flexible portion; metadata and outcomes sit below with a thin divider.
- Alternate pink, cobalt, and yellow surfaces. On cobalt, switch to cream foreground.

### Evidence and testimonials

- Use a cobalt field with a very large cream heading.
- Organisation names live in flexible coloured pills; role text can replace the name on hover.
- Testimonials form a horizontal snap row of tall pink/yellow cards rather than a conventional carousel chrome.

### Accordions and services

- Use full-width stacked rows with alternating yellow, cobalt, pink, cobalt headers.
- Each row has a number, large title, small count, and plus/cross glyph.
- Expanded content returns to warm cream and uses a two-column explanation/scope layout.
- A large yellow closing CTA card should end the section.

### Forms and writing

- Forms sit on purple with cream text and cream inputs.
- Writing/newsletter sections sit on pink with a cream bordered inset card.

### Navigation cards and footer strip

These are two independent modules; neither requires adding the other.

- **Navigation cards** (also “four blocks” or “footer navigation”): Work, Curation, Workshops, and About in a four-card grid, respectively yellow, cobalt, lime, and cream. Preserve the existing labels and destination links. Use cream text on the cobalt card and ink on the other cards.
- **Footer strip** (also “bottom line”, “bottom strip”, or “utility strip”): the compact cream band containing the site name, copyright, social links, and utility/legal links. Use ink text, preserve existing destinations, and let the content wrap on small screens.
- **Full footer**: navigation cards followed by the footer strip.

For an unqualified “add a footer”, add only the footer strip. A request for one module does not add the other or remove one already present. When implementation is requested, expose the parts independently through separate components or explicit options in the existing component, preserving current callers unless the user asks to change them. Retain the 8px seams, thin keylines, and established panel radii. A strip-only composition must not reserve space for absent cards.

## 6. Borders, radii, and shadows

- Use thin dark outlines to make colour fields feel printed and physical.
- Large panels: 18–28px radius.
- Standard cards: 14–22px radius.
- Media: 10–16px radius.
- Pills/controls: 14px radius; pill shape comes from compact height, not `999px` everywhere.
- Default cards have no shadow. Use subtle `rgba(21, 19, 15, 0.08)` shadows only for newsletter panels, focused/elevated controls, or hover lift.
- Never combine strong shadows, gradients, blur, and borders on the same component.

## 7. Imagery

- Prefer documentary, human, exhibition, cultural, and process imagery over polished stock photography.
- Use `object-fit: cover` for project cards and intentional `object-position` when the subject needs protection.
- Keep a black/ink fallback surface for missing or cinematic media.
- Letterbox interface demos or screenshots inside a chromatic mat with an inner 1px outline.
- Image hover motion is a restrained scale from 1 to about 1.025 over 500–600ms.

## 8. Interaction and motion

- Hover lift: `translateY(-2px)`; optional low shadow.
- Destination arrow: translate roughly `2px, -2px` on hover.
- List arrows: translate horizontally about 4px.
- Media zoom: 1.025; large CTA portrait may reach 1.04.
- Standard control transitions: 160–200ms ease.
- Slideshow fades: about 550ms with `cubic-bezier(0.2, 0.8, 0.2, 1)`.
- Underline only the link text on hover/focus; offset 3–4px and thickness 1.5–2px. Destination arrows such as `↗` must never carry an underline, including when moved or when text wraps. Keep the arrow in a separate `aria-hidden="true"` element with `display: inline-block` and `text-decoration: none` (an inline child with `text-decoration: none` alone does not stop an ancestor’s underline). Prefer applying decoration to a separate text-label span. Do not simulate an underline with a border or pseudo-element spanning both label and arrow.
- Provide visible focus states. Purple is appropriate on light surfaces; cream/ink outlines may be better on dark surfaces.
- Under `prefers-reduced-motion: reduce`, remove meaningful transforms and set animation/transition duration to approximately 0.01ms.

## 9. Responsive behaviour

- Break at approximately 980px: hero becomes one column, 12-column feature grids simplify, navigation cards become two columns, and expanded accordion content becomes one column.
- Break at approximately 720px: project grid becomes one column, navigation cards become one column, header switches to a compact menu, section padding becomes 1rem, and buttons become full-width when useful.
- Mobile hero typography uses gentler line-height and less aggressive tracking:
  - name: `720 clamp(2.5rem, 11vw, 3.6rem)/0.85`
  - descriptor: `480 clamp(1.05rem, 4vw, 1.35rem)/1.15`
  - statement: `300 clamp(1.45rem, 5.4vw, 1.95rem)/1.14`
- Maintain the 8px seam rhythm on mobile. Do not collapse all section space into an undifferentiated card stack.

## 10. Accessibility and implementation invariants

- Preserve semantic headings, landmarks, lists, figures, `details/summary`, form labels, alternative text, and skip navigation.
- Never rely on colour alone for links, active state, or expanded state. Combine it with underline, icon, label, or geometry.
- Ensure all controls are keyboard reachable and focus-visible.
- Avoid text over photography unless a tested solid caption band or overlay guarantees contrast.
- Allow content length to drive height; use minimum heights rather than fixed heights for copy-heavy components.
- Preserve server data, forms, routes, analytics attributes, and component behaviour during visual-only redesigns.
- Prefer CSS custom properties and shared primitives, but do not force a global refactor when a scoped page implementation is safer.

## 11. Quick composition recipes

Use these as starting points, not templates to copy verbatim.

- Content index: cobalt canvas + oversized cream heading + asymmetric pink/blue/yellow cards + coloured filter pills.
- Case study: pink or cream editorial hero + cobalt facts rail + full-width documentary media + numbered cream/pink process panels + yellow CTA.
- Research tool: cobalt shell + yellow title/action band + cream workspace + pink contextual panels + purple submission band.
- About page: pink identity hero + cream biography panel + cobalt timeline/evidence band + yellow conversation CTA.
- Service page: pink intro + colour-coded accordion stack + cream proof cards + purple enquiry form.

The page should be recognisably related to the homepage while still responding to its own content and purpose.
