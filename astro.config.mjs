// @ts-check
import { defineConfig } from 'astro/config';

import react from '@astrojs/react';

import vercel from '@astrojs/vercel';

import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  output: 'server',
  adapter: vercel(),
  integrations: [react(), sitemap()],
  site: 'https://abodid.com', // Replace with your actual domain
  vite: {
    optimizeDeps: {
      // Prevent stale pre-bundles from breaking admin hydration when dnd-kit updates.
      exclude: ['@dnd-kit/core', '@dnd-kit/sortable', '@dnd-kit/utilities'],
    },
  },
});
