// Shared artwork for the animated pointer and its native static fallback.
export const EDITORIAL_CURSOR_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48" fill="none">
  <g class="editorial-wand__stem">
    <path d="M18 18L36 36" stroke="{background}" stroke-width="6" stroke-linecap="round"/>
    <path d="M18 18L36 36" stroke="{text}" stroke-width="3.5" stroke-linecap="round"/>
    <path d="M18 18L23 23" stroke="{button}" stroke-width="3.5" stroke-linecap="round"/>
    <path d="M15 8L17 13L22 15L17 17L15 22L13 17L8 15L13 13Z" fill="{background}" stroke="{text}" stroke-width="1.2" stroke-linejoin="round"/>
    <path d="M15 11L16.2 13.8L19 15L16.2 16.2L15 19L13.8 16.2L11 15L13.8 13.8Z" fill="{button}"/>
  </g>
  <path class="editorial-wand__star editorial-wand__star--one" d="M29 2L30.2 5.8L34 7L30.2 8.2L29 12L27.8 8.2L24 7L27.8 5.8Z" fill="{button}" stroke="{text}" stroke-width=".6"/>
  <path class="editorial-wand__star editorial-wand__star--two" d="M5 23L6.2 26.8L10 28L6.2 29.2L5 33L3.8 29.2L0 28L3.8 26.8Z" fill="{background}" stroke="{text}" stroke-width=".6"/>
  <path class="editorial-wand__star editorial-wand__star--three" d="M35 18L35.9 20.6L38.5 21.5L35.9 22.4L35 25L34.1 22.4L31.5 21.5L34.1 20.6Z" fill="{secondary}" stroke="{text}" stroke-width=".6"/>
  <circle class="editorial-wand__star editorial-wand__star--four" cx="5" cy="7" r="1.4" fill="{background}" stroke="{text}" stroke-width=".6"/>
</svg>`;

export const EDITORIAL_ANIMATED_CURSOR_SVG = EDITORIAL_CURSOR_SVG.replace(
  /\{(background|secondary|text|button)\}/g,
  (_, role) => `var(--color-${role})`,
);
