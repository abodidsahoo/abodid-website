import { test, expect } from '@playwright/test';

test('Resource Hub Signup - Captcha Validation', async ({ page }) => {
    // 1. Visit the Resource Hub Login/Signup page
    await page.goto('/login');

    // 2. Switch to Sign Up mode
    const toggleBtn = page.locator('#mode-toggle');
    await toggleBtn.click();

    // Verify UI switched: "Create Account" button should appear
    const submitBtn = page.locator('#submit-btn');
    await expect(submitBtn).toHaveText('Create Account');

    // 3. Fill details
    await page.fill('#fullname', 'Test User');
    await page.fill('#email', 'test@example.com');
    await page.fill('#password', 'password123');

    // 4. Submit
    await submitBtn.click();

    // 5. Expect Captcha Error
    // HTML: <div id="captcha-error" ...>Please complete the captcha verification.</div>
    const errorEl = page.locator('#captcha-error');
    await expect(errorEl).toBeVisible();
    await expect(errorEl).toHaveText('Please complete the captcha verification.');
});
