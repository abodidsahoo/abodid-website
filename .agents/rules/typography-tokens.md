# Typography: use the design-system type roles, not ad-hoc sizes

When a font size needs to go up or down ("a bit larger", "slightly smaller"), step to the next type-role token instead of inventing a new `clamp()` or rem value.

Type roles, defined in `src/styles/design-system.css` (admin overrides in `src/styles/admin-global.css` under `.admin-document`), from smallest to largest:

1. `--type-role-label-*` (metadata, eyebrows, chips)
2. `--type-role-body-*`
3. `--type-role-reading-*`
4. `--type-role-card-title-*`
5. `--type-role-section-title-*`
6. `--type-role-page-title-*`
7. `--type-role-display-*`

Rules:
- Use the whole role: `-size`, `-weight`, `-line` and `-track` together, not just the size.
- Include a fallback equal to the token's current value, e.g. `var(--type-role-card-title-size, clamp(1.4rem, 2.2vw, 1.9rem))`.
- Don't add breakpoint font-size overrides when the token's `clamp()` already covers that range.
- If no role fits, ask before adding a one-off value. Don't edit the token values themselves unless explicitly asked; that changes the whole site.
- Spacing that keeps glyphs from being clipped (e.g. `padding-bottom: 0.12em` on line-clamped headings) is fine and isn't a size change.
