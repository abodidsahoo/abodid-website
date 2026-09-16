export const prerender = false;

import {
    generateOgImage,
    cleanTitleText,
    detectCategory,
    resolveTheme,
    cleanSubtitleText,
    getTitleFontSize,
} from '../../lib/og-helper';

function sanitizeInput(raw: string | null, maxLength = 240): string | undefined {
    if (typeof raw !== 'string') return undefined;
    const cleaned = raw.replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim();
    if (!cleaned) return undefined;
    const lowered = cleaned.toLowerCase();
    if (lowered === 'undefined' || lowered === 'null') return undefined;
    return cleaned.slice(0, maxLength);
}

function popSvgFallback(
    rawTitle: string,
    rawDesc?: string,
    explicitTheme?: string,
    explicitCategory?: string
): Response {
    const cleanTitle = cleanTitleText(rawTitle);
    const category = detectCategory(cleanTitle, explicitCategory);
    const theme = resolveTheme(cleanTitle, category, explicitTheme);
    const cleanSub = cleanSubtitleText(rawDesc, cleanTitle);
    const { fontSize } = getTitleFontSize(cleanTitle.length);

    const escapeXml = (str: string) =>
        str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');

    const escapedTitle = escapeXml(cleanTitle);
    const escapedCategory = escapeXml(category);
    const escapedSub = cleanSub ? escapeXml(cleanSub) : null;

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <style>
      @import url('https://api.fontshare.com/v2/css?f[]=satoshi@900,700,500&amp;display=swap');
      .font-black { font-family: 'Satoshi', system-ui, -apple-system, sans-serif; font-weight: 900; }
      .font-bold { font-family: 'Satoshi', system-ui, -apple-system, sans-serif; font-weight: 700; }
      .font-med { font-family: 'Satoshi', system-ui, -apple-system, sans-serif; font-weight: 500; }
    </style>
  </defs>

  <!-- Canvas Background -->
  <rect width="1200" height="630" fill="${theme.bg}" />

  <!-- Outer Shadow / Pop Boundary -->
  <rect x="36" y="36" width="1128" height="558" rx="26" fill="${theme.bg}" stroke="${theme.border}" stroke-width="3" />

  <!-- Header: Brand Badge -->
  <g transform="translate(76, 76)">
    <rect width="190" height="42" rx="21" fill="${theme.badgeBg}" stroke="${theme.badgeBorder}" stroke-width="2" />
    <circle cx="24" cy="21" r="5" fill="${theme.badgeDot}" stroke="#15130f" stroke-width="1.5" />
    <text x="38" y="27" class="font-black" font-size="14" letter-spacing="1.2" fill="${theme.badgeText}" text-transform="uppercase">ABODID SAHOO</text>
  </g>

  <!-- Header: Category Badge -->
  <g transform="translate(940, 76)">
    <rect width="184" height="42" rx="21" fill="${theme.badgeBg}" stroke="${theme.badgeBorder}" stroke-width="2" />
    <text x="92" y="26" class="font-bold" font-size="12" letter-spacing="1" fill="${theme.badgeText}" text-anchor="middle" text-transform="uppercase">${escapedCategory}</text>
  </g>

  <!-- Center Title -->
  <g transform="translate(600, 310)">
    <text x="0" y="0" class="font-black" font-size="${fontSize}" letter-spacing="-1.5" fill="${theme.text}" text-anchor="middle">${escapedTitle}</text>
  </g>

  <!-- Center Subtitle Pill (if present) -->
  ${
      escapedSub
          ? `<g transform="translate(600, 380)">
    <rect x="-380" y="0" width="760" height="52" rx="14" fill="${theme.subtitleBg}" stroke="${theme.subtitleBorder}" stroke-width="2" />
    <text x="0" y="33" class="font-med" font-size="21" fill="${theme.subtitleText}" text-anchor="middle">${escapedSub}</text>
  </g>`
          : ''
  }

  <!-- Footer: Domain Pill -->
  <g transform="translate(600, 520)">
    <rect x="-105" y="0" width="210" height="40" rx="20" fill="${theme.footerBg}" stroke="${theme.footerBorder}" stroke-width="2" />
    <text x="0" y="26" class="font-bold" font-size="15" letter-spacing="0.8" fill="${theme.footerText}" text-anchor="middle">www.abodid.com</text>
  </g>
</svg>`;

    return new Response(svg, {
        status: 200,
        headers: {
            'Content-Type': 'image/svg+xml; charset=utf-8',
            'Cache-Control': 'public, max-age=300',
        },
    });
}

export async function GET({ request }: { request: Request }) {
    const { searchParams } = new URL(request.url);
    const title = sanitizeInput(searchParams.get('title'), 160) || 'Abodid Sahoo';
    const description = sanitizeInput(searchParams.get('description'), 240);
    const image = sanitizeInput(searchParams.get('image'), 500);
    const theme = sanitizeInput(searchParams.get('theme'), 30);
    const category = sanitizeInput(searchParams.get('category'), 40);

    try {
        return generateOgImage(title, image, description, { theme, category });
    } catch (error) {
        console.warn('[api/og] OG render failed with image/fonts, trying without image...', error);
    }

    try {
        return generateOgImage(title, undefined, description, { theme, category });
    } catch (error) {
        console.error('[api/og] OG render fallback to Pop SVG.', error);
        return popSvgFallback(title, description, theme, category);
    }
}
