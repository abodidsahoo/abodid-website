import { expect, test, type Page } from '@playwright/test';

async function startAtWork(page: Page) {
  await page.goto('/work', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof history.state?.index === 'number');
}

function gate() {
  let release!: () => void;
  const wait = new Promise<void>(resolve => { release = resolve; });
  return { wait, release };
}

test('opens a real destination entry before its response, then renders it once', async ({ page }) => {
  await startAtWork(page);
  const response = gate();
  await page.route('**/research', async route => {
    await response.wait;
    await route.continue().catch(() => {});
  });
  const before = await page.evaluate(() => history.length);
  try {
    await page.locator('.journal-links a[href="/research"]').focus();
    await page.keyboard.press('Enter');
    const shell = page.locator('#destination-view[open]');
    await expect(shell.getByRole('heading')).toContainText(/research/i);
    await expect(shell.getByText('Loading page…')).toBeVisible();
    await expect(shell.locator('.destination-grid')).toBeVisible();
    await expect(page).toHaveURL(/\/research$/);
    expect(await page.evaluate(() => history.length)).toBe(before + 1);
  } finally { response.release(); }
  await expect(page.locator('#projects-heading')).toBeVisible();
  await expect(page.locator('#destination-view')).toHaveCount(0);
  expect(await page.evaluate(() => history.length)).toBe(before + 1);
  await page.goBack();
  await expect(page.locator('#selected-work-heading')).toBeVisible();
  await page.goForward();
  await expect(page.locator('#projects-heading')).toBeVisible();
});

test('Back during a pending navigation cannot install a stale response', async ({ page }) => {
  await startAtWork(page);
  const response = gate();
  await page.route('**/research', async route => {
    await response.wait;
    await route.continue().catch(() => {});
  });
  try {
    await page.locator('.journal-links a[href="/research"]').evaluate((link: HTMLAnchorElement) => link.click());
    await expect(page).toHaveURL(/\/research$/);
    await page.goBack();
    await expect(page).toHaveURL(/\/work$/);
    await expect(page.locator('#destination-view')).toHaveCount(0);
  } finally { response.release(); }
  await expect(page.locator('#selected-work-heading')).toBeVisible();
});

test('in-page actions keep their behavior, and reduced motion keeps the loading grid still', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await startAtWork(page);
  const shown = await page.evaluate(() => {
    for (const [href, cancelled] of [['#selected-work', false], ['/about', true]] as const) {
      const link = document.createElement('a');
      link.href = href;
      if (cancelled) link.onclick = event => event.preventDefault();
      document.body.append(link);
      link.click();
      link.remove();
    }
    return Boolean(document.querySelector('#destination-view[open]'));
  });
  expect(shown).toBe(false);
  const response = gate();
  await page.route('**/research', async route => { await response.wait; await route.continue().catch(() => {}); });
  try {
    await page.locator('.journal-links a[href="/research"]').evaluate((link: HTMLAnchorElement) => link.click());
    const tile = page.locator('#destination-view .destination-grid i').first();
    await expect(tile).toBeVisible();
    expect(await tile.evaluate(el => getComputedStyle(el, '::after').animationName)).toBe('none');
  } finally { response.release(); }
});
