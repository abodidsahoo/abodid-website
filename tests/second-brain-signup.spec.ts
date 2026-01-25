import { test, expect } from '@playwright/test';

test('Second Brain Club Signup - Captcha/API Validation', async ({ page }) => {
    // 1. Visit Secret Lab
    await page.goto('/secret-lab');

    // 2. Fill Club Signup Form
    const randomEmail = `club-${Date.now()}@example.com`;
    await page.fill('input[name="first_name"]', 'Club Member');
    await page.fill('input[name="email"]', randomEmail);

    // 3. Submit
    await page.click('button.submit-btn');

    // 4. Expect Success Message
    const msgEl = page.locator('#signup-message');
    await expect(msgEl).toBeVisible();
    await expect(msgEl).toHaveClass(/success/);
    await expect(msgEl).toHaveText(/ACCESS GRANTED/);
});
