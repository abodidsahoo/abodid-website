import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ authorize: vi.fn(), head: vi.fn(), stream: vi.fn(), key: vi.fn(), sign: vi.fn(), single: vi.fn() }));
vi.mock('../../src/lib/admin/serverAuth', () => ({
    authorizeAdminRequest: mocks.authorize,
    jsonResponse: (body: unknown, status = 200) => Response.json(body, { status }),
}));
vi.mock('../../src/lib/media/r2', async (importOriginal) => ({
    ...await importOriginal<typeof import('../../src/lib/media/r2')>(),
    makeAvailableR2ObjectKey: mocks.key,
    createPresignedR2Upload: mocks.sign,
    headR2Object: mocks.head,
    streamR2Object: mocks.stream,
}));
vi.mock('../../src/lib/media/variantProcessor', () => ({ shouldUseVercelVariantProcessor: () => false }));
import { POST as presign } from '../../src/pages/api/admin/media/presign';
import { POST as complete } from '../../src/pages/api/admin/media/complete';
import { POST as download } from '../../src/pages/api/admin/media/download';

const context = (body: unknown) => ({ request: new Request('http://localhost/api', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }) }) as any;
const catalogue = { upsert: vi.fn(), select: vi.fn(), single: mocks.single };
beforeEach(() => {
    vi.clearAllMocks();
    catalogue.upsert.mockReturnValue(catalogue);
    catalogue.select.mockReturnValue(catalogue);
    mocks.authorize.mockResolvedValue({ ok: true, user: { id: 'admin' }, supabase: { from: () => catalogue } });
    mocks.key.mockResolvedValue('documents/example.bin');
    mocks.sign.mockResolvedValue({ uploadUrl: 'https://r2.example/signed' });
});

describe('media upload APIs', () => {
    it.each(['application/pdf', 'application/zip', 'application/vnd.adobe.photoshop', '', 'model/gltf-binary'])(
        'prepares direct uploads for %s', async (type) => {
            const response = await presign(context({ filename: 'Example.bin', size: 8 * 1024 * 1024, contentType: type, folder: 'documents' }));
            expect(response.status).toBe(200);
            expect((await response.json()).contentType).toBe(type || 'application/octet-stream');
        },
    );
    it.each([0, -1, 100 * 1024 * 1024 + 1])('rejects invalid upload size %s', async (size) => {
        expect((await presign(context({ filename: 'a.pdf', size, contentType: 'application/pdf' }))).status).toBe(400);
        expect(mocks.sign).not.toHaveBeenCalled();
    });
    it('catalogues unknown binary types using the actual R2 metadata', async () => {
        mocks.head.mockResolvedValue({ config: { publicBaseUrl: 'https://assets.example.com', bucket: 'assets' }, object: { ContentType: 'application/x-custom', ContentLength: 25 * 1024 * 1024, ETag: '"etag"' } });
        mocks.single.mockResolvedValue({ data: { id: 'asset', mime_type: 'application/x-custom', media_variants: [] }, error: null });
        const response = await complete(context({ objectKey: 'documents/a.custom', originalFilename: 'a.custom', expectedSize: 25 * 1024 * 1024 }));
        expect(response.status).toBe(200);
        expect(catalogue.upsert.mock.calls[0][0]).toMatchObject({ mime_type: 'application/x-custom', file_size: 25 * 1024 * 1024 });
    });
    it('rejects a completed upload whose actual byte count differs', async () => {
        mocks.head.mockResolvedValue({ object: { ContentType: 'application/pdf', ContentLength: 8 } });
        expect((await complete(context({ objectKey: 'documents/a.pdf', originalFilename: 'a.pdf', expectedSize: 9 }))).status).toBe(409);
        expect(catalogue.upsert).not.toHaveBeenCalled();
    });
});

describe('authenticated streaming downloads', () => {
    it.each([presign, complete, download])('requires admin authorization before storage access', async (route) => {
        mocks.authorize.mockResolvedValue({ ok: false, response: Response.json({ error: 'Unauthorized' }, { status: 401 }) });
        expect((await route(context({}))).status).toBe(401);
        expect(mocks.stream).not.toHaveBeenCalled();
        expect(mocks.head).not.toHaveBeenCalled();
        expect(mocks.sign).not.toHaveBeenCalled();
    });
    it.each(['../secret', '/documents/a.pdf', 'documents/', null])('rejects invalid file key %s', async (objectKey) => {
        expect((await download(context({ objectKey }))).status).toBe(400);
        expect(mocks.stream).not.toHaveBeenCalled();
    });
    it('streams more than 4.5 MB without buffering it in the route', async () => {
        const bytes = new Uint8Array(6 * 1024 * 1024).fill(42);
        const stream = new ReadableStream({ start(controller) { controller.enqueue(bytes); controller.close(); } });
        mocks.stream.mockResolvedValue(stream);
        const response = await download(context({ objectKey: 'documents/large.pdf' }));
        expect(response.status).toBe(200);
        expect(response.body).toBe(stream);
        expect(response.headers.get('Cache-Control')).toBe('no-store');
        expect(Buffer.from(await response.arrayBuffer()).equals(Buffer.from(bytes))).toBe(true);
    });
});
