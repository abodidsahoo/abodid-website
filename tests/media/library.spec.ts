import { test, expect } from '@playwright/test';
import { writeFile, unlink, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { unzipSync, strFromU8 } from 'fflate';

test.describe.configure({ mode: 'serial' });

const fixture = fileURLToPath(new URL('../../src/pages/media-library-qa.astro', import.meta.url));
test.beforeAll(async () => {
    await writeFile(fixture, `---
import MediaLibrary from '../components/admin/MediaLibrary.jsx';
import '../styles/admin-global.css';
export const prerender = false;
---
<html class="admin-document" data-theme="light"><head><title>Media Library QA</title></head><body><MediaLibrary client:only="react" accessToken="qa-admin" /><style is:global>:root { --font-sans:Arial,sans-serif; --admin-page-content-max:1600px; } html[data-theme="light"] { color-scheme:light; } html[data-theme="dark"] { color-scheme:dark; } body { background:var(--bg-color); color:var(--text-primary); font-family:Arial,sans-serif; margin:20px; } * { box-sizing:border-box; }</style></body></html>`);
});
test.afterAll(async () => { await unlink(fixture); });

test('prefetches folders, reuses navigation and local filters, and invalidates listings after edits', async ({ page }) => {
    const counts = { all: 0, documents: 0 };
    const refreshes: Array<string | null> = [];
    let name = 'Folder book.pdf';
    await page.route('**/api/admin/media?*', async (route) => {
        const params = new URL(route.request().url()).searchParams;
        const folder = params.get('folder');
        if (folder) counts.documents += 1;
        else { counts.all += 1; refreshes.push(params.get('refresh')); }
        await new Promise((resolve) => setTimeout(resolve, 150));
        await route.fulfill({ json: {
            files: [{ objectKey: 'documents/book.pdf', name: folder ? name : `All: ${name}`, folderPath: 'documents', mimeType: 'application/pdf', fileSize: 20 }],
            folders: folder ? [] : [{ name: 'documents', path: 'documents' }], totalCount: 1,
        } });
    });
    await page.route('**/api/admin/media/metadata', async (route) => {
        name = route.request().postDataJSON().name;
        await route.fulfill({ json: { name, altText: '' } });
    });
    await expect.poll(async () => (await page.request.get('/media-library-qa')).status(), { timeout: 15000 }).toBe(200);
    await page.goto('/media-library-qa');
    await expect(page.getByRole('checkbox', { name: 'Select All: Folder book.pdf', exact: true })).toBeVisible();
    const sidebar = page.getByRole('complementary', { name: 'Media folders' });
    const documents = sidebar.getByRole('button', { name: 'documents', exact: true });
    await documents.hover();
    await expect.poll(() => counts.documents).toBe(1);
    await page.mouse.move(0, 0);
    await documents.click(); // Joins the in-flight prefetch instead of fetching twice.
    await expect(page.getByRole('checkbox', { name: 'Select Folder book.pdf', exact: true })).toBeVisible();
    expect(counts.documents).toBe(1);
    await page.getByRole('combobox', { name: 'File type', exact: true }).selectOption('documents');
    await page.getByRole('combobox', { name: 'Sort media', exact: true }).selectOption('name-asc');
    await expect(page.getByRole('checkbox', { name: 'Select Folder book.pdf', exact: true })).toBeVisible();
    expect(counts.documents).toBe(1);
    // Return to the original filter to verify the cached All files response.
    await page.getByRole('combobox', { name: 'File type', exact: true }).selectOption('all');
    await page.getByRole('combobox', { name: 'Sort media', exact: true }).selectOption('date-desc');
    await sidebar.getByRole('button', { name: 'All files', exact: true }).click();
    await expect(page.getByRole('checkbox', { name: 'Select All: Folder book.pdf', exact: true })).toBeVisible();
    expect(counts.all).toBe(1);
    expect(refreshes).toEqual([null]);
    await documents.click();
    await page.getByRole('checkbox', { name: 'Select Folder book.pdf', exact: true }).check();
    await page.getByRole('button', { name: 'Rename file', exact: true }).click();
    await page.getByRole('textbox', { name: 'File name', exact: true }).fill('Renamed.pdf');
    await page.getByRole('button', { name: 'Rename', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await sidebar.getByRole('button', { name: 'All files', exact: true }).click();
    await expect(page.getByRole('checkbox', { name: 'Select All: Renamed.pdf', exact: true })).toBeVisible();
    expect(refreshes).toEqual([null, 'catalogue']);
    await page.getByRole('button', { name: 'Refresh', exact: true }).click();
    await expect.poll(() => refreshes).toEqual([null, 'catalogue', '1']);
    await expect(page.getByRole('checkbox', { name: 'Select All: Renamed.pdf', exact: true })).toBeVisible();
});

const files = ['Book.pdf', 'Notes.txt', 'Design.psd'].map((name, index) => ({
    objectKey: `documents/${name.toLowerCase()}`, name, mimeType: ['application/pdf', 'text/plain', 'application/octet-stream'][index],
    publicUrl: `https://assets.example/${name}`, fileSize: 20, createdAt: '2026-11-04T00:00:00Z',
}));

test('mixed uploads bypass site body limits; checkboxes download complete ZIP in grid and list', async ({ page }, testInfo) => {
    const completed: string[] = [];
    const presigned: any[] = [];
    const directUploads: number[] = [];
    await page.route('**/api/admin/media?*', (route) => route.fulfill({ json: { folderPath: 'documents', files, folders: [] } }));
    await page.route('**/api/admin/media/presign', async (route) => {
        const body = route.request().postDataJSON();
        presigned.push(body);
        if (body.filename === 'Bad.bin') return route.fulfill({ status: 500, json: { error: 'Test failure' } });
        return route.fulfill({ json: { uploadUrl: `http://localhost:4321/__r2-put/${body.filename}`, objectKey: `documents/${body.filename}`, requiredHeaders: { 'Content-Type': body.contentType } } });
    });
    await page.route('**/__r2-put/*', async (route) => {
        expect(route.request().headers().authorization).toBeUndefined();
        directUploads.push(route.request().postDataBuffer()!.length);
        await route.fulfill({ status: 200, body: '' });
    });
    await page.route('**/api/admin/media/complete', async (route) => {
        completed.push(route.request().postDataJSON().originalFilename);
        await route.fulfill({ json: { asset: {} } });
    });
    await page.route('**/api/admin/media/download', async (route) => {
        expect(route.request().headers().authorization).toBe('Bearer qa-admin');
        await route.fulfill({ contentType: 'application/octet-stream', body: `Original ${route.request().postDataJSON().objectKey}` });
    });
    await expect.poll(async () => (await page.request.get('/media-library-qa')).status(), { timeout: 15000 }).toBe(200);
    await page.goto('/media-library-qa');
    await expect(page.getByText('Library connected', { exact: true })).toBeVisible();
    expect(await page.locator('input[type=file]').getAttribute('accept')).toBeNull();
    await page.locator('input[type=file]').setInputFiles([
        { name: 'Large.pdf', mimeType: 'application/pdf', buffer: Buffer.alloc(6 * 1024 * 1024, 42) },
        { name: 'Bad.bin', mimeType: '', buffer: Buffer.from('bad') },
        { name: 'Source.psd', mimeType: '', buffer: Buffer.from('design') },
    ]);
    await expect(page.getByText('2 files uploaded successfully.')).toBeVisible();
    await expect(page.getByRole('alert')).toContainText('Bad.bin: Test failure');
    expect(completed).toEqual(['Large.pdf', 'Source.psd']);
    expect(directUploads).toEqual([6 * 1024 * 1024, 6]);
    expect(presigned[2].contentType).not.toBe('');
    await page.getByRole('checkbox', { name: 'Select Book.pdf', exact: true }).check();
    await expect(page.getByRole('checkbox', { name: 'Select all shown' })).toHaveJSProperty('indeterminate', true);
    await page.getByRole('checkbox', { name: 'Select Notes.txt', exact: true }).focus();
    await page.keyboard.press('Space');
    await expect(page.getByText('2 selected', { exact: true })).toBeVisible();
    const [download] = await Promise.all([
        page.waitForEvent('download'),
        page.getByRole('button', { name: 'Download selected (ZIP)' }).click(),
    ]);
    const archive = unzipSync(await readFile((await download.path())!));
    expect(Object.keys(archive).sort()).toEqual(['Book.pdf', 'Notes.txt']);
    expect(strFromU8(archive['Book.pdf'])).toBe('Original documents/book.pdf');
    await page.getByRole('button', { name: 'Clear', exact: true }).click();
    await page.getByRole('button', { name: 'List view' }).click();
    await page.getByRole('checkbox', { name: 'Select all shown' }).check();
    await expect(page.getByText('3 selected', { exact: true })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('media-library-desktop.png') });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('button', { name: 'Grid view' }).click();
    await page.getByRole('button', { name: 'Download selected (ZIP)' }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath('media-library-mobile.png') });
    await expect(page.getByRole('button', { name: 'Download selected (ZIP)' })).toBeInViewport();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(overflow).toBe(false);
    await page.screenshot({ path: testInfo.outputPath('media-library-mobile.png') });
});


test('drag selected files into presentations, then copy and cut using the preview and context menu', async ({ page }, testInfo) => {
    const root = 'documents/2026';
    const target = `${root}/presentations`;
    const entries = files.slice(0, 2).map((file) => ({ ...file, objectKey: `${root}/${file.name.toLowerCase()}`, folderPath: root }));
    const operations: any[] = [];
    await page.route('**/api/admin/media?*', (route) => {
        const folder = new URL(route.request().url()).searchParams.get('folder') || '';
        const children: Record<string, any[]> = {
            '': [{ name: 'documents', path: 'documents' }],
            documents: [{ name: '2026', path: root }],
            [root]: [{ name: 'presentations', path: target }],
        };
        return route.fulfill({ json: { folderPath: folder, files: entries.filter((file) => file.folderPath === folder), folders: children[folder] || [] } });
    });
    await page.route('**/api/admin/media/organize', (route) => {
        const body = route.request().postDataJSON();
        operations.push(body);
        const results = body.objectKeys.map((key: string) => {
            const file = entries.find((item) => item.objectKey === key)!;
            if (body.action === 'move') {
                file.folderPath = body.destinationFolder;
                return { objectKey: key, newObjectKey: key, folderPath: body.destinationFolder };
            }
            const newKey = `${body.destinationFolder}/copy-${entries.length}-${file.name}`;
            entries.push({ ...file, objectKey: newKey, folderPath: body.destinationFolder });
            return { objectKey: key, newObjectKey: newKey, folderPath: body.destinationFolder };
        });
        return route.fulfill({ json: { results } });
    });
    await expect.poll(async () => (await page.request.get('/media-library-qa')).status(), { timeout: 15000 }).toBe(200);
    await page.goto('/media-library-qa');
    await expect(page.getByText('Library connected', { exact: true })).toBeVisible();
    await page.locator('.finder-items .folder-item').filter({ hasText: 'documents' }).click();
    await page.locator('.finder-items .folder-item').filter({ hasText: '2026' }).click();
    await page.getByRole('checkbox', { name: 'Select all shown' }).check();
    await expect(page.getByText('2 files selected', { exact: true })).toBeVisible();
    await page.locator('.file-item').filter({ hasText: 'Book.pdf' }).dragTo(page.locator('.folder-item').filter({ hasText: 'presentations' }));
    await expect(page.getByText(`2 files moved to ${target}.`, { exact: true })).toBeVisible();
    expect(operations[0]).toMatchObject({ action: 'move', destinationFolder: target, objectKeys: entries.slice(0, 2).map((file) => file.objectKey) });
    await expect(page.locator('.file-entry')).toHaveCount(0);
    await page.locator('.folder-item').filter({ hasText: 'presentations' }).click();
    await expect(page.locator('.file-entry')).toHaveCount(2);
    await page.getByRole('checkbox', { name: 'Select all shown' }).check();
    await page.getByRole('complementary', { name: 'Selected file details' }).getByRole('button', { name: 'Copy files', exact: true }).click();
    await page.locator('.breadcrumbs button').filter({ hasText: /^2026$/ }).click();
    const area = page.locator('.browser-scroll');
    const bounds = (await area.boundingBox())!;
    await area.click({ button: 'right', position: { x: bounds.width - 12, y: bounds.height - 12 } });
    await expect(page.getByRole('menu', { name: 'Media Library actions' })).toBeVisible();
    await page.getByRole('menuitem', { name: 'Paste into this folder' }).click();
    await expect(page.getByText(`2 files copied to ${root}.`, { exact: true })).toBeVisible();
    await expect(page.locator('.file-entry')).toHaveCount(2);
    expect(entries.filter((file) => file.folderPath === target)).toHaveLength(2);
    await page.getByRole('button', { name: 'Clear', exact: true }).click();
    await page.getByRole('checkbox', { name: 'Select all shown' }).check();
    await page.locator('.file-item').filter({ hasText: 'Book.pdf' }).click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Cut files' }).click();
    await page.locator('.folder-item').filter({ hasText: 'presentations' }).click();
    await page.getByRole('button', { name: 'Paste here (2)' }).click();
    await expect(page.locator('.file-entry')).toHaveCount(4);
    await expect(page.getByText(`2 files moved to ${target}.`, { exact: true })).toBeVisible();
    // Actions stay contextual: select files to reveal the command toolbar.
    await page.getByRole('checkbox', { name: 'Select all shown' }).check();
    // Keyboard menu navigation and Escape restore focus, without trapping Tab.
    const actions = page.getByRole('button', { name: 'More file actions' });
    await actions.focus();
    await page.keyboard.press('Shift+F10');
    await expect(page.getByRole('menu')).toBeVisible();
    await page.keyboard.press('End');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('menu')).toHaveCount(0);
    await expect(actions).toBeFocused();
    await page.screenshot({ path: testInfo.outputPath('media-library-folders.png') });
    await page.getByRole('checkbox', { name: 'Select all shown' }).check();
    await page.locator('.file-item').first().focus();
    await page.keyboard.press('Control+c');
    await expect(page.getByText('4 files copied. Open a folder and choose Paste.')).toBeVisible();
    await page.locator('.breadcrumbs button').filter({ hasText: /^2026$/ }).click();
    await page.locator('.folder-item').filter({ hasText: 'presentations' }).click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Paste into this folder' }).click();
    await expect(page.getByText(`4 files copied to ${target}.`, { exact: true })).toBeVisible();
    expect(operations.at(-1).destinationFolder).toBe(target);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('button', { name: 'More file actions' }).click();
    await expect(page.getByRole('menu')).toBeVisible();
    const menuBounds = (await page.locator('.media-context-menu').boundingBox())!;
    expect(menuBounds.x).toBeGreaterThanOrEqual(0);
    expect(menuBounds.y).toBeGreaterThanOrEqual(0);
    expect(menuBounds.x + menuBounds.width).toBeLessThanOrEqual(390);
    expect(menuBounds.y + menuBounds.height).toBeLessThanOrEqual(844);
    await page.screenshot({ path: testInfo.outputPath('media-library-menu-mobile.png') });
    await page.keyboard.press('Escape');
    await expect(page.getByRole('menu')).toHaveCount(0);
});


