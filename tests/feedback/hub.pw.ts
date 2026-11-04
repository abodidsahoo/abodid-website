import { test, expect } from '@playwright/test';
import { load } from 'cheerio';
import { createReceipt, NIFT_SLUG, RECEIPT_COOKIE } from '../../src/lib/feedback/receipt';

const path = '/nift-workshop-feedback';
const endpoint = '**/api/feedback/nift-bhubaneswar-space-materiality-2026-11-03';
const resourcesPath = '/nift-workshop-resources';
const receipt = createReceipt(NIFT_SLUG, 'a7b0b28e-398b-46b0-a1e6-1fed1241a11b', 'playwright-only-feedback-receipt-secret');
const receiptHeaders = { 'Set-Cookie': `${RECEIPT_COOKIE}=${receipt}; Path=${resourcesPath}; HttpOnly; SameSite=Lax` };

test.beforeEach(async ({ page }) => {
    await page.route('https://**', (route) => route.abort());
});

test('serves a complete share preview to anonymous WhatsApp crawlers', async ({ playwright, baseURL }) => {
    const crawler = await playwright.request.newContext({ baseURL, userAgent: 'WhatsApp/2.24.6.77 A' });
    try {
        const response = await crawler.get(path);
        expect(response.status()).toBe(200);
        const $ = load(await response.text());
        const meta = (name: string) => $(`meta[property="${name}"]`).attr('content');
        expect(meta('og:url')).toBe('https://abodid.com/nift-workshop-feedback');
        expect(meta('og:title')).toBe('NIFT Bhubaneswar — Feedback & Resources | Abodid Sahoo');
        expect(meta('og:description')).toContain('Thanks for joining!');
        expect(meta('og:image')).toBe('https://abodid.com/images/og/nift-workshop-feedback.jpg');
        expect(meta('og:image:width')).toBe('1200');
        expect(meta('og:image:height')).toBe('630');
        expect(meta('og:image:type')).toBe('image/jpeg');
        const image = await crawler.get('/images/og/nift-workshop-feedback.jpg');
        expect(image.status()).toBe(200);
        expect(image.headers()['content-type']).toContain('image/jpeg');
    } finally { await crawler.dispose(); }
});

