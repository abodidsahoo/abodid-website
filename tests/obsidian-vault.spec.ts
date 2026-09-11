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
    const vaultResponse = await page.goto('/obsidian-vault');
    expect(vaultResponse?.status()).toBe(200);
    expect(new URL(page.url()).pathname).toBe('/obsidian-vault');
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
        'href',
        'https://abodid.com/obsidian-vault'
    );
    await expect(page.locator('a[href="/obsidian-vault/directory"]')).toBeVisible();
    expect(await page.locator('[href^="/research/obsidian-vault"], [src^="/research/obsidian-vault"]').count()).toBe(0);

    // 3. Verify No Error


    // 4. Verify No Error
    const bodyText = await page.locator('body').innerText();
    expect(bodyText).not.toContain('No note available');

    // 5. Verify Tags (Selector: .vault-tag)
    const tags = page.locator('.vault-tag');
    await expect(tags.first()).toBeVisible({ timeout: 10000 });
    // Check if ANY of the tags match our expectation
    const allTags = await tags.allInnerTexts();
    const firstTopicHref = await tags.first().getAttribute('href');
    expect(firstTopicHref).toMatch(/^\/obsidian-vault\/topic\//);
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

    const firstNoteHref = await page.locator('.note-card').first().getAttribute('href');
    expect(firstNoteHref).toMatch(/^\/obsidian-vault\/[a-z0-9%._~-]+/i);

    const noteResponse = await page.goto(firstNoteHref!);
    expect(noteResponse?.status()).toBe(200);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
        'href',
        /^https:\/\/abodid\.com\/obsidian-vault\//
    );
    expect(await page.locator('[href^="/research/obsidian-vault"], [src^="/research/obsidian-vault"]').count()).toBe(0);

    for (const slug of [
        'AI-is-only-as-ethical-as-the-humans-behind-it',
        'The Art of Self-Sabotage',
        "bharat's-marriage-love-is-a-choice",
        'is-writing-art',
    ]) {
        const specialSlugResponse = await page.goto(`/obsidian-vault/${encodeURIComponent(slug)}`);
        expect(specialSlugResponse?.status(), `Expected ${slug} to resolve`).toBe(200);
    }

    const directoryResponse = await page.goto('/obsidian-vault/directory');
    expect(directoryResponse?.status()).toBe(200);
    await expect(page.locator('a.directory-back-link[href="/obsidian-vault"]')).toBeVisible();

    const topicResponse = await page.goto(firstTopicHref!);
    expect(topicResponse?.status()).toBe(200);
    expect(new URL(page.url()).pathname).toMatch(/^\/obsidian-vault\/topic\//);

    const tagResponse = await page.goto(firstTopicHref!.replace('/topic/', '/tag/'));
    expect(tagResponse?.status()).toBe(200);
    expect(new URL(page.url()).pathname).toBe(new URL(firstTopicHref!, page.url()).pathname);
    const tagRedirectResponse = await tagResponse?.request().redirectedFrom()?.response();
    expect(tagRedirectResponse?.status()).toBe(308);

    const assetResponse = await page.request.get(
        '/obsidian-vault/assets/agentic-ai-flow-explained-and-illustrated-01.webp'
    );
    expect(assetResponse.status()).toBe(200);
    expect(assetResponse.headers()['content-type']).toContain('image/webp');

    const legacyAssetResponse = await page.request.get(
        '/research/obsidian-vault/assets/agentic-ai-flow-explained-and-illustrated-01.webp',
        { maxRedirects: 0 }
    );
    expect(legacyAssetResponse.status()).toBe(308);
    expect(legacyAssetResponse.headers()['location']).toBe(
        '/obsidian-vault/assets/agentic-ai-flow-explained-and-illustrated-01.webp'
    );

    const topicPath = new URL(firstTopicHref!, page.url()).pathname;
    const topicSlug = topicPath.slice('/obsidian-vault/topic/'.length);
    const redirectCases = [
        ['/research/obsidian-vault/directory', '/obsidian-vault/directory'],
        [`/research${firstNoteHref}`, firstNoteHref!],
        [`/research/obsidian-vault/topic/${topicSlug}`, topicPath],
        [`/research/obsidian-vault/tag/${topicSlug}`, topicPath],
    ];
    for (const [legacyPath, canonicalPath] of redirectCases) {
        const response = await page.request.get(legacyPath, { maxRedirects: 0 });
        expect(response.status(), `Expected ${legacyPath} to redirect`).toBe(308);
        expect(response.headers()['location']).toBe(canonicalPath);
    }

    const sitemapResponse = await page.request.get('/vault-sitemap.xml');
    expect(sitemapResponse.status()).toBe(200);
    const sitemapXml = await sitemapResponse.text();
    expect(sitemapXml).not.toContain('/research/obsidian-vault');
    expect(sitemapXml.match(/<loc>/g)?.length).toBe(347);
    expect(sitemapXml).toContain('https://abodid.com/obsidian-vault/');

    const legacyResponse = await page.goto('/research/obsidian-vault?fromVaultSearch=1');
    expect(legacyResponse?.status()).toBe(200);
    expect(new URL(page.url()).pathname).toBe('/obsidian-vault');
    expect(new URL(page.url()).search).toBe('?fromVaultSearch=1');
    const redirectResponse = await legacyResponse?.request().redirectedFrom()?.response();
    expect(redirectResponse?.status()).toBe(308);
});
