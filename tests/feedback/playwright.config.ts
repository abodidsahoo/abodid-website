import { defineConfig } from '@playwright/test';

export default defineConfig({
    testDir: '.',
    testMatch: '**/*.pw.ts',
    fullyParallel: false,
    workers: 1,
    reporter: 'list',
    timeout: 45000,
    use: { baseURL: 'http://localhost:4331', headless: true, trace: 'retain-on-failure' },
    webServer: {
        command: 'npm run dev -- --port 4331',
        url: 'http://localhost:4331/nift-workshop-feedback',
        reuseExistingServer: true,
        env: { FEEDBACK_RECEIPT_SECRET: 'playwright-only-feedback-receipt-secret' },
        timeout: 120000,
    },
});
