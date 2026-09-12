import type { APIRoute } from 'astro';
export const GET: APIRoute = () => new Response('User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /admin/\nSitemap: https://abodid.com/photography-portfolio/sitemap.xml\n', { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });

