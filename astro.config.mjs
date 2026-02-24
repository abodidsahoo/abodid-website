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
    resolve: {
      dedupe: ['react', 'react-dom'],
    },
    optimizeDeps: {
      // Prevent stale pre-bundles from breaking admin hydration when dnd-kit updates.
      include: ['react', 'react-dom'],
      exclude: ['@dnd-kit/core', '@dnd-kit/sortable', '@dnd-kit/utilities'],
    },
  },
});
