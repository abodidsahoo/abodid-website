import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from 'playwright';

const password = process.env.LAND_E2E_PASSWORD;
if (!password) throw new Error('LAND_E2E_PASSWORD is required.');

const baseURL = process.env.LAND_E2E_BASE_URL || 'http://127.0.0.1:4322';
const screenshotDirectory = join(process.cwd(), 'artifacts/land-register');
await mkdir(screenshotDirectory, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
const runtimeErrors = [];
page.on('pageerror', (error) => runtimeErrors.push(error.message));

try {
  await page.goto(`${baseURL}/land`, { waitUntil: 'networkidle' });
  await page.getByLabel('ପାସୱାର୍ଡ / Password').waitFor();
  assert.equal((await context.request.get(`${baseURL}/api/land/pdf/67`)).status(), 401);
  assert.equal((await context.request.post(`${baseURL}/api/land/admin/revisions`, { data: {} })).status(), 401);

  await page.getByLabel('ପାସୱାର୍ଡ / Password').fill(password);
  await page.getByRole('button', { name: /Open records/ }).click();
  await page.locator('.land-primary-choices').waitFor();
  assert.equal(await page.locator('.land-filters select').count(), 3);
  assert.match(await page.locator('.land-kicker').first().innerText(), /11/);
  await page.evaluate(() => (document.activeElement instanceof HTMLElement ? document.activeElement.blur() : undefined));
  await page.screenshot({ path: join(screenshotDirectory, 'land-odia-1440x900.png') });

  await page.locator('.land-khata-row').filter({ hasText: '67' }).first().evaluate((element) => element.click());
  await page.locator('#khata-title').waitFor();
  assert.equal((await context.request.get(`${baseURL}/api/land/pdf/67`)).status(), 200);
  assert.equal((await context.request.get(`${baseURL}/api/land/source/67`)).status(), 200);
  assert.equal(await page.locator('.land-map-button').getAttribute('href'), 'https://bhunakshaodisha.nic.in/');
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.evaluate(() => (document.activeElement instanceof HTMLElement ? document.activeElement.blur() : undefined));
  await page.screenshot({ path: join(screenshotDirectory, 'land-odia-1366x768.png') });

  await page.getByRole('button', { name: 'English' }).click();
  await page.getByRole('heading', { name: /Khata 67/ }).waitFor();
  await page.evaluate(() => (document.activeElement instanceof HTMLElement ? document.activeElement.blur() : undefined));
  await page.screenshot({ path: join(screenshotDirectory, 'land-english-1366x768.png') });

  await page.getByRole('button', { name: 'Capture', exact: true }).click();
  await page.getByRole('button', { name: 'Capture this record' }).click();
  await page.locator('.land-capture-preview').waitFor({ timeout: 30_000 });
  await page.locator('.land-capture-dialog .land-dialog-close').click();

  await page.getByRole('button', { name: 'Home' }).click();
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole('heading', { name: 'Welcome. What would you like to look up?' }).waitFor();
  await page.evaluate(() => (document.activeElement instanceof HTMLElement ? document.activeElement.blur() : undefined));
  await page.screenshot({ path: join(screenshotDirectory, 'land-english-1440x900.png') });

  await page.locator('.land-primary-choices button').nth(1).click();
  await page.locator('.land-person-list button').first().click();
  await page.locator('.land-person-detail').waitFor();
  assert.match(await page.locator('.land-role-label').innerText(), /Recorded holder/);

  assert.deepEqual(runtimeErrors, []);
  console.log(JSON.stringify({ ok: true, screenshots: 4, runtimeErrors }, null, 2));
} finally {
  await browser.close();
}
