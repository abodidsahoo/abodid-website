import { generateOgImage } from '../../lib/og-helper';

export const config = {
    runtime: 'edge',
};

function sanitizeTitle(raw: string | null): string {
    if (typeof raw !== 'string') return 'Abodid Sahoo';
    const cleaned = raw.replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim();
    if (!cleaned) return 'Abodid Sahoo';
    return cleaned.slice(0, 140);
}

function sanitizeImage(raw: string | null): string | undefined {
    if (typeof raw !== 'string') return undefined;
    const cleaned = raw.trim();
    if (!cleaned) return undefined;
    const lowered = cleaned.toLowerCase();
    if (lowered === 'undefined' || lowered === 'null') return undefined;
    return cleaned;
}

function svgFallback(title: string): Response {
    const escaped = title
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0%" stop-color="#f7f2ff" />
      <stop offset="100%" stop-color="#e8f4ff" />
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)" />
  <text x="600" y="275" text-anchor="middle" font-size="28" font-family="system-ui, sans-serif" fill="#111827">Abodid Sahoo</text>
  <text x="600" y="360" text-anchor="middle" font-size="68" font-weight="700" font-family="system-ui, sans-serif" fill="#111827">${escaped}</text>
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
    const title = sanitizeTitle(searchParams.get('title'));
    const image = sanitizeImage(searchParams.get('image'));

    // Keep local development stable: skip @vercel/og rendering in dev
    // because external tooling/inspectors may spam this endpoint with odd requests.
    if (import.meta.env.DEV) {
        return svgFallback(title);
    }

    try {
        return generateOgImage(title, image);
    } catch (error) {
        console.error('[api/og] OG render failed with image, retrying without image.', error);
    }

    try {
        return generateOgImage(title);
    } catch (error) {
        console.error('[api/og] OG render fallback failed; returning SVG fallback.', error);
        return svgFallback(title);
    }
}