test('folder Copy and Cut include nested files and empty subfolders, with collision-safe destinations', async ({ page }) => {
    const folderPaths = new Set(['documents', 'documents/presentations', 'documents/presentations/nested', 'documents/presentations/empty', 'archive']);
    const hidden = new Set<string>();
    const entries = files.slice(0, 2).map((file, index) => ({ ...file,
        objectKey: `documents/presentations/${index ? 'nested/' : ''}${file.name.toLowerCase()}`,
        folderPath: `documents/presentations${index ? '/nested' : ''}`,
    }));
    const operations: any[] = [];
    const isVisible = (path: string) => ![...hidden].some((source) => path === source || path.startsWith(`${source}/`));
    await page.route('**/api/admin/media?*', (route) => {
        const folder = new URL(route.request().url()).searchParams.get('folder') || '';
        const children = [...folderPaths].filter((path) => path.split('/').slice(0, -1).join('/') === folder && isVisible(path));
        return route.fulfill({ json: { folderPath: folder, files: entries.filter((file) => file.folderPath === folder), folders: children.map((path) => ({ name: path.split('/').pop(), path })) } });
    });
    await page.route('**/api/admin/media/folder-organize', (route) => {
        const body = route.request().postDataJSON();
        operations.push(body);
        const source = body.sourceFolder;
        if (body.destinationFolder === source || body.destinationFolder.startsWith(`${source}/`)) return route.fulfill({ status: 400, json: { error: 'A folder cannot be pasted into itself or one of its subfolders.' } });
        if (body.phase === 'finish') {
            expect(entries.some((file) => file.folderPath === source || file.folderPath.startsWith(`${source}/`))).toBe(false);
            for (const path of folderPaths) if (path === source || path.startsWith(`${source}/`)) hidden.add(path);
            return route.fulfill({ json: { completed: true } });
        }
        const name = body.destinationName ? body.destinationName.toLowerCase().replace(/\s+/g, '-') : source.split('/').pop();
        const first = `${body.destinationFolder}/${name}`;
        let destination = first;
        for (let copy = 2; folderPaths.has(destination); copy += 1) destination = `${first}-${copy}`;
        const sourceTree = [...folderPaths].filter((path) => (path === source || path.startsWith(`${source}/`)) && isVisible(path));
        const groups = sourceTree.map((path) => ({ folder: path, destinationFolder: `${destination}${path.slice(source.length)}`, files: entries.filter((file) => file.folderPath === path).map((file) => ({ objectKey: file.objectKey, name: file.name })) }));
        groups.forEach((group) => folderPaths.add(group.destinationFolder));
        return route.fulfill({ json: { sourceFolder: source, destinationFolder: destination, groups, fileCount: groups.reduce((sum, group) => sum + group.files.length, 0) } });
    });
    await page.route('**/api/admin/media/organize', (route) => {
        const body = route.request().postDataJSON();
        const results = body.objectKeys.map((key: string) => {
            const file = entries.find((item) => item.objectKey === key)!;
            if (body.action === 'copy') {
                const newKey = `${body.destinationFolder}/copy-${entries.length}-${file.name}`;
                entries.push({ ...file, objectKey: newKey, folderPath: body.destinationFolder });
                return { objectKey: key, newObjectKey: newKey };
            }
            file.folderPath = body.destinationFolder;
            return { objectKey: key, newObjectKey: key };
        });
        return route.fulfill({ json: { results } });
    });
    await expect.poll(async () => (await page.request.get('/media-library-qa')).status(), { timeout: 15000 }).toBe(200);
    await page.goto('/media-library-qa');
    await page.locator('.finder-items .folder-item').filter({ has: page.locator('.item-name').filter({ hasText: /^documents$/ }) }).click();
    await page.locator('.folder-item').filter({ has: page.locator('.item-name').filter({ hasText: /^presentations$/ }) }).click({ button: 'right' });
    await expect(page.getByRole('menuitem', { name: 'Copy folder', exact: true })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Cut folder', exact: true })).toBeVisible();
    await page.getByRole('menuitem', { name: 'Copy folder', exact: true }).click();
    await page.locator('.sidebar-location').filter({ hasText: /^archive$/ }).click();
    await page.getByRole('button', { name: 'Paste here (1)' }).click();
    await expect(page.getByText('Folder “presentations” copied to archive/presentations.', { exact: true })).toBeVisible();
    expect(folderPaths.has('archive/presentations/empty')).toBe(true);
    expect(entries.filter((file) => file.folderPath.startsWith('documents/presentations'))).toHaveLength(2);
    expect(entries.filter((file) => file.folderPath.startsWith('archive/presentations'))).toHaveLength(2);
    await page.locator('.folder-item').filter({ has: page.locator('.item-name').filter({ hasText: /^presentations$/ }) }).click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Cut folder', exact: true }).click();
    await page.locator('.sidebar-location').filter({ hasText: /^documents$/ }).click();
    await page.getByRole('button', { name: 'Paste here (1)' }).click();
    await expect(page.getByText('Folder “presentations” moved to documents/presentations-2.', { exact: true })).toBeVisible();
    await expect(page.locator('.folder-item')).toHaveCount(2);
    expect(hidden.has('archive/presentations')).toBe(true);
    expect(folderPaths.has('documents/presentations-2/empty')).toBe(true);
    expect(operations.some((operation) => operation.phase === 'finish')).toBe(true);
    // A copied folder can also be moved by dragging, with stable file keys.
    const copiedKeys = entries.slice(2).map((file) => file.objectKey);
    await page.locator('.folder-item').filter({ has: page.locator('.item-name').filter({ hasText: /^presentations-2$/ }) }).dragTo(page.locator('.sidebar-location').filter({ hasText: /^archive$/ }));
    await expect(page.getByText('Folder “presentations-2” moved to archive/presentations-2.', { exact: true })).toBeVisible();
    expect(entries.slice(2).map((file) => file.objectKey)).toEqual(copiedKeys);
    const sourceFolder = page.locator('.folder-item').filter({ has: page.locator('.item-name').filter({ hasText: /^presentations$/ }) });
    await sourceFolder.focus();
    await page.keyboard.press('Shift+F10');
    await expect(page.getByRole('menuitem', { name: 'Copy folder', exact: true })).toBeVisible();
    await page.getByRole('menuitem', { name: 'Copy folder', exact: true }).click();
    await sourceFolder.click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Paste into this folder' }).click();
    await expect(page.getByRole('alert')).toContainText('A folder cannot be pasted into itself');
    await expect(sourceFolder).toBeVisible();
    const originalKeys = entries.slice(0, 2).map((file) => file.objectKey);
    await sourceFolder.click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Rename folder', exact: true }).click();
    await page.getByRole('textbox', { name: 'Folder name', exact: true }).fill('Updated talks');
    await page.getByRole('button', { name: 'Rename', exact: true }).click();
    await expect(page.getByText('Folder renamed to “updated-talks”.', { exact: true })).toBeVisible();
    expect(entries.slice(0, 2).map((file) => file.objectKey)).toEqual(originalKeys);
});


test('clean browsing layout supports type filters, rename, details, Move picker and mobile folders', async ({ page }, testInfo) => {
    const folderPaths = ['photos', 'documents', 'archive', 'archive/presentations', 'documents/slides'];
    const pictures = [
        ['Cloud installation.jpg', '/images/research-portfolio/cloud-installation.jpg'],
        ['Exhibition cover.jpg', '/images/research-portfolio/cries-cover.jpg'],
        ['Study.jpg', '/images/research-portfolio/ghosts-cover.jpg'],
        ['Project invitation.jpg', '/images/research-portfolio/bsa-invitation.jpg'],
    ].map(([name, publicUrl], index) => ({ name, publicUrl, objectKey: `photos/${index}.jpg`, folderPath: 'photos', mimeType: 'image/jpeg', fileSize: 4_200_000 + index * 1000, width: 2560, height: 1706, createdAt: '2026-11-04T00:00:00Z', altText: 'An installation study' }));
    const entries = [...pictures, ...Array.from({ length: 3 }, (_, index) => ({ name: ['Research notes.pdf', 'Presentation.pdf', 'Case study.pdf'][index], publicUrl: `https://assets.example/documents/${index}.pdf`, objectKey: `documents/${index}.pdf`, folderPath: index === 2 ? 'archive/presentations' : 'documents', mimeType: 'application/pdf', fileSize: 2_100_000, width: 0, height: 0, createdAt: '2026-11-04T00:00:00Z', altText: '' }))];
    const listing = (route: any) => {
        const params = new URL(route.request().url()).searchParams;
        const path = params.get('folder') || '';
        let found = entries.filter((file) => !path || file.folderPath === path);
        if (params.get('type') === 'documents') found = found.filter((file) => file.mimeType === 'application/pdf');
        if (params.get('type') === 'images') found = found.filter((file) => file.mimeType.startsWith('image/'));
        if (params.get('q')) found = found.filter((file) => file.name.toLowerCase().includes(params.get('q')!.toLowerCase()));
        const folders = folderPaths.filter((folder) => folder.split('/').slice(0, -1).join('/') === path).map((folder) => ({ name: folder.split('/').pop(), path: folder }));
        return route.fulfill({ json: { files: found, folders, folderPath: path, totalCount: found.length, hasMore: false } });
    };
    await page.route('**/api/admin/media?*', listing);
    await page.route('**/api/admin/media/search?*', listing);
    await page.route('**/api/admin/media/folders', (route) => {
        const body = route.request().postDataJSON();
        const name = body.name.toLowerCase().replace(/\s+/g, '-');
        const path = body.parentPath ? `${body.parentPath}/${name}` : name;
        folderPaths.push(path);
        return route.fulfill({ json: { folder: { name, path } } });
    });
    await page.route('**/api/admin/media/metadata', (route) => {
        const body = route.request().postDataJSON();
        const file = entries.find((entry) => entry.objectKey === body.objectKey)!;
        if (body.name !== undefined) file.name = body.name;
        if (body.altText !== undefined) file.altText = body.altText;
        return route.fulfill({ json: { objectKey: file.objectKey, name: file.name, altText: file.altText } });
    });
    await page.route('**/api/admin/media/organize', (route) => {
        const body = route.request().postDataJSON();
        body.objectKeys.forEach((key: string) => { entries.find((entry) => entry.objectKey === key)!.folderPath = body.destinationFolder; });
        return route.fulfill({ json: { results: body.objectKeys.map((key: string) => ({ objectKey: key, newObjectKey: key, folderPath: body.destinationFolder })) } });
    });
    await expect.poll(async () => (await page.request.get('/media-library-qa')).status(), { timeout: 15000 }).toBe(200);
    await page.setViewportSize({ width: 1520, height: 1000 });
    await page.goto('/media-library-qa');
    await expect(page.getByRole('button', { name: 'New folder', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Upload', exact: true })).toBeVisible();
    await expect(page.getByText('Collections', { exact: true })).toHaveCount(0);
    await expect(page.locator('.file-entry')).toHaveCount(7);
    await expect(page.getByRole('complementary', { name: 'Selected file details' })).toHaveCount(0);
    await expect(page.locator('.file-action-toolbar')).toHaveCount(0);
    await page.getByRole('checkbox', { name: 'Select Cloud installation.jpg', exact: true }).check();
    const originalUrl = pictures[0].publicUrl;
    await expect(page.getByRole('textbox', { name: 'Public link', exact: true })).toHaveValue(originalUrl);
    await page.getByRole('textbox', { name: 'Image description', exact: true }).fill('A suspended installation in a gallery');
    await page.getByRole('button', { name: 'Save description', exact: true }).click();
    await expect(page.getByText('Image description saved.', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Dismiss message', exact: true }).click();
    await page.getByRole('complementary', { name: 'Selected file details' }).evaluate((element) => element.scrollTop = 0);
    await page.screenshot({ path: testInfo.outputPath('media-library-redesign-light.png') });
    await page.getByRole('button', { name: 'Rename file', exact: true }).click();
    await page.getByRole('textbox', { name: 'File name', exact: true }).fill('Installation final.jpg');
    await page.getByRole('button', { name: 'Rename', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.locator('.item-name').filter({ hasText: 'Installation final.jpg' })).toHaveCount(1);
    await expect(page.getByRole('textbox', { name: 'Public link', exact: true })).toHaveValue(originalUrl);
    await page.getByRole('button', { name: 'Move to folder', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Move to folder', exact: true });
    await dialog.getByRole('button', { name: 'archive', exact: true }).click();
    await dialog.getByRole('button', { name: 'presentations', exact: true }).click();
    await dialog.getByRole('button', { name: 'Move here', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByText('1 file moved to archive/presentations.', { exact: true })).toBeVisible();
    expect(pictures[0].objectKey).toBe('photos/0.jpg');
    expect(pictures[0].publicUrl).toBe(originalUrl);
    await page.getByRole('combobox', { name: 'File type', exact: true }).selectOption('documents');
    await expect(page.locator('.file-entry')).toHaveCount(3);
    await page.getByRole('searchbox', { name: 'Search files', exact: true }).fill('Case');
    await expect(page.locator('.file-entry')).toHaveCount(1);
    await expect(page.locator('.item-name')).toHaveText('Case study.pdf');
    await page.getByRole('button', { name: 'Clear search' }).click();
    await page.getByRole('combobox', { name: 'File type', exact: true }).selectOption('all');
    await page.getByRole('button', { name: 'New folder', exact: true }).click();
    await page.getByRole('textbox', { name: 'Folder name', exact: true }).fill('New presentations');
    await page.getByRole('button', { name: 'Create folder', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.locator('.folder-item').filter({ has: page.locator('.item-name').filter({ hasText: /^new-presentations$/ }) })).toBeVisible();
    const sidebar = page.getByRole('complementary', { name: 'Media folders' });
    await sidebar.getByRole('button', { name: 'Expand documents', exact: true }).click();
    await expect(sidebar.getByRole('button', { name: 'slides', exact: true })).toBeVisible();
    await page.getByRole('checkbox', { name: 'Select Installation final.jpg', exact: true }).check();
    await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
    await page.screenshot({ path: testInfo.outputPath('media-library-redesign-dark.png') });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));
    await page.getByRole('button', { name: 'Close details', exact: true }).click();
    await page.getByRole('button', { name: 'Show folders', exact: true }).click();
    await expect(sidebar).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath('media-library-redesign-mobile.png') });
});
