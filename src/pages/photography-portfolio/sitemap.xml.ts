import type { APIRoute } from 'astro';
import { getPortfolioPhotos } from '../../lib/photography/server';
const escape = (value: string) => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
export const GET: APIRoute = async () => {
  const photos = await getPortfolioPhotos();
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"><url><loc>https://abodid.com/photography-portfolio</loc>${photos.slice(0, 1000).map(photo => `<image:image><image:loc>${escape(photo.large)}</image:loc></image:image>`).join('')}</url></urlset>`, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};

