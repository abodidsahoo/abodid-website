import sitemap from '@astrojs/sitemap';
import { readFile } from 'node:fs/promises';
import { load } from 'cheerio';
import { shouldIncludeInSitemap, SITEMAP_HUB_PATHS } from '../src/lib/searchVisibility.js';

/** Filter generated pages by their final, rendered canonical and robots metadata. */
export default function indexableSitemap(siteUrl, directoryPaths = []) {
  let outputDirectory;
  const integration = sitemap({
    filter: shouldIncludeInSitemap,
    customPages: directoryPaths.map(path => new URL(path, siteUrl).href),
    customSitemaps: ['content-sitemap.xml', 'vault-sitemap.xml', 'work-sitemap.xml']
      .map(path => new URL(path, siteUrl).href),
    async serialize(item) {
      const url = new URL(item.url);
      const pathname = url.pathname.replace(/\/+$/, '') || '/';
      try {
        const html = await readFile(new URL(`.${pathname === '/' ? '' : pathname}/index.html`, outputDirectory), 'utf8');
        const $ = load(html);
        if ($('meta[name="robots"]').toArray().some(meta => /\bnoindex\b/i.test($(meta).attr('content') || ''))) return undefined;
        if ($('meta[http-equiv="refresh"]').length) return undefined;
        const canonical = new URL($('link[rel="canonical"]').attr('href') || item.url, siteUrl);
        if (canonical.origin !== url.origin || canonical.search || canonical.hash) return undefined;
        if ((canonical.pathname.replace(/\/+$/, '') || '/') !== pathname) return undefined;
        return { ...item, url: new URL(pathname, siteUrl).href };
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
        // Request-rendered detail pages are supplied by the live content sitemaps.
        // Only known public section hubs may lack generated HTML here.
        return SITEMAP_HUB_PATHS.has(pathname) ? item : undefined;
      }
    },
  });
  const buildDone = integration.hooks['astro:build:done'];
  integration.hooks['astro:build:done'] = async (options) => {
    outputDirectory = options.dir;
    return buildDone(options);
  };
  return integration;
}
