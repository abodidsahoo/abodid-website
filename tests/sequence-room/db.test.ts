import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { getSession } = vi.hoisted(() => ({
    getSession: vi.fn(async () => ({
        data: { session: { access_token: 'test-access-token' } },
        error: null,
    })),
}));

vi.mock('../../src/lib/supabaseClient', () => ({
    supabase: { auth: { getSession } },
}));

import { uploadWorkingPhoto } from '../../src/lib/sequence-room/db';

describe('uploadWorkingPhoto', () => {
    beforeEach(() => {
        vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
            item: {
                id: 'item-1',
                assetId: 'asset-1',
                image: '',
                x: 0,
                y: 0,
                rotation: 0,
                scale: 1,
                zIndex: 1,
            },
        }), { status: 200, headers: { 'Content-Type': 'application/json' } })));
        vi.stubGlobal('URL', {
            ...URL,
            createObjectURL: vi.fn(() => 'blob:working-copy'),
        });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.clearAllMocks();
    });

    it('uses the local working copy after upload instead of refetching the photo', async () => {
        const workingCopy = new Blob(['photo'], { type: 'image/jpeg' });

        const item = await uploadWorkingPhoto('board-1', workingCopy, {
            filename: 'photo.jpg',
            width: 1200,
            height: 800,
            x: 10,
            y: 20,
            rotation: 2,
            zIndex: 3,
        });

        expect(fetch).toHaveBeenCalledTimes(1);
        expect(fetch).toHaveBeenCalledWith('/api/sequence-room/upload', expect.objectContaining({ method: 'POST' }));
        expect(URL.createObjectURL).toHaveBeenCalledWith(workingCopy);
        expect(item).toMatchObject({ image: 'blob:working-copy', libraryAsset: false });
    });
});
