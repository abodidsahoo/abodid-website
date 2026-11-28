import { test, expect } from '@playwright/test';
import { DESIGN_TOKEN_CACHE_KEY } from '../src/lib/siteThemes.js';

// Keep these checks independent of the currently published design settings.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(key => localStorage.setItem(key, JSON.stringify({
    tokens: { '--ds-body-min': '0.94', '--ds-body-max': '1.1', '--ds-label-size': '0.72', '--ds-body-weight': '570' },
    version: 1,
  })), DESIGN_TOKEN_CACHE_KEY);
  await page.route('**/rest/v1/design_system_settings?*', route => route.fulfill({
    json: [{ published_tokens: { '--ds-body-min': '0.94', '--ds-body-max': '1.1', '--ds-label-size': '0.72' }, published_version: 1 }],
  }));
});

test('reader text-spacing preferences keep the newsletter and enquiry readable', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 1000 });
  await page.goto('/');
  await page.locator('.landing-hero__backdrop--ready').waitFor();
  await page.addStyleTag({ content: '* { line-height: 1.5 !important; letter-spacing: .12em !important; word-spacing: .16em !important; } p { margin-block-end: 2em !important; }' });
  const clipped = await page.locator('.story-enquiry, .studio-postcard').evaluateAll(sections => sections.flatMap(section =>
    Array.from(section.querySelectorAll('h2,p,button')).filter(el => {
      const node = el as HTMLElement;
      return node.checkVisibility() && !node.closest('[aria-hidden="true"],.sr-only') && node.scrollWidth > node.clientWidth + 3;
    }).map(el => el.textContent?.trim().slice(0, 50))
  ));
  expect(clipped).toEqual([]);
});

for (const width of [1440, 768, 390, 320]) {
  test(`shared homepage type remains readable and fits at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/');
    await page.locator('.landing-hero__backdrop--ready').waitFor();
    await page.evaluate(() => document.fonts.ready);
    for (const selector of ['.story-services__intro-copy > p:last-child', '.story-project__summary', '.story-services__consulting p', '.studio-postcard__copy']) {
      await expect(page.locator(selector).first()).toHaveCSS('font-size', '18px');
      await expect(page.locator(selector).first()).toHaveCSS('font-weight', '450');
    }
    await expect(page.locator('.inline-enquiry textarea')).toHaveCSS('font-size', '16px');
    await expect(page.locator('.inline-enquiry__submit-row button')).toHaveCSS('font-size', '16px');
    await expect(page.locator('.newsletter-form label').last()).toHaveCSS('font-size', '14px');
    const headingSize = await page.locator('.story-work__heading').evaluate(el => getComputedStyle(el).fontSize);
    await expect(page.locator('.studio-postcard__title')).toHaveCSS('font-size', headingSize);
    await expect(page.locator('.studio-postcard__light')).toHaveCSS('font-weight', '350');
    await expect(page.locator('.studio-postcard__bold')).toHaveCSS('font-weight', '750');
    await expect(page.locator('.inline-enquiry__heading-light')).toHaveCSS('font-weight', '350');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await page.locator('.story-service-disclosure').first().locator('summary').click();
    await expect(page.locator('.story-service-disclosure[open] p').first()).toHaveCSS('font-size', '18px');
    await page.locator('.testimonial-details').first().locator('summary').click();
    await expect(page.locator('.testimonial-details[open] .testimonial-reader p').first()).toHaveCSS('font-size', '18px');
  });
}

test('a current typography publication remains editable after a legacy upgrade', async ({ page }) => {
  await page.goto('/');
  await page.locator('.landing-hero__backdrop--ready').waitFor();
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('design-tokens:published', { detail: {
    version: 2,
    tokens: { __typographyVersion: 2, '--ds-body-min': '1.25', '--ds-body-max': '1.25' },
  } })));
  await expect(page.locator('.studio-postcard__copy')).toHaveCSS('font-size', '20px');
});

test('enlarged text reflows without clipping core homepage content', async ({ page }) => {
  await page.setViewportSize({ width: 640, height: 1000 });
  await page.goto('/');
  await page.locator('.landing-hero__backdrop--ready').waitFor();
  await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
  await expect(page.locator('.studio-postcard__copy')).toHaveCSS('font-size', '36px');
  const clipped = await page.locator('.story-services__intro-copy, .story-enquiry, .studio-postcard').evaluateAll(sections => sections.flatMap(section =>
    Array.from(section.querySelectorAll('h1,h2,h3,p,input,textarea,button')).filter(el => {
      const node = el as HTMLElement;
      return node.checkVisibility() && !node.closest('[aria-hidden="true"],.sr-only') && node.scrollWidth > node.clientWidth + 3;
    }).map(el => el.textContent?.trim().slice(0, 50))
  ));
  expect(clipped).toEqual([]);
});
