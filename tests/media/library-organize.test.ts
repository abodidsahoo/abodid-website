import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ authorize: vi.fn(), head: vi.fn(), copy: vi.fn(), available: vi.fn(), folders: vi.fn(), upsert: vi.fn(), update: vi.fn(), existing: vi.fn() }));
vi.mock('../../src/lib/admin/serverAuth', () => ({ authorizeAdminRequest: mocks.authorize, jsonResponse: (body: unknown, status = 200) => Response.json(body, { status }) }));
vi.mock('../../src/lib/media/r2', async (original) => ({
    ...await original<typeof import('../../src/lib/media/r2')>(),
    getR2Config: () => ({ bucket: 'assets', publicBaseUrl: 'https://assets.example.com' }),
    headR2Object: mocks.head, copyR2Object: mocks.copy, makeAvailableR2ObjectKey: mocks.available, listR2Folder: mocks.folders,
}));
vi.mock('../../src/lib/media/libraryFolders', () => ({ assertVisibleLibraryFolder: vi.fn().mockResolvedValue(undefined) }));
import { POST } from '../../src/pages/api/admin/media/organize';
import { mergeLibraryFiles } from '../../src/lib/media/libraryCatalogue';
const context = (body: unknown) => ({ request: new Request('https://example.com/api', { method: 'POST', body: JSON.stringify(body) }) }) as any;
const config = { bucket: 'assets', publicBaseUrl: 'https://assets.example.com' } as any;
const existing = { id: 'asset', object_key: 'documents/talk.pdf', folder_path: 'documents', library_folder_path: null, original_filename: 'Talk.pdf', file_size: 8, mime_type: 'application/pdf', metadata: { tags: ['manual'] }, alt_text: 'Keep me' };
beforeEach(() => {
    vi.clearAllMocks();
    mocks.existing.mockReturnValue(existing);
    mocks.upsert.mockResolvedValue({ error: null });
    mocks.head.mockResolvedValue({ object: { ContentLength: 8, ContentType: 'application/pdf' } });
    mocks.copy.mockResolvedValue(undefined);
    mocks.available.mockResolvedValue('documents/presentations/talk-copy-unique.pdf');
    mocks.folders.mockResolvedValue({ folders: ['documents/presentations'] });
    mocks.update.mockReturnValue({ eq() { return this; }, select() { return this; }, single: async () => ({ data: { object_key: 'documents/talk.pdf' }, error: null }) });
    mocks.authorize.mockResolvedValue({ ok: true, user: { id: 'admin' }, supabase: { from: () => ({
        select() { const query = { key: '', eq(column: string, value: string) { if (column === 'object_key') this.key = value; return this; }, maybeSingle: async function () { return { data: mocks.existing(this.key), error: null }; } }; return query; },
        upsert: mocks.upsert, update: mocks.update,
    }) } });
});

