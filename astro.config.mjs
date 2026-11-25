// @ts-check
import { defineConfig } from 'astro/config';

import react from '@astrojs/react';

import vercel from '@astrojs/vercel';

import indexableSitemap from './scripts/indexable-sitemap.mjs';

import { loadEnv } from 'vite';
import { readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { directoryPaths } from './src/data/siteDirectory.js';
import siteThemePaint from './scripts/postcss-site-theme.mjs';
import destinationHeadings from './scripts/destination-headings.mjs';

const isDevelopmentServer = process.argv.includes('dev');
const env = loadEnv(isDevelopmentServer ? 'development' : 'production', process.cwd(), '');
const siteUrl = env.PUBLIC_SITE_URL || 'https://abodid.com';
const secureLandRoot = join(process.cwd(), 'src/data/land/secure');
/** @param {string} directory @returns {string[]} */
const listFiles = (directory) => readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
  const target = join(directory, entry.name);
  return entry.isDirectory() ? listFiles(target) : [relative(process.cwd(), target)];
});
const secureLandFiles = listFiles(secureLandRoot);

// https://astro.build/config
export default defineConfig({
  // Build public pages as static HTML by default. Routes that genuinely need
  // request-time behavior opt in with `export const prerender = false`.
  output: 'static',
  // Host redirects live in vercel.json. Keep Astro middleware in the normal
  // Node rendering request: edge middleware adds a second HTTP request through
  // a shared /_render URL, which can make CDN-cached responses bleed between
  // unrelated pages and APIs.
  adapter: vercel({
    // These files are encrypted at rest and are available only to server-side
    // routes. They must never be copied into public/ or emitted as static URLs.
    includeFiles: secureLandFiles,
  }),
  // In development, accept the alternate form long enough for project
  // middleware to issue the same 308 redirect generated for production.
  trailingSlash: isDevelopmentServer ? 'ignore' : 'never',
  prefetch: {
    prefetchAll: true,
    defaultStrategy: 'hover',
  },
  integrations: [
    destinationHeadings(),
    react(),
    indexableSitemap(siteUrl, directoryPaths),
  ],
  site: siteUrl,
  vite: {
    css: { postcss: { plugins: [siteThemePaint] } },
    // Keep production builds from replacing dependency chunks used by the
    // long-running local workspace server.
    cacheDir: isDevelopmentServer
      ? 'node_modules/.vite/development'
      : 'node_modules/.vite/production',
    server: {
      proxy: {
        // Keep the public R2 CORS allowlist scoped to the live site.
        '^/__landing-smudge-media/(photos|videos)/': {
          target: 'https://assets.abodid.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/__landing-smudge-media/, ''),
          bypass: (request) => request.method !== 'GET' && request.method !== 'HEAD' ? false : undefined,
          configure(proxy) {
            proxy.on('proxyReq', (request) => {
              request.removeHeader('cookie');
              request.removeHeader('authorization');
            });
            proxy.on('proxyRes', (response) => {
              delete response.headers['set-cookie'];
            });
          },
        },
      },
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
