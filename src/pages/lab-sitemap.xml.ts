import type { APIRoute } from 'astro';

import { labExperiments } from '../data/labExperiments';
import { labUrl } from '../lib/labRoutes.js';

export const prerender = false;

const escapeXml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');

export const GET: APIRoute = () => {
  const paths = ['/', ...labExperiments.map((experiment) => experiment.href)];
  const urls = [...new Set(paths)]
    .map((pathname) => `  <url><loc>${escapeXml(labUrl(pathname))}</loc></url>`)
    .join('\n');

  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
    { headers: { 'Content-Type': 'application/xml; charset=utf-8' } },
  );
};
