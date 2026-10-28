import { expect, test } from '@playwright/test';
import { build } from 'vite';
import { fileURLToPath } from 'node:url';

let bundle: string;

test.beforeAll(async () => {
    // Exercise the real gallery with production React, without a database or CDN.
    const result = await build({
        configFile: false,
        logLevel: 'silent',
        define: { 'process.env.NODE_ENV': JSON.stringify('production') },
        esbuild: { jsx: 'transform' },
        build: {
            write: false,
            target: 'esnext',
            lib: {
                entry: fileURLToPath(new URL('./fixtures/gallery.jsx', import.meta.url)),
                formats: ['es'],
            },
        },
    });
    const outputs = Array.isArray(result) ? result : [result];
    bundle = outputs.flatMap((output) => 'output' in output ? output.output : [])
        .filter((chunk) => chunk.type === 'chunk').map((chunk) => chunk.code).join('\n');
});

test.beforeEach(async ({ page }) => {
    await page.route('**/moodboard-regression.js', (route) => route.fulfill({
        contentType: 'text/javascript', body: bundle,
    }));
    await page.route(/\/moodboard-regression(?:\?.*)?$/, (route) => route.fulfill({
        contentType: 'text/html',
        body: '<div id="root"></div><script type="module" src="/moodboard-regression.js"></script>',
    }));
});

test('new tags are loaded once from the static file and filtering stays local', async ({ page }) => {
    let reads = 0;
    await page.route('**/moodboard-search-snapshot.json', async (route) => {
        reads += 1;
        await route.fulfill({ json: {
            schemaVersion: 1, revision: 2, generatedAt: '2026-10-28T12:00:00Z',
            items: Array.from({ length: 1440 }, (_, index) => ({
                id: `photo-${index}`, title: `Reference ${index}`, artistName: index % 2 ? 'Mira' : 'Anu',
                tags: index === 2 ? ['newly saved concept'] : [index % 2 ? 'Architecture' : 'Portrait'],
            })),
        } });
    });
    await page.goto('/moodboard-regression?snapshot');
    await page.getByRole('searchbox').fill('newly saved concept');
    await expect(page.locator('[data-photo-id]')).toHaveCount(1);
    await expect(page.locator('[data-photo-id="photo-2"]')).toBeVisible();
    await page.locator('[data-photo-id="photo-2"]').click();
    await expect(page.locator('.moodboard-polaroid-overlay')).toBeVisible();
    await page.getByRole('button', { name: 'Close photo', exact: true }).click();
    await page.getByRole('searchbox').fill('architecture');
    await expect(page.locator('[data-photo-id]')).toHaveCount(720);
    await page.getByRole('searchbox').fill('');
    await expect(page.locator('[data-photo-id]')).toHaveCount(1440);
    expect(reads).toBe(1);
});

test('unavailable or malformed metadata preserves the built gallery and its search', async ({ page }) => {
    for (const response of [{ status: 503, body: 'Unavailable' }, { status: 200, json: { items: [] } }]) {
        await page.route('**/moodboard-search-snapshot.json', (route) => route.fulfill(response));
        await page.goto('/moodboard-regression?snapshot');
        await expect(page.locator('.boudoir-photo-img')).toHaveCount(1440);
        await page.getByRole('searchbox').fill('portrait');
        await expect(page.locator('.boudoir-photo-img')).toHaveCount(720);
        await expect(page.getByRole('alert')).toHaveCount(0);
        await page.unroute('**/moodboard-search-snapshot.json');
    }
});

test('metadata arriving during image navigation preserves the selected photo', async ({ page }) => {
    let release: () => void;
    const ready = new Promise<void>((resolve) => { release = resolve; });
    await page.route('**/moodboard-search-snapshot.json', async (route) => {
        await ready;
        await route.fulfill({ json: {
            schemaVersion: 1, revision: 3, generatedAt: '2026-10-28T12:00:00Z',
            items: Array.from({ length: 1440 }, (_, index) => ({
                id: `photo-${index}`, title: `Reference ${index}`, artistName: index % 2 ? 'Mira' : 'Anu',
                tags: index % 2 ? ['Architecture'] : index === 2 ? ['Portrait', 'freshlytagged'] : ['Portrait'],
            })),
        } });
    });
    await page.goto('/moodboard-regression?snapshot');
    await page.getByRole('searchbox').fill('portrait');
    await page.locator('[data-photo-id="photo-2"]').click();
    await expect(page.locator('.moodboard-polaroid-overlay')).toBeVisible();
    release!();
    await page.waitForResponse('**/moodboard-search-snapshot.json');
    await expect(page).toHaveURL(/photo=photo-2/);
    await expect(page.locator('.moodboard-polaroid-overlay img')).toHaveAttribute('alt', 'Reference 2');
    await page.getByRole('button', { name: 'Close photo', exact: true }).click();
    await page.getByRole('searchbox').fill('freshlytagged');
    await expect(page.locator('[data-photo-id]')).toHaveCount(1);
    await expect(page.locator('[data-photo-id="photo-2"]')).toBeVisible();
});