test('shows only the compact preview before feedback and protects the resources page', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(path, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-feedback-initialized=true]')).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Thanks for joining the lecture!');
    await expect(page.getByRole('heading', { name: 'Please share your feedback in a few lines.' })).toBeVisible();
    await expect(page.getByText('A sentence or two is plenty.')).toHaveCount(0);
    await expect(page.locator('.hub-lede')).toHaveText('Share your feedback to receive the download links.');
    await expect(page.locator('.hub-preview-panel')).toContainText('you’ll be able to download the slide decks.');
    await expect(page.locator('[data-feedback-form] textarea')).toHaveCount(1);
    await expect(page.locator('[data-feedback-form] details')).toHaveCount(0);
    await expect(page.getByLabel('Your name (optional)', { exact: true })).toBeVisible();
    await expect(page.getByLabel('Email (optional)', { exact: true })).toBeVisible();
    await expect(page.getByLabel('Your feedback', { exact: true })).toHaveAttribute('placeholder', 'What did you think of the lecture and how it was conducted?');
    await expect(page.locator('.hub-resource-preview li')).toHaveCount(3);
    await expect(page.locator('a[href*="drive.google.com"], a[href*="tiled.art"]')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Send to my email' })).toHaveCount(0);
    await expect(page.locator('[data-photography-form]')).toHaveCount(0);
    await page.goto(resourcesPath, { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(new RegExp(path + '$'));
    await page.goto(path + '?submitted=1', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('a[href*="drive.google.com"]')).toHaveCount(0);
});

test('keeps the correct downloads, metadata and sharing notice on the resources page', async ({ page, context }) => {
    await context.addCookies([{ name: RECEIPT_COOKIE, value: receipt, domain: 'localhost', path: resourcesPath, httpOnly: true }]);
    await page.goto(resourcesPath, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Lecture resources', exact: true })).toBeVisible();
    await expect(page.locator('.hub-session-card')).toHaveCount(2);
    const pdfs = page.locator('.hub-session-card .hub-button').filter({ hasText: 'View Online' });
    await expect(pdfs.nth(0)).toHaveAttribute('href', 'https://drive.google.com/file/d/1am-OG6yy9n8bf8vGucJ8BHVxWuSMPxHt/view?usp=sharing');
    await expect(pdfs.nth(1)).toHaveAttribute('href', 'https://drive.google.com/file/d/1d8fC90updrTx0kMZ4ydlgG9yyH5C5-w5/view?usp=sharing');
    await expect(page.locator('.hub-file-meta').nth(0)).toHaveText('PDF · 40 pages · 230 MB');
    await expect(page.locator('.hub-file-meta').nth(1)).toHaveText('PDF · 15 pages · 101 MB');
    await expect(page.locator('.hub-community-note')).toContainText('Do not share them publicly or upload them to any platform.');
    await expect(page.locator('.hub-demo a')).toHaveAttribute('href', 'https://tiled.art/en/art/TurtleIsland/');
    await expect(page.locator('[data-feedback-form]')).toHaveCount(0);
    const box = await page.locator('.hub-session-card').first().boundingBox();
    expect(box!.height).toBeLessThan(300);
    await expect(page.getByRole('link', { name: 'View my photography' })).toHaveAttribute('href', '/photography');
    await expect(page.locator('.hub-album-thoughts-form')).toContainText('Your thoughts won’t appear on any public page.');
    await expect(page.locator('[name=album_thoughts]')).toHaveCount(1);
});

test('does not request the collage on phones and keeps its laptop block compact', async ({ page }) => {
    const requests: string[] = [];
    page.on('request', (request) => { if (request.url().includes('boutique-cover-')) requests.push(request.url()); });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(path, { waitUntil: 'networkidle' });
    await expect(page.locator('.hub-hero-collage')).toBeHidden();
    expect(requests).toHaveLength(0);
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.goto(path, { waitUntil: 'networkidle' });
    await expect(page.locator('.hub-hero-collage')).toBeVisible();
    expect(requests.length).toBeGreaterThan(0);
    const box = await page.locator('.hub-hero-collage').boundingBox();
    expect(box!.width).toBeLessThanOrEqual(360); expect(box!.height).toBeLessThanOrEqual(300);
});

test('saves workshop interest independently, retains a failed selection, and loads no tracking scripts', async ({ page, context }) => {
    await context.addCookies([{ name: RECEIPT_COOKIE, value: receipt, domain: 'localhost', path: resourcesPath, httpOnly: true }]);
    const tracking: string[] = [];
    page.on('request', (request) => { if (/apollo\.io|googletagmanager\.com|google-analytics\.com|journey-tracker\.js/.test(request.url())) tracking.push(request.url()); });
    let calls = 0;
    const bodies: string[] = [];
    await page.route('**/nift-workshop-resources/follow-up', (route) => {
        calls++; bodies.push(route.request().postData() || '');
        return route.fulfill({ status: calls === 1 ? 503 : 200, contentType: 'application/json', body: JSON.stringify(calls === 1 ? { error: 'Please retry your private response.' } : { ok: true }) });
    });
    await page.goto(resourcesPath, { waitUntil: 'networkidle' });
    await expect(page.locator('[data-feedback-initialized=true]')).toBeVisible();
    expect(tracking).toEqual([]);
    await page.getByLabel('Yes, I am interested.').check();
    await page.locator('[data-photography-form]').getByRole('button', { name: 'Send', exact: true }).click();
    await expect(page.locator('[data-photography-status]')).toHaveText('Please retry your private response.');
    await expect(page.locator('[name=photography_interest]')).toBeChecked();
    await page.locator('[data-photography-form]').getByRole('button', { name: 'Send', exact: true }).click();
    await expect(page.locator('[data-photography-status]')).toHaveText('Thanks! Your interest is saved.');
    expect(bodies[1]).not.toContain('album_thoughts'); expect(bodies[1]).toContain('photography_interest');
    await expect(page.locator('.hub-session-card .hub-button').first()).toBeVisible();
});

test('preserves feedback on server failure and validates empty feedback and invalid email', async ({ page }) => {
    let calls = 0;
    await page.route(endpoint, (route) => { calls++; return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Please retry your saved draft.' }) }); });
    await page.goto(path, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-feedback-initialized=true]')).toBeVisible();
    await page.getByRole('button', { name: 'Submit feedback' }).click();
    await expect(page.locator('[name=feedback]')).toBeFocused();
    expect(calls).toBe(0);
    await page.locator('[name=feedback]').fill('The material experiments and budgeting discussion.');
    await page.locator('#feedback-email').fill('invalid-email');
    await page.getByRole('button', { name: 'Submit feedback' }).click();
    await expect(page.locator('#feedback-email')).toBeFocused();
    expect(calls).toBe(0);
    await page.locator('#feedback-email').fill('');
    await page.getByRole('button', { name: 'Submit feedback' }).click();
    await expect(page.locator('[data-feedback-status]')).toContainText('retry your saved draft');
    await expect(page.locator('[name=feedback]')).toHaveValue('The material experiments and budgeting discussion.');
    await expect(page.getByRole('button', { name: 'Submit feedback' })).toBeEnabled();
    await expect(page.locator('#resources')).toHaveCount(0);
});

test('navigates after a saved response, confirms email, and restores resource access on reload', async ({ page }) => {
    const requests: string[] = [];
    await page.route(endpoint, async (route) => {
        requests.push(route.request().postData() || '');
        await route.fulfill({ status: 200, headers: receiptHeaders, contentType: 'application/json', body: JSON.stringify({ ok: true, id: 'ui-verification-only', resource_email_status: 'sent', redirect_to: resourcesPath + '?resource_email=sent' }) });
    });
    await page.goto(path, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-feedback-initialized=true]')).toBeVisible();
    await page.evaluate(() => { document.dispatchEvent(new Event('astro:page-load')); document.dispatchEvent(new Event('astro:page-load')); });
    await page.locator('[name=feedback]').fill('A useful lecture.');
    await page.locator('#feedback-email').fill('student@example.com');
    await page.getByRole('button', { name: 'Submit feedback' }).click();
    await expect(page).toHaveURL(/nift-workshop-resources/);
    await expect(page.getByText('Thanks for sharing your feedback!', { exact: true })).toBeVisible();
    await expect(page.locator('.hub-email-receipt')).toContainText('Resource links sent');
    await expect(page.locator('#resources')).toBeVisible();
    expect(requests).toHaveLength(1);
    await page.reload();
    await expect(page.locator('#resources')).toBeVisible();
});

test('email failure still proceeds to the saved-feedback resources page', async ({ page }) => {
    await page.route(endpoint, (route) => route.fulfill({ status: 200, headers: receiptHeaders, contentType: 'application/json', body: JSON.stringify({ ok: true, id: 'ui-only', resource_email_status: 'failed', redirect_to: resourcesPath + '?resource_email=failed' }) }));
    await page.goto(path, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-feedback-initialized=true]')).toBeVisible();
    await page.locator('[name=feedback]').fill('Useful.');
    await page.locator('#feedback-email').fill('student@example.com');
    await page.getByRole('button', { name: 'Submit feedback' }).click();
    await expect(page).toHaveURL(/nift-workshop-resources/);
    await expect(page.locator('.hub-email-receipt')).toContainText('Your feedback was saved, but the email could not be sent.');
    await expect(page.locator('.hub-session-card .hub-button').first()).toBeVisible();
});

test('reflows at phone, tablet, laptop and breakpoint widths with usable targets', async ({ page, context }) => {
    await context.addCookies([{ name: RECEIPT_COOKIE, value: receipt, domain: 'localhost', path: resourcesPath, httpOnly: true }]);
    const modes = [[1440,900],[1024,768],[981,900],[979,900],[768,1024],[721,900],[719,900],[657,900],[655,900],[390,844],[320,568]];
    for (const [width,height] of modes) {
        await page.setViewportSize({ width,height });
        for (const target of [path, resourcesPath]) {
        await page.goto(target, { waitUntil: 'domcontentloaded' });
        await expect(page.locator('[data-feedback-initialized=true]')).toBeVisible();
        const sizes = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
        expect(sizes.scroll, `${width}px`).toBeLessThanOrEqual(sizes.client);
        for (const button of await page.locator('.hub-button:visible, .hub-progress a:visible, .hub-brand:visible, .hub-text-link:visible').all()) {
            const box = await button.boundingBox();
            expect(box!.height).toBeGreaterThanOrEqual(48);
            expect(box!.width).toBeGreaterThanOrEqual(48);
        }
        }
    }
});

test('keeps images optional and supports enlarged text and reduced motion', async ({ page, context }) => {
    await context.addCookies([{ name: RECEIPT_COOKIE, value: receipt, domain: 'localhost', path: resourcesPath, httpOnly: true }]);
    await page.route('**/images/workshops/nift-2026/*.webp', (route) => route.abort());
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto(resourcesPath, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-feedback-initialized=true]')).toBeVisible();
    await expect(page.locator('[data-image-state=unavailable]')).not.toHaveCount(0);
    await expect(page.locator('.hub-session-card .hub-button').first()).toBeVisible();
    await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    const duration = await page.locator('.hub-button').first().evaluate((el) => getComputedStyle(el).transitionDuration);
    expect(parseFloat(duration)).toBeLessThanOrEqual(.01);
});

test('supports native feedback-to-resources navigation without JavaScript', async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.route(endpoint, (route) => route.fulfill({ status: 303, headers: { ...receiptHeaders, location: resourcesPath } }));
    await page.goto('http://localhost:4331' + path, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('a[href*="drive.google.com"]')).toHaveCount(0);
    await page.locator('[name=feedback]').fill('A native form response.');
    await page.getByRole('button', { name: 'Submit feedback' }).click();
    await expect(page).toHaveURL(/nift-workshop-resources/);
    await expect(page.getByText('Thanks for sharing your feedback!', { exact: true })).toBeVisible();
    await expect(page.locator('.hub-session-card')).toHaveCount(2);
    await page.route('**/nift-workshop-resources/follow-up', (route) => route.fulfill({ status: 303, headers: { location: resourcesPath + '?interest=saved#photography' } }));
    await page.getByLabel('Yes, I am interested.').check();
    await page.locator('[data-photography-form]').getByRole('button', { name: 'Send', exact: true }).click();
    await expect(page.locator('[data-photography-status]')).toHaveText('Thanks! Your interest is saved.');
    await context.close();
});

test('reflows at a 200% layout zoom equivalent on a 1440 by 900 display', async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 720, height: 450 }, deviceScaleFactor: 2 });
    const page = await context.newPage();
    await page.route('https://**', (route) => route.abort());
    await page.goto('http://localhost:4331' + path, { waitUntil: 'domcontentloaded' });
    expect(await page.evaluate(() => devicePixelRatio)).toBe(2);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await context.close();
});


