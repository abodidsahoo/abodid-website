import type { APIRoute } from 'astro';
import { loadLandBundle, loadLandMarkdown } from '../../../../lib/land/privateData.mjs';
import { LAND_COOKIE_NAME, verifyViewerSessionToken } from '../../../../lib/land/session.mjs';

export const prerender = false;

export const GET: APIRoute = async ({ params, cookies }) => {
  if (!verifyViewerSessionToken(cookies.get(LAND_COOKIE_NAME)?.value)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' },
    });
  }
  const slug = params.slug || '';
  const bundle = await loadLandBundle();
  const source = bundle.khatas.map((khata: any) => khata.source).find((item: any) => item?.slug === slug);
  if (!source) return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 });
  const markdown = await loadLandMarkdown(slug);
  return new Response(JSON.stringify({ markdown: markdown.toString('utf8') }), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'private, no-store',
      'X-Robots-Tag': 'noindex, nofollow, noarchive',
    },
  });
};