describe('library folder operations', () => {
    it('requires admin access before touching storage', async () => {
        mocks.authorize.mockResolvedValue({ ok: false, response: new Response(null, { status: 403 }) });
        expect((await POST(context({}))).status).toBe(403);
        expect(mocks.head).not.toHaveBeenCalled();
    });
    it.each([{ action: 'delete' }, { action: 'move', objectKeys: ['../bad'] }, { action: 'move', objectKeys: ['a/'] }, { action: 'copy', objectKeys: ['a.pdf'], destinationFolder: '../bad' }])('rejects invalid operation %j', async (body) => {
        expect((await POST(context({ destinationFolder: 'documents/presentations', objectKeys: ['a.pdf'], ...body }))).status).toBe(400);
        expect(mocks.update).not.toHaveBeenCalled();
    });
    it('moves by saving only the library location, preserving URLs and manual metadata', async () => {
        const response = await POST(context({ action: 'move', destinationFolder: 'documents/presentations', objectKeys: [existing.object_key] }));
        expect(response.status).toBe(200);
        expect(mocks.update).toHaveBeenCalledWith({ library_folder_path: 'documents/presentations' });
        expect(mocks.upsert).not.toHaveBeenCalled();
        expect(mocks.copy).not.toHaveBeenCalled();
        expect((await response.json()).results[0]).toMatchObject({ objectKey: existing.object_key, newObjectKey: existing.object_key });
    });
    it('copies actual storage bytes into a fresh key and preserves the displayed name', async () => {
        const response = await POST(context({ action: 'copy', destinationFolder: 'documents/presentations', objectKeys: [existing.object_key] }));
        expect(response.status).toBe(200);
        expect(mocks.copy).toHaveBeenCalledWith(existing.object_key, 'documents/presentations/talk-copy-unique.pdf');
        expect(mocks.upsert.mock.calls[0][0]).toMatchObject({ object_key: 'documents/presentations/talk-copy-unique.pdf', original_filename: 'Talk.pdf', alt_text: 'Keep me' });
        expect(mocks.update).not.toHaveBeenCalled();
    });
    it('registers previously uncatalogued objects without overwriting existing records', async () => {
        mocks.existing.mockReturnValue(null);
        await POST(context({ action: 'move', destinationFolder: '', objectKeys: [existing.object_key] }));
        expect(mocks.upsert.mock.calls[0][1]).toMatchObject({ ignoreDuplicates: true });
        expect(mocks.update).toHaveBeenCalledWith({ library_folder_path: '' });
    });
    it('reports a missing file without preventing the other selected file moving', async () => {
        mocks.head.mockImplementation(async (key) => { if (key === 'documents/missing.pdf') throw new Error('File missing'); return { object: { ContentLength: 8 } }; });
        const payload = await (await POST(context({ action: 'move', destinationFolder: 'documents/presentations', objectKeys: [existing.object_key, 'documents/missing.pdf'] }))).json();
        expect(payload.results).toHaveLength(2);
        expect(payload.results[1]).toMatchObject({ objectKey: 'documents/missing.pdf', error: 'File missing' });
        expect(mocks.update).toHaveBeenCalledTimes(1);
    });
    it('does not move to a folder that no longer exists', async () => {
        mocks.folders.mockResolvedValue({ folders: [] });
        expect((await POST(context({ action: 'move', destinationFolder: 'documents/presentations', objectKeys: [existing.object_key] }))).status).toBe(404);
        expect(mocks.head).not.toHaveBeenCalled();
    });
});

describe('library listings and search after moving', () => {
    const physical = [{ objectKey: existing.object_key, fileSize: 8 }];
    const moved = { ...existing, library_folder_path: 'documents/presentations' };
    it('removes moved files from the source view without changing their public URL', () => {
        expect(mergeLibraryFiles(physical, [moved], 'documents', config).files).toEqual([]);
        const [file] = mergeLibraryFiles([], [moved], 'documents/presentations', config).files;
        expect(file.objectKey).toBe(existing.object_key);
        expect(file.publicUrl).toBe('https://assets.example.com/documents/talk.pdf');
    });
    it('finds moved files in their destination and counts them under the right folder', () => {
        const result = mergeLibraryFiles([], [moved], 'documents', config, 'talk');
        expect(result.files).toHaveLength(1);
        expect(result.folderMatches).toEqual([{ path: 'documents/presentations', count: 1 }]);
    });
    it('hides moved-away search hits and supports moving back to the root', () => {
        expect(mergeLibraryFiles(physical, [moved], 'documents/other', config, 'talk').files).toHaveLength(0);
        expect(mergeLibraryFiles([], [{ ...moved, library_folder_path: '' }], '', config).files).toHaveLength(1);
    });
    it('does not match the old storage folder when searching after a move', () => {
        const source = { ...existing, object_key: 'drafts/talk.pdf', folder_path: 'drafts', library_folder_path: 'documents/presentations' };
        expect(mergeLibraryFiles([{ objectKey: source.object_key }], [source], '', config, 'drafts').files).toHaveLength(0);
    });
});
