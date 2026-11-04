import { afterEach, describe, expect, it, vi } from 'vitest';
import { unzipSync, strFromU8 } from 'fflate';
import { archiveEntryNames, createLibraryArchive, uploadLibraryFile } from '../../src/lib/media/libraryTransfers';
import { maxUploadBytes, normalizeUploadContentType } from '../../src/lib/media/uploadPolicy';

afterEach(() => vi.unstubAllGlobals());

describe('media library transfers', () => {
    it.each(['application/pdf', 'application/zip', 'application/vnd.adobe.photoshop', 'font/woff2', 'text/csv', 'model/gltf-binary', 'image/heic'])(
        'accepts %s without a format allowlist', (type) => expect(normalizeUploadContentType(type)).toBe(type),
    );
    it('uses a binary MIME type for unknown or malformed browser types', () => {
        expect(normalizeUploadContentType('')).toBe('application/octet-stream');
        expect(normalizeUploadContentType('bad\r\nheader')).toBe('application/octet-stream');
    });
    it('keeps image limits and permits large documents, audio and source files', () => {
        expect(maxUploadBytes('image/png')).toBe(20 * 1024 * 1024);
        for (const type of ['application/pdf', 'application/octet-stream', 'audio/wav']) expect(maxUploadBytes(type)).toBe(100 * 1024 * 1024);
    });
    it('sends a PDF larger than 4.5 MB directly to R2, then catalogues metadata only', async () => {
        const file = new File([new Uint8Array(6 * 1024 * 1024)], 'Workshop.pdf', { type: 'application/pdf' });
        const authorizedFetch = vi.fn()
            .mockResolvedValueOnce(Response.json({ uploadUrl: 'https://r2.example/signed', objectKey: 'documents/workshop.pdf', requiredHeaders: { 'Content-Type': 'application/pdf' } }))
            .mockResolvedValueOnce(Response.json({ asset: { id: 'file-1' } }));
        const directFetch = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
        vi.stubGlobal('fetch', directFetch);
        await uploadLibraryFile(file, 'documents', { width: null, height: null }, authorizedFetch);
        expect(directFetch).toHaveBeenCalledWith('https://r2.example/signed', { method: 'PUT', headers: { 'Content-Type': 'application/pdf' }, body: file });
        expect(authorizedFetch.mock.calls.map(([url]) => url)).toEqual(['/api/admin/media/presign', '/api/admin/media/complete']);
        expect(JSON.parse(authorizedFetch.mock.calls[1][1].body)).toMatchObject({ expectedSize: file.size, objectKey: 'documents/workshop.pdf' });
        expect(authorizedFetch.mock.calls.every(([, options]) => options.body.length < 1024)).toBe(true);
    });
    it('does not catalogue an upload rejected by R2', async () => {
        const authorizedFetch = vi.fn().mockResolvedValue(Response.json({ uploadUrl: 'https://r2.example/signed' }));
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 403 })));
        await expect(uploadLibraryFile(new File(['a'], 'a.bin'), '', {}, authorizedFetch)).rejects.toThrow('403');
        expect(authorizedFetch).toHaveBeenCalledTimes(1);
    });
    it('preserves mixed binary files and disambiguates duplicate names in the downloaded ZIP', async () => {
        const contents = [new Uint8Array([0, 1, 254, 255]), new TextEncoder().encode('PDF contents'), new TextEncoder().encode('Notes')];
        const files = [{ name: 'Book.pdf' }, { name: 'book.pdf' }, { name: '../Notes.txt' }].map((file, index) => ({ ...file, downloadUrl: `https://r2.example/${index}` }));
        vi.stubGlobal('fetch', vi.fn(async (url) => new Response(contents[Number(url.split('/').pop())])));
        const progress = vi.fn();
        const blob = await createLibraryArchive(files, progress);
        const unzipped = unzipSync(new Uint8Array(await blob.arrayBuffer()));
        expect(Object.keys(unzipped)).toEqual(['Book.pdf', 'book (2).pdf', 'Notes.txt']);
        expect(unzipped['Book.pdf']).toEqual(contents[0]);
        expect(strFromU8(unzipped['book (2).pdf'])).toBe('PDF contents');
        expect(progress).toHaveBeenCalledTimes(3);
    });
    it('reports failed downloads instead of saving an incomplete ZIP', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 404 })));
        await expect(createLibraryArchive([{ name: 'missing.pdf', downloadUrl: 'https://r2.example/missing' }])).rejects.toThrow('missing.pdf (404)');
    });
    it('removes unsafe archive paths and handles already numbered names', () => {
        expect(archiveEntryNames([{ name: '..' }, { name: '/x/file.txt' }, { name: 'file (2).txt' }, { name: 'file.txt' }])).toEqual(['file', 'file.txt', 'file (2).txt', 'file (3).txt']);
    });
});
