// @ts-check
import { defineConfig } from 'astro/config';

import react from '@astrojs/react';

import vercel from '@astrojs/vercel';

import sitemap from '@astrojs/sitemap';

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

const shouldIncludeInSitemap = (page) => {
  const pathname = new URL(page).pathname;
  return !excludedSitemapPathPatterns.some((pattern) => pattern.test(pathname));
};

// https://astro.build/config
export default defineConfig({
  output: 'server',
  adapter: vercel(),
  integrations: [
    react(),
    sitemap({
      filter: shouldIncludeInSitemap,
    }),
  ],
  site: 'https://abodid.com', // Replace with your actual domain
  vite: {
    resolve: {
      dedupe: ['react', 'react-dom'],
    },
  },
});