test('collects album feedback on an independent page with no workshop prerequisite or public responses', async ({ page }) => {
    await page.route('**/api/feedback/photography-album-thoughts', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, id: 'album-test-only', redirect_to: '/photo-album-feedback?submitted=1' }) }));
    await page.goto('/photo-album-feedback', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-feedback-initialized=true]')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Thoughts on my photography album?' })).toBeVisible();
    await expect(page.locator('[name=photography_interest]')).toHaveCount(0);
    await page.locator('[name=album_thoughts]').fill('A private album thought.');
    await page.getByRole('button', { name: 'Share privately' }).click();
    await expect(page.getByRole('heading', { name: 'Thank you for sharing!' })).toBeVisible();
    const response = await page.goto('/feedback/photography-album-thoughts/responses');
    expect(response?.status()).toBe(404);
    await page.goto('/admin/photo-album-responses', { waitUntil: 'networkidle' });
    await expect(page.getByText('Please sign in to view these private responses.')).toBeVisible();
});


test('restores old path-scoped receipts and allows repeated feedback/resources navigation without resubmission', async ({ page, context }) => {
    await context.addCookies([{ name: RECEIPT_COOKIE, value: receipt, domain: 'localhost', path: resourcesPath, httpOnly: true }]);
    await page.addInitScript(() => localStorage.setItem('feedback:nift-bhubaneswar-space-materiality-2026-11-03:submitted', 'old-ui-receipt'));
    let submissions = 0; page.on('request', request => { if (request.method() === 'POST' && request.url().includes('/api/feedback/')) submissions++; });
    await page.goto(path, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-feedback-stage]')).toBeVisible();
    const resourcesTab = page.getByRole('link', { name: /02.*Slides & Resources/ });
    await expect(resourcesTab).toBeVisible();
    for (let i = 0; i < 2; i++) {
        await page.getByRole('link', { name: /02.*Slides & Resources/ }).click();
        await expect(page).toHaveURL(/nift-workshop-resources/);
        await expect(page.getByRole('heading', { name: 'Lecture resources' })).toBeVisible();
        await page.getByRole('link', { name: /01.*Feedback/ }).click();
        await expect(page.locator('[data-feedback-stage]')).toBeVisible();
        await expect(page.getByRole('link', { name: /02.*Slides & Resources/ })).toBeVisible();
    }
    await page.reload();
    await expect(page.getByRole('link', { name: /02.*Slides & Resources/ })).toBeVisible();
    const cookies = await context.cookies();
    expect(cookies.some(cookie => cookie.name === RECEIPT_COOKIE && cookie.path === '/')).toBe(true);
    expect(cookies.some(cookie => cookie.name === RECEIPT_COOKIE && cookie.path === resourcesPath)).toBe(false);
    expect(submissions).toBe(0);
});

