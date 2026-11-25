import { test, expect } from '@playwright/test';

for (const viewport of [{ width: 1440, height: 1000 }, { width: 768, height: 1024 }, { width: 390, height: 844 }, { width: 320, height: 568 }]) {
  test(`subscription dialog works at ${viewport.width}px`, async ({ page, context }) => {
    await page.setViewportSize(viewport);
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto('/subscribe', { waitUntil: 'networkidle' });
    const rss = page.locator('footer [data-rss-subscribe]');
    await rss.focus();
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog', { name: 'Follow what interests you.' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Close', exact: true })).toBeFocused();
    expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
    expect(await dialog.evaluate((element) => { const box = element.getBoundingClientRect(); return box.top >= 0 && box.bottom <= innerHeight; })).toBe(true);
    if (viewport.width === 1440) await page.screenshot({ path: 'output/rss-subscription-desktop.png' });
    if (viewport.width === 390) await page.screenshot({ path: 'output/rss-subscription-mobile.png' });
    await dialog.getByRole('button', { name: 'Copy URL for All Updates', exact: true }).click();
    await expect(dialog.getByRole('status')).toHaveText('All Updates feed URL copied.');
    await expect(dialog.locator('[data-copy-feedback]').first()).toHaveText('Copied');
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('https://abodid.com/rss.xml');
    await expect(dialog.getByRole('link', { name: 'Open RSS for Public notes', exact: true })).toHaveAttribute('href', '/feeds/notes.xml');
    await expect(dialog.getByRole('link', { name: /Feedly\s*: All Updates \(new tab\)/ })).toHaveAttribute('href', /feedly.com/);
    // The native modal contains focus even when tabbing backwards from Close.
    await dialog.getByRole('button', { name: 'Close', exact: true }).focus();
    await page.keyboard.press('Shift+Tab');
    expect(await page.evaluate(() => document.querySelector('#rss-subscription')?.contains(document.activeElement))).toBe(true);
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
    await expect(rss).toBeFocused();
    await rss.click();
    await dialog.getByRole('button', { name: 'Close', exact: true }).click();
    await expect(dialog).not.toBeVisible();
  });
}

test('clipboard denial selects a labelled URL and announces recovery', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'clipboard', { value: { writeText: () => Promise.reject(new Error('Denied')) } }));
  await page.goto('/subscribe');
  await page.locator('footer [data-rss-subscribe]').click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Copy URL for All Updates', exact: true }).click();
  await expect(dialog.getByRole('status')).toContainText('The feed URL is selected');
  const url = dialog.getByLabel('Feed URL for All Updates', { exact: true });
  await expect(url).toBeFocused();
  expect(await url.evaluate((input: HTMLInputElement) => input.selectionEnd! - input.selectionStart!)).toBeGreaterThan(0);
});

test('padding keeps the dialog open and the backdrop dismisses it', async ({ page }) => {
  await page.goto('/subscribe');
  await page.locator('footer [data-rss-subscribe]').click();
  const dialog = page.getByRole('dialog');
  const box = (await dialog.boundingBox())!;
  await page.mouse.click(box.x + 5, box.y + 5);
  await expect(dialog).toBeVisible();
  await page.mouse.click(box.x - 5, box.y + 5);
  await expect(dialog).not.toBeVisible();
});

test('the subscription interface does not download feed content on page load or open', async ({ page }) => {
  const feeds: string[] = [];
  page.on('request', request => {
    if (/^\/(?:rss\.xml|feeds\/[^/]+\.xml)$/.test(new URL(request.url()).pathname)) feeds.push(request.url());
  });
  await page.goto('/subscribe', { waitUntil: 'networkidle' });
  await page.locator('footer [data-rss-subscribe]').hover();
  await page.locator('footer [data-rss-subscribe]').click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.waitForLoadState('networkidle');
  expect(feeds).toEqual([]);
});

test('discovery survives Astro navigation and the subscription directory remains reachable', async ({ page }) => {
  await page.goto('/subscribe');
  await expect(page.locator('head link[type="application/rss+xml"]')).toHaveCount(14);
  await page.locator('footer [data-rss-subscribe]').click();
  await page.getByRole('dialog').getByRole('link', { name: 'View the subscription directory' }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.locator('footer [data-rss-subscribe]').click();
  await expect(page.getByRole('dialog')).toBeVisible();
});

test('RSS links work with JavaScript disabled', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('/subscribe');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.locator('footer [data-rss-subscribe]')).toHaveAttribute('href', '/rss.xml');
  const [response] = await Promise.all([
    page.waitForResponse(response => response.url().endsWith('/rss.xml')),
    page.locator('footer [data-rss-subscribe]').click(),
  ]);
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toContain('application/rss+xml');
  await context.close();
});
