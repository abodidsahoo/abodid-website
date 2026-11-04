import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ authorize: vi.fn(), visible: vi.fn(), read: vi.fn(), collect: vi.fn(), raw: vi.fn(), create: vi.fn(), hide: vi.fn() }));
vi.mock('../../src/lib/admin/serverAuth', () => ({ authorizeAdminRequest: mocks.authorize, jsonResponse: (data: unknown, status = 200) => Response.json(data, { status }) }));
vi.mock('../../src/lib/media/r2', async (original) => ({ ...await original<typeof import('../../src/lib/media/r2')>(), getR2Config: () => ({ bucket: 'assets' }), createR2Folder: mocks.create, listR2Folder: mocks.raw }));
vi.mock('../../src/lib/media/libraryFolders', async (original) => ({ ...await original<typeof import('../../src/lib/media/libraryFolders')>(), assertVisibleLibraryFolder: mocks.visible, readLibraryFolder: mocks.read, collectLibraryTree: mocks.collect }));
import { POST } from '../../src/pages/api/admin/media/folder-organize';
import { allocateFolderDestination, folderAncestors, validateFolderTransfer } from '../../src/lib/media/libraryFolders';
const context = (body: unknown) => ({ request: new Request('https://example.com/api', { method: 'POST', body: JSON.stringify(body) }) }) as any;
const source = 'documents/presentations';
const base = { phase: 'plan', action: 'copy', sourceFolder: source, destinationFolder: 'archive' };

beforeEach(() => {
    vi.clearAllMocks();
    mocks.authorize.mockResolvedValue({ ok: true, user: { id: 'admin' }, supabase: { from: () => ({ upsert: mocks.hide }) } });
    mocks.visible.mockResolvedValue(undefined);
    mocks.read.mockImplementation(async (_supabase, folder) => ({ folders: folder === 'documents' ? [{ path: source }] : folder === '' ? [{ path: 'archive' }, { path: 'documents' }] : [] }));
    mocks.raw.mockResolvedValue({ folders: [], truncated: false });
    mocks.collect.mockResolvedValue({ groups: [{ folder: source, files: [{ objectKey: 'documents/talk.pdf', name: 'Talk.pdf' }] }, { folder: `${source}/empty`, files: [] }], fileCount: 1 });
    mocks.create.mockResolvedValue({});
    mocks.hide.mockResolvedValue({ error: null });
});

describe('folder hierarchy rules', () => {
    it('finds every ancestor for moved-folder visibility checks', () => expect(folderAncestors('documents/2026/talks')).toEqual(['documents', 'documents/2026', 'documents/2026/talks']));
    it.each([['', 'archive'], [source, source], [source, `${source}/child`], ['../documents', 'archive']])('rejects unsafe folder transfer %s to %s', (from, to) => expect(() => validateFolderTransfer(from, to)).toThrow());
    it('allows copying a folder into a different branch or library root', () => {
        expect(validateFolderTransfer(source, '')).toEqual({ source, destination: '' });
        expect(validateFolderTransfer(source, 'archive')).toEqual({ source, destination: 'archive' });
    });
    it('numbers collisions without overwriting existing folders', () => expect(allocateFolderDestination(source, 'archive', ['archive/presentations', 'archive/presentations-2'])).toBe('archive/presentations-3'));
    it('keeps long collision names within the folder segment limit', () => {
        const name = 'a'.repeat(100);
        const path = allocateFolderDestination(`documents/${name}`, 'archive', [`archive/${name}`]);
        expect(path).toBe(`archive/${'a'.repeat(98)}-2`);
    });
    it('rejects destination trees beyond the supported depth', () => expect(() => allocateFolderDestination(source, 'a/b/c/d/e/f/g/h', [])).toThrow());
});

describe('recursive folder operation API', () => {
    it('requires admin authorization', async () => {
        mocks.authorize.mockResolvedValue({ ok: false, response: new Response(null, { status: 403 }) });
        expect((await POST(context(base))).status).toBe(403);
        expect(mocks.create).not.toHaveBeenCalled();
    });
    it('rejects copying into a descendant before creating anything', async () => {
        expect((await POST(context({ ...base, destinationFolder: `${source}/child` }))).status).toBe(400);
        expect(mocks.collect).not.toHaveBeenCalled();
    });
    it('plans nested file batches and preserves empty subfolders', async () => {
        const response = await POST(context(base));
        expect(response.status).toBe(200);
        const result = await response.json();
        expect(result.groups.map((group: any) => group.destinationFolder)).toEqual(['archive/presentations', 'archive/presentations/empty']);
        expect(result.groups[0].files[0].objectKey).toBe('documents/talk.pdf');
        expect(mocks.create.mock.calls.map(([path]) => path)).toEqual(['archive/presentations', 'archive/presentations/empty']);
        expect(mocks.hide).not.toHaveBeenCalled();
    });
    it('handles moving to the same parent without duplicating the folder', async () => {
        const response = await POST(context({ ...base, action: 'move', destinationFolder: 'documents' }));
        expect((await response.json()).unchanged).toBe(true);
        expect(mocks.create).not.toHaveBeenCalled();
    });
    it('keeps the source visible when any files remain after a partial move', async () => {
        mocks.read.mockImplementation(async (_supabase, folder) => ({ folders: folder === 'documents' ? [{ path: source }] : [{ path: 'archive/presentations' }] }));
        const response = await POST(context({ ...base, phase: 'finish', action: 'move', destinationFolder: 'archive/presentations' }));
        expect(response.status).toBe(409);
        expect(mocks.hide).not.toHaveBeenCalled();
    });
    it('hides only a completed empty source tree, leaving the R2 keys intact', async () => {
        mocks.read.mockImplementation(async (_supabase, folder) => ({ folders: folder === 'documents' ? [{ path: source }] : [{ path: 'archive/presentations' }] }));
        mocks.collect.mockResolvedValue({ groups: [{ folder: source, files: [] }, { folder: `${source}/empty`, files: [] }], fileCount: 0 });
        const response = await POST(context({ ...base, phase: 'finish', action: 'move', destinationFolder: 'archive/presentations' }));
        expect(response.status).toBe(200);
        expect(mocks.hide.mock.calls[0][0].map((row: any) => row.folder_path)).toEqual([source, `${source}/empty`]);
        expect(mocks.create).not.toHaveBeenCalled();
    });
    it('plans a folder rename in the same parent without changing file keys', async () => {
        const result = await (await POST(context({ ...base, action: 'move', destinationFolder: 'documents', destinationName: 'Final slides' }))).json();
        expect(result.destinationFolder).toBe('documents/final-slides');
        expect(result.groups[0].files[0].objectKey).toBe('documents/talk.pdf');
    });
    it('rejects a folder rename that would collide with an existing folder', async () => {
        mocks.raw.mockResolvedValue({ folders: ['documents/final-slides'], truncated: false });
        expect((await POST(context({ ...base, action: 'move', destinationFolder: 'documents', destinationName: 'Final slides' }))).status).toBe(409);
        expect(mocks.create).not.toHaveBeenCalled();
    });
    it('refuses incomplete listings instead of silently copying part of a tree', async () => {
        mocks.collect.mockRejectedValue(new Error('This folder has too many items'));
        const response = await POST(context(base));
        expect(response.status).toBe(500);
        expect(mocks.create).not.toHaveBeenCalled();
    });
});
