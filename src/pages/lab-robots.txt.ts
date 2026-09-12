import type { APIRoute } from 'astro';

export const prerender = false;

export const GET: APIRoute = () =>
  new Response(
    [
      'User-agent: *',
      'Allow: /',
      'Disallow: /api/',
      'Sitemap: https://lab.abodid.com/sitemap.xml',
      '',
    ].join('\n'),
    { headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
  );
