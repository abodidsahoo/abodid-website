import { test, expect } from '@playwright/test';

test('Secret Lab Password Reveal and Copy', async ({ page, context }) => {
    // Grant clipboard permissions
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);

    // 1. Visit the Secret Lab page
    await page.goto('/secret-lab');

    // 2. Check initial state: Password should be hidden ("Click to reveal")
    const passwordText = page.locator('#password-text');
    await expect(passwordText).toHaveText('Click to reveal');
    await expect(passwordText).toHaveClass(/hidden-mode/);

    // 3. Click to reveal the password
    // Note: The UI has a typewriter effect, so we wait for the final text
    await page.locator('#password-container').click();

    // 4. Assert the real password appears
    const realPassword = 'mysecondbrain@2026';
    await expect(passwordText).toHaveText(realPassword, { timeout: 10000 });
    await expect(passwordText).not.toHaveClass(/hidden-mode/);

    // 5. Check if "Copy Password" button appears after reveal
    const copyBtn = page.locator('#copy-password');
    await expect(copyBtn).toBeVisible();

    // 6. Test Copy Functionality
    await copyBtn.click();
    const feedback = page.locator('#copy-feedback');
    await expect(feedback).toHaveText('✓ Copied to clipboard');
});
