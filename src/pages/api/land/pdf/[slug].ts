import type { APIRoute } from 'astro';
import { loadLandBundle, loadLandPdf } from '../../../../lib/land/privateData.mjs';
import { LAND_COOKIE_NAME, verifyViewerSessionToken } from '../../../../lib/land/session.mjs';

export const prerender = false;

export const GET: APIRoute = async ({ params, cookies }) => {
  if (!verifyViewerSessionToken(cookies.get(LAND_COOKIE_NAME)?.value)) {
    return new Response('Unauthorized', {
      status: 401,
      headers: { 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex, nofollow, noarchive' },
    });
  }

  const slug = params.slug || '';
  const bundle = await loadLandBundle();
  const source = bundle.khatas.map((khata: any) => khata.source).find((item: any) => item?.slug === slug);
  if (!source) return new Response('Not found', { status: 404 });

  try {
    const pdf = await loadLandPdf(slug);
    return new Response(pdf, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="khata-${slug}.pdf"`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
        'X-Robots-Tag': 'noindex, nofollow, noarchive',
      },
    });
  } catch {
    return new Response('Document unavailable', { status: 404, headers: { 'Cache-Control': 'private, no-store' } });
  }
};

