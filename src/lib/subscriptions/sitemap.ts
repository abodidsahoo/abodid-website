import { buildSitemapXml, createXmlResponse } from '../sitemapHelper.js';
import { getSubscriptionEntries } from './sources';
import { SITEMAP_HUB_PATHS } from '../searchVisibility.js';

export async function subscriptionSitemap(section: 'content' | 'notes' | 'work', site: URL | string = 'https://abodid.com') {
  try {
    const entries = await getSubscriptionEntries(section === 'content' ? 'all' : section, site);
    const origin = new URL(site).origin;
    const eligible = entries.filter((entry) => {
      const url = new URL(entry.url);
      if (url.origin !== origin || url.hash || url.search) return false;
      if (SITEMAP_HUB_PATHS.has(url.pathname)) return false;
      if (section === 'content') return !entry.feeds.includes('notes') && !entry.feeds.includes('work');
      return true;
    });
    const response = createXmlResponse(buildSitemapXml(eligible.map((entry) => ({
      url: entry.url, lastmod: entry.modified || entry.published,
    }))));
    response.headers.set('Cache-Control', 'no-store');
    return response;
  } catch (error) {
    console.error(`[sitemap:${section}]`, error instanceof Error ? error.message : error);
    return new Response('Sitemap temporarily unavailable.', { status: 503, headers: { 'Retry-After': '300', 'Cache-Control': 'no-store' } });
  }
}
