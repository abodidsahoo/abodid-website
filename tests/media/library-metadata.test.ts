import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ auth: vi.fn(), head: vi.fn(), upsert: vi.fn(), update: vi.fn() }));
vi.mock('../../src/lib/admin/serverAuth', () => ({ authorizeAdminRequest: mocks.auth, jsonResponse: (body: unknown, status = 200) => Response.json(body, { status }) }));
vi.mock('../../src/lib/media/r2', async (original) => ({ ...await original<typeof import('../../src/lib/media/r2')>(), getR2Config: () => ({ bucket: 'assets', publicBaseUrl: 'https://assets.example.com' }), headR2Object: mocks.head }));
import { POST } from '../../src/pages/api/admin/media/metadata';
const context = (body: unknown) => ({ request: new Request('https://example.com/api', { method: 'POST', body: JSON.stringify(body) }) }) as any;
beforeEach(() => {
    vi.clearAllMocks();
    mocks.upsert.mockResolvedValue({ error: null });
    mocks.head.mockResolvedValue({ object: { ContentLength: 8, ContentType: 'image/jpeg' } });
    mocks.update.mockReturnValue({ eq() { return this; }, select() { return this; }, single: async () => ({ data: { object_key: 'photos/a.jpg', original_filename: 'a.jpg', library_filename: 'Final.jpg', alt_text: 'A photo' }, error: null }) });
    mocks.auth.mockResolvedValue({ ok: true, user: { id: 'admin' }, supabase: { from: () => ({ upsert: mocks.upsert, update: mocks.update }) } });
});
describe('file details and rename', () => {
    it('requires an admin before reading storage or changing metadata', async () => {
        mocks.auth.mockResolvedValue({ ok: false, response: new Response(null, { status: 403 }) });
        expect((await POST(context({}))).status).toBe(403); expect(mocks.head).not.toHaveBeenCalled();
    });
    it.each(['', '../a.jpg', 'folder/a.jpg', '\u0000name', '..'])('rejects invalid display name %j', async (name) => {
        expect((await POST(context({ objectKey: 'photos/a.jpg', name }))).status).toBe(400);
        expect(mocks.update).not.toHaveBeenCalled();
    });
    it('renames only the display name and leaves URLs, keys, tags and captions untouched', async () => {
        const response = await POST(context({ objectKey: 'photos/a.jpg', name: 'Final.jpg' }));
        expect(response.status).toBe(200); expect(mocks.update).toHaveBeenCalledWith({ library_filename: 'Final.jpg' });
        expect(mocks.upsert.mock.calls[0][1]).toMatchObject({ ignoreDuplicates: true });
    });
    it('saves an image description without overwriting the filename or other metadata', async () => {
        expect((await POST(context({ objectKey: 'photos/a.jpg', altText: 'A photo' }))).status).toBe(200);
        expect(mocks.update).toHaveBeenCalledWith({ alt_text: 'A photo' });
    });
    it('does not offer an image description for a non-image file', async () => {
        mocks.head.mockResolvedValue({ object: { ContentLength: 8, ContentType: 'application/pdf' } });
        expect((await POST(context({ objectKey: 'documents/a.pdf', altText: 'A photo' }))).status).toBe(400);
        expect(mocks.update).not.toHaveBeenCalled();
    });
});
