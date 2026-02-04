import { test, expect } from '@playwright/test';

test('Obsidian Vault Content Verification', async ({ page, context }) => {
    // 1. Mock GitHub API Responses (simulating a successful fetch)
    // This ensures the test passes even if the real private repo is inaccessible to the test runner
    await page.route('**/repos/abodidsahoo/obsidian-vault/contents/3%20-%20Tags', async route => {
        const json = [
            { name: 'Philosophy.md', type: 'file' },
            { name: 'Design.md', type: 'file' }
        ];
        await route.fulfill({ json });
    });

    await page.route('**/repos/abodidsahoo/obsidian-vault/contents/0%20-%20Slipbox', async route => {
        const json = [
            { name: '20240101-Test-Note.md', type: 'file' }
        ];
        await route.fulfill({ json });
    });

    // 2. Enter Vault Page Directly
    await page.goto('/research/obsidian-vault');

    // 3. Verify No Error


    // 4. Verify No Error
    const bodyText = await page.locator('body').innerText();
    expect(bodyText).not.toContain('No note available');

    // 5. Verify Tags (Selector: .vault-tag)
    const tags = page.locator('.vault-tag');
    await expect(tags.first()).toBeVisible({ timeout: 10000 });
    // Check if ANY of the tags match our expectation
    const allTags = await tags.allInnerTexts();
    const tagString = allTags.join(' ');
    // We mocked 'Philosophy.md' and 'Design.md', so we expect 'Philosophy' and 'Design'
    // in the rendered text.
    expect(tagString).toMatch(/Philosophy/i);
    expect(tagString).toMatch(/Design/i);

    // 6. Verify All Notes (Infinite Scroll)
    const notesGrid = page.locator('#notes-grid');
    let previousCount = 0;
    let currentCount = 0;

    console.log('\n--- STARTING INFINITE SCROLL ---');

    // Scroll loop: Keep scrolling until no new notes appear
    while (true) {
        const notes = page.locator('.note-card');
        currentCount = await notes.count();

        console.log(`Scrolled... Found ${currentCount} notes.`);

        if (currentCount > previousCount) {
            previousCount = currentCount;
            // Scroll to bottom
            await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
            // Wait for potential network fetch or DOM update
            await page.waitForTimeout(1500);
        } else {
            console.log('No new notes loaded. Reached bottom.');
            break;
        }
    }

    // Final Accounting
    const notes = page.locator('.note-card');
    const allNotes = await notes.allInnerTexts();
    const allTagsFinal = await page.locator('.vault-tag').allInnerTexts(); // Renamed to avoid conflict with 'allTags' from step 5

    console.log('\n--- FINAL OBSIDIAN VAULT ACCOUNTING ---');
    console.log(`TOTAL TAGS: ${allTagsFinal.length}`);
    console.log(`TOTAL NOTES: ${allNotes.length}`);
    console.log('Sample Notes:', allNotes.slice(0, 5).map(n => n.trim()).join(', '));
    console.log('---------------------------------------\n');

    expect(allNotes.length).toBeGreaterThan(24); // Verify we loaded more than the initial page
});
