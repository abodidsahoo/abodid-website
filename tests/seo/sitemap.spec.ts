import { expect, test } from '@playwright/test';

test('directory cards have four visible edges at desktop and mobile sizes', async ({ page }) => {
  await page.goto('/sitemap', { waitUntil: 'networkidle' });
  await expect(page.locator('.sitemap-group')).toHaveCount(12);
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await expect.poll(() => page.locator('.sitemap-directory__grid').evaluate((grid) =>
      getComputedStyle(grid).gridTemplateColumns.split(' ').length,
    )).toBe(width === 390 ? 1 : 3);
    const borders = await page.locator('.sitemap-group').evaluateAll((cards) => cards.every((card) => {
      const style = getComputedStyle(card);
      return style.borderTopWidth === '1px' && style.borderTopStyle === 'solid'
        && style.borderTopColor === style.borderBottomColor
        && style.borderTopColor === style.borderLeftColor
        && style.borderTopColor === style.borderRightColor
        && style.borderTopColor !== style.backgroundColor;
    }));
    expect(borders).toBe(true);
    expect(await page.locator('.sitemap-group').evaluateAll((cards) => cards.every((card) => {
      const bounds = card.getBoundingClientRect();
      return bounds.left >= 0 && bounds.right <= innerWidth;
    }))).toBe(true);
  }
});

test('published links and structured directory remain available without JavaScript', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('/sitemap');
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://abodid.com/sitemap');
  await expect(page.locator('.sitemap-links a[href^="/blog/"]').first()).toBeAttached();
  const details = page.locator('#group-work details');
  await details.locator('summary').click();
  await expect(details).toHaveAttribute('open', '');
  await expect(details.locator('a').first()).toBeVisible();
  const schema = await page.locator('script[type="application/ld+json"]').allTextContents();
  const directory = schema.map((value) => JSON.parse(value)).find((value) => value['@type'] === 'CollectionPage');
  expect(directory.mainEntity.numberOfItems).toBeGreaterThan(100);
  expect(directory.mainEntity.itemListElement.every((item: { url: string }) => item.url.startsWith('https://'))).toBe(true);
  await context.close();
});
