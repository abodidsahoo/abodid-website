import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { filterLibraryFiles, mediaType } from '../../src/lib/media/libraryView';
import { mergeLibraryFiles } from '../../src/lib/media/libraryCatalogue';
const mocks = vi.hoisted(() => ({ list: vi.fn() }));
vi.mock('../../src/lib/media/r2', async (original) => ({ ...await original<typeof import('../../src/lib/media/r2')>(), getR2Config: () => ({ endpoint: 'https://r2.example', bucket: 'assets', publicBaseUrl: 'https://assets.example.com' }), listAllR2Files: mocks.list }));
import { invalidateLibraryIndex, readAllLibraryFiles } from '../../src/lib/media/libraryIndex';
const config = { publicBaseUrl: 'https://assets.example.com' } as any;
const file = (name: string, size = 1, type = 'application/pdf') => ({ objectKey: `documents/${name}`, name, mimeType: type, fileSize: size, createdAt: '2026-11-04T00:00:00Z' });

describe('library type and sort controls', () => {
    it.each([['application/pdf', 'a.pdf', 'documents'], ['text/plain', 'a.txt', 'documents'], ['', 'slides.pptx', 'documents'], ['image/jpeg', 'a.jpg', 'images'], ['audio/wav', 'a.wav', 'audio'], ['video/mp4', 'a.mp4', 'videos'], ['', 'a.blend', 'other']])('classifies %s %s as %s', (mimeType, name, type) => expect(mediaType(file(name, 1, mimeType))).toBe(type));
    it('combines file type, search and size sorting', () => {
        const rows = [file('second.pdf', 8), file('first.pdf', 2), file('image.jpg', 3, 'image/jpeg')];
        expect(filterLibraryFiles(rows, { type: 'documents', sort: 'size-desc', query: '.pdf' }).map((row) => row.name)).toEqual(['second.pdf', 'first.pdf']);
    });
    it('keeps document classification when its display name loses the extension', () => expect(mediaType({ objectKey: 'documents/slides.pptx', name: 'Final slides', mimeType: 'application/octet-stream' })).toBe('documents'));
    it('uses stable key ordering for identical timestamps during pagination', () => {
        expect(filterLibraryFiles([file('b.pdf'), file('a.pdf')]).map((row) => row.name)).toEqual(['a.pdf', 'b.pdf']);
    });
    it('shows the renamed filename without changing the public key or URL', () => {
        const [row] = mergeLibraryFiles([{ objectKey: 'documents/original.pdf', fileSize: 1 }], [{ object_key: 'documents/original.pdf', folder_path: 'documents', original_filename: 'Original.pdf', library_filename: 'Final.pdf' }], '', config, '', { recursive: true }).files;
        expect(row.name).toBe('Final.pdf');
        expect(row.publicUrl).toBe('https://assets.example.com/documents/original.pdf');
    });
});

const database = (assets: any[], hidden: any[] = []) => ({ from(table: string) { return { select() { return this; }, eq() { return this; }, order() { return this; }, async range(from: number, to: number) { return { data: (table === 'media_assets' ? assets : hidden).slice(from, to + 1), error: null }; } }; } }) as any;
beforeEach(() => { vi.clearAllMocks(); invalidateLibraryIndex(); });
afterEach(() => vi.unstubAllEnvs());
describe('All files browsing', () => {
    it('reuses the merged catalogue across concurrent filters and pages, and refreshes metadata independently', async () => {
        mocks.list.mockResolvedValue({ files: [{ objectKey: 'documents/a.pdf', fileSize: 1 }], roots: ['documents'], truncated: false });
        const db = database([]);
        const from = vi.spyOn(db, 'from');
        await Promise.all([readAllLibraryFiles(db, new URLSearchParams()), readAllLibraryFiles(db, new URLSearchParams({ type: 'documents' })), readAllLibraryFiles(db, new URLSearchParams({ page: '1' }))]);
        expect(from).toHaveBeenCalledTimes(2); // One catalogue query, one folder-visibility query.
        expect(mocks.list).toHaveBeenCalledTimes(1);
        invalidateLibraryIndex(false);
        await readAllLibraryFiles(db, new URLSearchParams());
        expect(from).toHaveBeenCalledTimes(4);
        expect(mocks.list).toHaveBeenCalledTimes(1);
        await readAllLibraryFiles(db, new URLSearchParams({ refresh: '1' }));
        expect(mocks.list).toHaveBeenCalledTimes(2);
    });
    it('includes original files across folders, uncatalogued files, and logical moves', async () => {
        const physical = [{ objectKey: 'documents/talk.pdf', fileSize: 8 }, { objectKey: 'photos/a.jpg', fileSize: 3 }, { objectKey: 'legacy/notes.txt', fileSize: 1 }];
        mocks.list.mockResolvedValue({ files: physical, roots: ['documents', 'photos', 'legacy'], truncated: false });
        const assets = [{ object_key: physical[0].objectKey, folder_path: 'documents', library_folder_path: 'presentations', original_filename: 'Talk.pdf' }];
        const result = await readAllLibraryFiles(database(assets), new URLSearchParams({ refresh: '1' }));
        expect(result.files).toHaveLength(3);
        expect(result.files.find((row) => row.name === 'Talk.pdf')?.folderPath).toBe('presentations');
        expect(result.files.find((row) => row.name === 'notes.txt')?.catalogued).toBe(false);
    });
    it('paginates filtered results without missing assets in other folders', async () => {
        mocks.list.mockResolvedValue({ files: Array.from({ length: 125 }, (_, index) => ({ objectKey: `documents/${index}.pdf`, fileSize: index })), roots: ['documents'], truncated: false });
        const first = await readAllLibraryFiles(database([]), new URLSearchParams({ type: 'documents', sort: 'size-asc', refresh: '1' }));
        const second = await readAllLibraryFiles(database([]), new URLSearchParams({ type: 'documents', sort: 'size-asc', page: '1' }));
        expect(first.totalCount).toBe(125); expect(first.files).toHaveLength(120); expect(first.hasMore).toBe(true);
        expect(second.files).toHaveLength(5); expect(second.hasMore).toBe(false);
        expect(new Set([...first.files, ...second.files].map((row) => row.objectKey)).size).toBe(125);
        expect(mocks.list).toHaveBeenCalledTimes(1);
    });
    it('hides completed source folders while retaining relocated files', async () => {
        mocks.list.mockResolvedValue({ files: [{ objectKey: 'drafts/a.pdf', fileSize: 1 }], roots: ['drafts', 'archive'], truncated: false });
        const result = await readAllLibraryFiles(database([{ object_key: 'drafts/a.pdf', folder_path: 'drafts', library_folder_path: 'archive', original_filename: 'A.pdf' }], [{ folder_path: 'drafts' }]), new URLSearchParams({ refresh: '1' }));
        expect(result.folders.map((row) => row.path)).toEqual(['archive']);
        expect(result.files).toHaveLength(1); expect(result.files[0].folderPath).toBe('archive');
    });
});
