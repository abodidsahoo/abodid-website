import { test, expect } from '@playwright/test';

// Skip if Auth is too flaky, but this bypass should work
test('Admin Dashboard Deletion Flow (Bypass Login)', async ({ page }) => {
    const PROJECT_REF = 'jwipqbjxpmgyevfzpjjx';
    const STORAGE_KEY = `sb-${PROJECT_REF}-auth-token`;

    const mockAdmin = {
        id: 'admin-user-999',
        aud: 'authenticated',
        role: 'authenticated',
        email: 'admin@test.com',
        user_metadata: { full_name: 'Admin User' },
        app_metadata: { provider: 'email' }
    };

    const session = {
        access_token: 'fake-access-token',
        token_type: 'bearer',
        expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        refresh_token: 'fake-refresh-token',
        user: mockAdmin
    };

    // 1. Mock Profile (Admin)
    await page.route('**/rest/v1/profiles*', async route => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ role: 'admin' })
        });
    });

    // 2. Mock Resource Fetch (Pending List for Curator Dashboard)
    await page.route(/\/rest\/v1\/hub_resources/, async route => {
        if (route.request().method() === 'GET') {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify([
                    {
                        id: 'res-delete-dash-1',
                        title: 'Dashboard Delete Item',
                        url: 'https://delete-dash.me',
                        status: 'pending',
                        submitted_by: 'user-123',
                        created_at: new Date().toISOString()
                    }
                ])
            });
        } else if (route.request().method() === 'DELETE') {
            // Verify ID matches
            if (route.request().url().includes('res-delete-dash-1')) {
                await route.fulfill({ status: 204 });
            } else {
                await route.continue();
            }
        } else {
            await route.continue();
        }
    });

    // 3. Inject Session via initScript (Persistent)
    await page.addInitScript(({ key, value }) => {
        window.localStorage.setItem(key, JSON.stringify(value));
    }, { key: STORAGE_KEY, value: session });

    // 4. Go to Curator Dashboard
    await page.goto('/resources/dashboard');

    // 5. Verify Loaded
    console.log('Current URL:', page.url());
    // Wait for the specific dashboard header
    await expect(page.locator('h1', { hasText: 'Curator Dashboard' })).toBeVisible();
    // Check pending item exists
    await expect(page.locator('text=Dashboard Delete Item')).toBeVisible();

    // 6. Verify Delete Button Exists (Admin Only)
    const deleteBtn = page.locator('button[title="Admin Delete"]');
    await expect(deleteBtn).toBeVisible();

    // 7. Click Delete
    page.on('dialog', dialog => dialog.accept());

    // Track delete request
    const deleteRequestPromise = page.waitForRequest(req => req.method() === 'DELETE' && req.url().includes('res-delete-dash-1'));

    await deleteBtn.click();

    const deleteReq = await deleteRequestPromise;
    expect(deleteReq).toBeTruthy();

});
