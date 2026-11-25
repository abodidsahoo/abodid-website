import rss from '@astrojs/rss';
import { escapeXml } from '../sitemapHelper.js';
import { feedUrl, subscriptionFeed } from './catalog.js';
import { getSubscriptionEntries } from './sources';

export async function subscriptionResponse(id: string, site: URL | string = 'https://abodid.com') {
  const feed = subscriptionFeed(id);
  if (!feed) return new Response('Feed not found', { status: 404 });
  try {
    const entries = await getSubscriptionEntries(id, site);
    const response = await rss({
      title: `Abodid | ${feed.title}`, description: feed.description, site,
      trailingSlash: false,
      xmlns: { atom: 'http://www.w3.org/2005/Atom', dc: 'http://purl.org/dc/elements/1.1/', media: 'http://search.yahoo.com/mrss/' },
      customData: `<language>en-us</language><atom:link href="${escapeXml(feedUrl(feed, String(site)))}" rel="self" type="application/rss+xml"/>`,
      items: entries.map((entry) => ({
        title: entry.title, description: entry.description, link: entry.url,
        pubDate: entry.published, categories: entry.categories,
        customData: [
          `<guid isPermaLink="false">${escapeXml(entry.guid)}</guid>`,
          `<dc:creator>${escapeXml(entry.author)}</dc:creator>`,
          entry.modified ? `<atom:updated>${entry.modified.toISOString()}</atom:updated>` : '',
          entry.image && !/\.(?:mp4|webm|mov)(?:\?|$)/i.test(entry.image)
            ? `<media:thumbnail url="${escapeXml(entry.image)}"/>` : '',
        ].join(''),
      })),
    });
    response.headers.set('Content-Type', 'application/rss+xml; charset=utf-8');
    // A privacy change must remove an entry on the very next request.
    // No persistent snapshot can resurrect hidden notes or private collections.
    response.headers.set('Cache-Control', 'no-store');
    response.headers.set('X-Content-Type-Options', 'nosniff');
    return response;
  } catch (error) {
    console.error(`[RSS:${id}]`, error instanceof Error ? error.message : error);
    // Readers retain their last successful feed rather than accepting a partial one.
    return new Response('This feed is temporarily unavailable. Please try again shortly.', {
      status: 503, headers: { 'Retry-After': '300', 'Cache-Control': 'no-store' },
    });
  }
}
