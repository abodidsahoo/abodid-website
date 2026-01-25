import { test, expect } from '@playwright/test';

test('User Resource Submission Flow (Mocked)', async ({ page }) => {
    // --- MOCKING SETUP ---
    // 1. Mock Auth: Simulate a logged-in user
    const mockUser = {
        id: 'mock-user-123',
        aud: 'authenticated',
        role: 'authenticated',
        email: 'contributor@test.com'
    };

    const mockSession = {
        access_token: 'fake-jwt-token',
        expires_in: 3600,
        refresh_token: 'fake-refresh-token',
        user: mockUser
    };

    // Mock POST to /token (Login)
    await page.route('**/auth/v1/token?grant_type=password', async route => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(mockSession)
        });
    });

    // Mock GET to /user (Session verification)
    await page.route('**/auth/v1/user', async route => {
        await route.fulfill({ status: 200, body: JSON.stringify(mockUser) });
    });

    // 1. Visit Login Page
    await page.goto('/login?redirect=/resources/submit');

    // 2. Perform Mocked Login
    await page.fill('input#email', 'contributor@test.com');
    await page.fill('input#password', 'any-password');
    // Handle Captcha Check (Mocking the verification API?)
    // The login page calls verifyCaptcha on our server (/api/turnstile/verify).
    // We MUST mock this too or the login button stays disabled/fails.
    await page.route('**/api/turnstile/verify', async route => {
        await route.fulfill({ status: 200, body: JSON.stringify({ success: true }) });
    });

    // Since we mock the API, we can bypass the actual captcha interactions if we just trigger the submit logic.
    // Actually, the code requires `captchaToken` to be present.
    // We can inject a fake token event?
    await page.evaluate(() => {
        window.dispatchEvent(new CustomEvent('turnstile-token', { detail: 'fake-token' }));
    });

    await page.click('#submit-btn');

    // 3. Wait for Redirection (Supabase client handles it)
    await expect(page).toHaveURL(/\/resources\/submit/);

    // Verify we are logged in (Login Required should be gone)
    await expect(page.locator('text=Login to Submit')).toBeHidden();
    // 2. Mock DB Operations

    // A. Mock User Profile (Role Check)
    await page.route('**/rest/v1/profiles*', async route => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ role: 'user' }) // Single object for .single()
        });
    });

    // B. Mock Rate Limit Check (GET hub_resources count)
    // Logic: The code queries GET with parameters. We need to handle GET differently from POST/PATCH.
    // Rate limit query: .select('id', { count: 'exact', head: true }) -> essentially a HEAD or GET with count
    // We can just return empty list and count 0 header
    await page.route('**/rest/v1/hub_resources*', async route => {
        const method = route.request().method();

        if (method === 'POST') {
            // C. Mock Insert
            await route.fulfill({
                status: 201,
                contentType: 'application/json',
                body: JSON.stringify({ id: 'new-resource-999', status: 'pending' }) // Standard return for single()
            });
        } else if (method === 'GET') {
            // Rate limit check or Dashboard fetch
            const url = route.request().url();
            if (url.includes('submitted_by=eq.mock-user-123')) {
                // This could be rate limit check OR dashboard check
                // If it has 'gte', it is rate limit.
                if (url.includes('gte')) {
                    await route.fulfill({
                        status: 200,
                        contentType: 'application/json',
                        headers: { 'content-range': '0-0/0' }, // Count 0
                        body: JSON.stringify([])
                    });
                } else {
                    // Dashboard Fetch (Success after submit)
                    await route.fulfill({
                        status: 200,
                        contentType: 'application/json',
                        body: JSON.stringify([
                            {
                                id: 'new-resource-999',
                                title: 'Amazing Tool',
                                url: 'https://tool.com',
                                status: 'pending',
                                created_at: new Date().toISOString()
                            }
                        ])
                    });
                }
            } else {
                await route.fulfill({ status: 200, body: JSON.stringify([]) });
            }
        } else {
            await route.continue();
        }
    });
    // --- MOCK BOOKMARKS (Empty for now) ---
    await page.route('**/rest/v1/bookmarks*', async route => {
        await route.fulfill({
            status: 200, body: JSON.stringify([])
        });
    });


    // --- TEST EXECUTION (Continued) ---

    // Verify we are NOT asked to login
    await expect(page.locator('text=Login to Submit')).toBeHidden();
    await expect(page.locator('text=Submit a Resource')).toBeVisible();

    // 2. Fill Submission Form
    await page.fill('input[placeholder*="verified link"]', 'https://tool.com');
    await page.fill('input[value=""]', 'Amazing Tool'); // Title (React controlled input might be tricky, relying on sequence or label)

    // Note: The labels do not have 'for' attributes, so we use container filtering
    await page.locator('.hub-form-group').filter({ hasText: 'Title' }).locator('input').fill('Amazing Tool');
    await page.locator('.hub-form-group').filter({ hasText: 'Description' }).locator('textarea').fill('This tool saves time.');

    // Tags (TagInput)
    // Assuming generic input or we need to type and enter
    // Inspecting TagInput logic would be better, but let's try basic fill+enter
    const tagInput = page.locator('.tag-input input'); // Assuming class
    if (await tagInput.isVisible()) {
        await tagInput.fill('Design');
        await tagInput.press('Enter');
    }

    // 3. Submit
    await page.click('button:has-text("Submit Resource")');

    // 4. Verify Success Message
    await expect(page.locator('text=Submitted!')).toBeVisible();
    await expect(page.locator('text=pending review')).toBeVisible();

    // 5. Go to Dashboard to check Pending Status
    await page.click('button:has-text("View on Hub")');
    // or navigate directly if the button logic isn't exact
    // await page.goto('/resources/dashboard');

    // 6. Verify Dashboard Content
    await expect(page.locator('h1')).toHaveText('My Dashboard');

    // Check for the "Pending" status card/badge
    const pendingCard = page.locator('.submission-card').first();
    await expect(pendingCard).toBeVisible();
    await expect(pendingCard).toContainText('Amazing Tool');
    await expect(pendingCard).toContainText('pending');
});
