# Surface and Button Contrast Rules

Strict surface-contrast pairings must be preserved across all pages, components, and nested cards in this codebase:

## 1. Surface and Foreground Contracts
- **Deep Surfaces (`blue`, `purple`)**:
  - Background: `var(--pop-blue)` / `var(--pop-purple)`
  - Text: **ALWAYS** `var(--pop-cream)` / `#fff8e8` (or white)
  - Links/Headers: `var(--pop-cream)`
- **Light & High-Chroma Surfaces (`yellow`, `lime`, `pink`, `cyan`, `orange`, `cream`, `white`)**:
  - Background: `var(--pop-yellow)`, `var(--pop-lime)`, `var(--pop-cream)`, etc.
  - Text: **ALWAYS** `var(--pop-ink)` / `#15130f` (black ink)
  - Buttons / Controls: Must have dark ink text (`var(--pop-ink)`), dark borders (`1.5px solid var(--pop-ink)`), and solid ink shadows (`0 3px 0 var(--pop-ink)` or `0 4px 0 var(--pop-ink)`).

## 2. Nested Control Immunity (Critical Rule)
When a light-surface button (e.g., yellow `Go to the experiment` button or lime `Start a conversation` button) is placed inside a deep blue or purple card/section:
- Parent deep containers MUST NOT use broad `span`, `p`, or `div` color overrides with `!important` that cascade into nested controls.
- Nested controls and all their inner elements (`span`, `strong`, `b`, `a`, `svg`) MUST retain `var(--pop-ink) !important`.
- Nested controls declare their own surface (`data-pop-surface="yellow"`, `data-pop-surface="lime"`) and reset their contract completely.