test('does not unlock resources from localStorage or a forged receipt and keeps feedback visible', async ({ page, context }) => {
    await context.addCookies([{ name: RECEIPT_COOKIE, value: receipt + 'tampered', domain: 'localhost', path: '/', httpOnly: true }]);
    await page.addInitScript(() => localStorage.setItem('feedback:nift-bhubaneswar-space-materiality-2026-11-03:submitted', 'true'));
    await page.goto(path, { waitUntil: 'networkidle' });
    await expect(page.locator('[data-feedback-stage]')).toBeVisible();
    await expect(page.locator('[data-resources-tab]')).toHaveAttribute('aria-disabled', 'true');
    expect((await (await page.request.get(resourcesPath + '/access.json')).json()).unlocked).toBe(false);
    await page.goto(resourcesPath, { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(new RegExp(path + '$'));
    await expect(page.locator('[data-feedback-stage]')).toBeVisible();
});

test('allows submitted visitors to switch tabs without JavaScript', async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    await context.addCookies([{ name: RECEIPT_COOKIE, value: receipt, domain: 'localhost', path: '/', httpOnly: true }]);
    const page = await context.newPage();
    await page.goto('http://localhost:4331' + path, { waitUntil: 'domcontentloaded' });
    await page.getByRole('link', { name: /02.*Slides & Resources/ }).click();
    await expect(page.getByRole('heading', { name: 'Lecture resources' })).toBeVisible();
    await page.getByRole('link', { name: /01.*Feedback/ }).click();
    await page.getByRole('link', { name: /02.*Slides & Resources/ }).click();
    await expect(page.getByRole('heading', { name: 'Lecture resources' })).toBeVisible();
    await context.close();
});
