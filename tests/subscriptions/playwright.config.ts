import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: '.', testMatch: '*.spec.ts', reporter: 'list', workers: 1,
  use: { baseURL: process.env.RSS_TEST_URL || 'http://127.0.0.1:4325', trace: 'retain-on-failure' },
});