test('cached images survive repeated search, colour filtering, and viewer navigation', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('/moodboard-regression');
    const images = page.locator('.boudoir-photo-img');
    await expect(images).toHaveCount(1440).catch((error) => {
        throw new Error(`${error.message}\nBrowser errors: ${errors.join('\n')}`);
    });
    await expect(page.locator('.boudoir-photo-img.is-loaded')).toHaveCount(1440);

    const search = page.getByRole('searchbox');
    const session = await page.context().newCDPSession(page);
    await session.send('Emulation.setCPUThrottlingRate', { rate: 6 });
    await search.pressSequentially('architecture', { delay: 1 });
    await search.fill('');
    for (const query of ['portrait', 'architecture', 'mira', 'reference', 'unmatchablexyz', '']) {
        await search.fill(query);
        const count = query === 'unmatchablexyz' ? 0 : query === 'reference' || query === '' ? 1440 : 720;
        await expect(images).toHaveCount(count);
        await expect(page.locator('.boudoir-photo-img.is-loaded')).toHaveCount(count);
    }

    await search.pressSequentially('portrait', { delay: 10 });
    await expect(images).toHaveCount(720);
    await page.locator('[data-photo-id="photo-2"]').click();
    await expect(page.locator('.moodboard-polaroid-overlay')).toBeVisible();
    await page.getByRole('button', { name: /^Next photo:/ }).click();
    await expect(page).toHaveURL(/photo=photo-4/);
    await expect(page.getByRole('button', { name: /^Next photo:/ })).toBeEnabled();
    await page.getByRole('button', { name: /^Previous photo:/ }).click();
    await expect(page).toHaveURL(/photo=photo-2/);
    await page.getByRole('button', { name: 'Close photo', exact: true }).click();
    await expect(images).toHaveCount(720);
    await page.getByRole('button', { name: 'Clear search', exact: true }).click();
    await expect(images).toHaveCount(1440);

    const gradient = page.getByRole('slider');
    await gradient.focus();
    await page.keyboard.press('Home');
    await expect(images).toHaveCount(1440);
    await search.fill('architecture');
    await expect(images).toHaveCount(720);
    await page.getByRole('button', { name: 'Reset color filter', exact: true }).click();
    await expect(images).toHaveCount(720);
    await search.fill('unmatchablexyz');
    await expect(images).toHaveCount(0);
    await page.getByRole('button', { name: 'Reset discovery', exact: true }).click();
    await expect(page.locator('.boudoir-photo-img.is-loaded')).toHaveCount(1440);
    expect(errors).toEqual([]);
});

test('an unexpected interaction error keeps the archive visible and can be recovered', async ({ page }) => {
    await page.goto('/moodboard-regression');
    await expect(page.locator('.boudoir-photo-img.is-loaded')).toHaveCount(1440);
    await page.locator('[data-photo-id="photo-2"]').click();
    await expect(page.locator('.moodboard-polaroid-overlay')).toBeVisible();
    await expect(page.locator('body')).toHaveCSS('overflow', 'hidden');

    // Inject a one-off failure in the real filter effect while the viewer is open.
    // The boundary must preserve images and clean up the viewer's scroll lock.
    await page.evaluate(() => {
        const animate = Element.prototype.animate;
        Element.prototype.animate = function (keyframes, options) {
            if (this.matches('.boudoir-grid-stage')) {
                Element.prototype.animate = animate;
                throw new Error('Intentional moodboard recovery test');
            }
            return animate.call(this, keyframes, options);
        };
    });
    await page.getByRole('searchbox').fill('portrait');
    await expect(page.getByRole('alert')).toContainText('You can still browse the images below.');
    await expect(page.locator('[aria-label="Moodboard images"] img')).toHaveCount(1440);
    await expect(page.locator('[aria-label="Moodboard images"] a').first()).toHaveAttribute('href', /^data:image/);
    await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden');
    await expect(page.locator('.moodboard-polaroid-overlay')).toHaveCount(0);

    await page.getByRole('button', { name: 'Restore interactive view', exact: true }).click();
    await expect(page.getByRole('alert')).toHaveCount(0);
    await expect(page.locator('.boudoir-photo-img.is-loaded')).toHaveCount(1440);
    await page.getByRole('button', { name: 'Close photo', exact: true }).click();
    await page.getByRole('searchbox').fill('architecture');
    await expect(page.locator('.boudoir-photo-img.is-loaded')).toHaveCount(720);
});
