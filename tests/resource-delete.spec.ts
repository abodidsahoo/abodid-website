import { test, expect } from '@playwright/test';

test.skip('Admin Resource Deletion Flow (Bypass Login)', async ({ page }) => {
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

    const linkAdmin = {
        id: 'admin-user-999',
        username: 'admin',
        role: 'admin'
    };

    const session = {
        access_token: 'fake-access-token',
        token_type: 'bearer',
        expires_in: 3600,
        refresh_token: 'fake-refresh-token',
        user: mockAdmin
    };

    // 1. Mock Global State Mocks
    await page.route('**/auth/v1/user', async route => {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockAdmin) });
    });

    await page.route(/\/rest\/v1\/profiles/, async route => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ role: 'admin' })
        });
    });

    // 2. Mock Resource Fetch
    await page.route(/\/rest\/v1\/hub_resources/, async route => {
        if (route.request().method() === 'GET') {
            await route.fulfill({
                status: 200,
                contentType: 'application/vnd.pgrst.object+json; charset=utf-8',
                body: JSON.stringify({
                    id: 'res-delete-1',
                    title: 'Resource To Delete',
                    url: 'https://delete.me',
                    status: 'approved',
                    tags: []
                })
            });
        } else if (route.request().method() === 'DELETE') {
            await route.fulfill({ status: 204 });
        } else {
            await route.continue();
        }
    });

    await page.route('**/rest/v1/hub_tags*', async route => route.fulfill({ status: 200, body: JSON.stringify([]) }));

    // 3. Inject Session & Navigate
    await page.goto('/'); // Need a page context to set storage
    await page.evaluate(({ key, value }) => {
        localStorage.setItem(key, JSON.stringify(value));
    }, { key: STORAGE_KEY, value: session });

    // 4. Go to Edit Page directly
    await page.goto('/resources/res-delete-1/edit');

    // 5. Verify Loaded
    await expect(page.locator('h2')).toHaveText('Edit Resource');
    await expect(page.locator('button:has-text("Delete Resource")')).toBeVisible();

    // 6. Click Delete using confirm mock
    page.on('dialog', dialog => dialog.accept());

    // Track delete request
    const deleteRequestPromise = page.waitForRequest(req => req.method() === 'DELETE' && req.url().includes('res-delete-1'));

    await page.click('button:has-text("Delete Resource")');

    const deleteReq = await deleteRequestPromise;
    expect(deleteReq).toBeTruthy();

    // 7. Verify Redirect (Client side redirect to dashboard)
    await expect(page).toHaveURL(/\/resources\/dashboard/);
});
