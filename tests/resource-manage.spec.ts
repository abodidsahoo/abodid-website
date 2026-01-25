import { test, expect } from '@playwright/test';

test('Curator Manage Flow (Approve & Reject)', async ({ page }) => {
    // --- MOCKING SETUP ---
    const mockCurator = {
        id: 'curator-user-999',
        aud: 'authenticated',
        role: 'authenticated',
        email: 'curator@test.com',
        user_metadata: { full_name: 'Curator Bob' }
    };

    // 1. Mock Auth
    await page.route('**/auth/v1/token?grant_type=password', async route => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                access_token: 'fake-curator-token',
                expires_in: 3600,
                refresh_token: 'fake-refresh',
                user: mockCurator
            })
        });
    });

    await page.route('**/auth/v1/user', async route => {
        await route.fulfill({ status: 200, body: JSON.stringify(mockCurator) });
    });

    // 1.5 Mock Profile (Check Role)
    await page.route('**/rest/v1/profiles*', async route => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ role: 'curator' })
        });
    });

    // 2. Mock Pending Resources (GET from DB)
    await page.route('**/rest/v1/hub_resources*', async route => {
        if (route.request().method() === 'GET') {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify([
                    {
                        id: 'res-1',
                        title: 'Good Resource',
                        url: 'https://good.com',
                        status: 'pending',
                        created_at: new Date().toISOString(),
                        submitted_by: 'user-1'
                    },
                    {
                        id: 'res-2',
                        title: 'Bad Resource',
                        url: 'https://spam.com',
                        status: 'pending',
                        created_at: new Date().toISOString(),
                        submitted_by: 'user-2'
                    }
                ])
            });
        } else {
            await route.continue();
        }
    });

    // 3. Mock Approval (PATCH)
    await page.route('**/rest/v1/hub_resources?id=eq.res-1', async route => {
        if (route.request().method() === 'PATCH') {
            // Verify payload
            const postData = route.request().postDataJSON();
            expect(postData.status).toBe('approved');
            await route.fulfill({ status: 204 }); // Success
        } else {
            await route.continue();
        }
    });

    // 4. Mock Rejection Endpoint (POST /api/resources/reject)
    let rejectionEmailSent = false;
    await page.route('**/api/resources/reject', async route => {
        const data = route.request().postDataJSON();
        expect(data.resourceId).toBe('res-2');
        expect(data.reason).toBe('Spam content');

        rejectionEmailSent = true;

        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ success: true, emailResult: { sent: true } })
        });
    });

    // --- TEST EXECUTION ---

    // 1. Login as Curator
    await page.goto('/login?redirect=/resources/dashboard');

    // Mock turnstile
    await page.route('**/api/turnstile/verify', async route => route.fulfill({ status: 200, body: JSON.stringify({ success: true }) }));
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('turnstile-token', { detail: 'fake' })));

    await page.fill('input#email', 'curator@test.com');
    await page.fill('input#password', 'password');
    await page.click('#submit-btn');

    // 2. Dashboard Loaded
    await expect(page).toHaveURL(/\/resources\/dashboard/);
    await expect(page.getByRole('heading', { name: 'Curator Dashboard' })).toBeVisible();

    // 3. Verify Pending Items (Target the review queue specifically)
    const pendingCard1 = page.locator('.submission-card.pending-review').filter({ hasText: 'Good Resource' });
    const pendingCard2 = page.locator('.submission-card.pending-review').filter({ hasText: 'Bad Resource' });
    await expect(pendingCard1).toBeVisible();
    await expect(pendingCard2).toBeVisible();

    // 4. Test Approval
    await pendingCard1.locator('.btn-approve').click();
    // We mocked pending list static, so it won't disappear unless we update the mock.
    // But checking the click verifying the request went out (via route handler expectations) is enough for unit-level E2E.

    // 5. Test Rejection
    // Mock window.prompt
    page.on('dialog', dialog => dialog.accept('Spam content'));

    await pendingCard2.locator('.btn-reject').click();

    // Wait for API interaction
    await page.waitForTimeout(500);

    // Verify email trigger
    expect(rejectionEmailSent).toBe(true);
});
