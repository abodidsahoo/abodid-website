// @ts-check
import { defineConfig } from 'astro/config';

import react from '@astrojs/react';

import vercel from '@astrojs/vercel';

import sitemap from '@astrojs/sitemap';

import { loadEnv } from 'vite';

const excludedSitemapPathPatterns = [
  /^\/admin(?:\/|$)/,
  /^\/api(?:\/|$)/,
  /^\/login\/?$/,
  /^\/unauthorized\/?$/,
  /^\/unsubscribe\/?$/,
  /^\/payments\/?$/,
  /^\/club\/payment-/,
  /^\/collaboration\/measurements\/?$/,
  /^\/du-workshop-responses\/?$/,
  /^\/feedback\/?$/,
  /^\/hand-tracking-test\/?$/,
  /^\/landing-grid-test\/?$/,
  /^\/bsa-qrcode\/?$/,
  /^\/research\/admin(?:\/|$)/,
  /^\/resources\/admin(?:\/|$)/,
  /^\/resources\/auth(?:\/|$)/,
  /^\/resources\/curator\/?$/,
  /^\/resources\/dashboard\/?$/,
  /^\/resources\/saved\/?$/,
  /^\/resources\/.*\/edit\/?$/,
  /^\/research\/visual-moodboard\/?$/,
  /^\/workshops\/video-editing-storytelling-class-1\/?$/,
  /^\/workshops\/video-editing-storytelling-class-2\/?$/,
  /^\/july-backup\/?$/,
];

/** @param {string} page */
const shouldIncludeInSitemap = (page) => {
  const pathname = new URL(page).pathname;
  return !excludedSitemapPathPatterns.some((pattern) => pattern.test(pathname));
};

const isDevelopmentServer = process.argv.includes('dev');
const env = loadEnv(isDevelopmentServer ? 'development' : 'production', process.cwd(), '');

// https://astro.build/config
export default defineConfig({
  output: 'server',
  adapter: vercel(),
  // In development, accept the alternate form long enough for project
  // middleware to issue the same 308 redirect generated for production.
  trailingSlash: isDevelopmentServer ? 'ignore' : 'never',
  prefetch: {
    prefetchAll: true,
    defaultStrategy: 'hover',
  },
  integrations: [
    react(),
    sitemap({
      filter: shouldIncludeInSitemap,
    }),
  ],
  site: env.PUBLIC_SITE_URL || 'https://abodid.com',
  vite: {
    // Keep production builds from replacing dependency chunks used by the
    // long-running local workspace server.
    cacheDir: isDevelopmentServer
      ? 'node_modules/.vite/development'
      : 'node_modules/.vite/production',
    server: {
      // Vercel's adapter writes thousands of files here during a build. If a
      // build runs beside `astro dev`, those add events make Astro rebuild its
      // route manifest once per output file and can exhaust file descriptors.
      watch: {
        ignored: ['**/.vercel/**'],
      },
    },
    resolve: {
      dedupe: ['react', 'react-dom'],
    },
  },
});
