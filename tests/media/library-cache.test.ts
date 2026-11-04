import { afterEach, describe, expect, it, vi } from 'vitest';
import { createLibraryCache } from '../../src/lib/media/libraryCache';
import { scanLibraryOriginals } from '../../src/lib/media/libraryScan';

afterEach(() => vi.useRealTimers());

describe('private listing memory cache', () => {
    it('coalesces slow requests and starts expiry when they complete', async () => {
        vi.useFakeTimers();
        const cache = createLibraryCache<number>(100);
        let finish!: (value: number) => void;
        const loader = vi.fn(() => new Promise<number>((resolve) => { finish = resolve; }));
        const first = cache.read('folder', loader);
        await Promise.resolve();
        vi.advanceTimersByTime(1000);
        expect(cache.read('folder', loader)).toBe(first);
        finish(1);
        await first;
        vi.advanceTimersByTime(99);
        expect(await cache.read('folder', loader)).toBe(1);
        expect(loader).toHaveBeenCalledTimes(1);
        vi.advanceTimersByTime(2);
        expect(cache.peek('folder')?.fresh).toBe(false);
        expect(await cache.read('folder', async () => 2)).toBe(2);
    });
    it('keeps stale values available while refreshing without duplicating the refresh', async () => {
        vi.useFakeTimers();
        const cache = createLibraryCache<number>(100);
        await cache.read('folder', async () => 1);
        vi.advanceTimersByTime(101);
        const loader = vi.fn(async () => 2);
        const next = cache.read('folder', loader);
        expect(cache.peek('folder')?.value).toBe(1);
        expect(cache.read('folder', loader)).toBe(next);
        expect(await next).toBe(2);
    });
    it('cannot restore an old listing after a mutation invalidates an in-flight request', async () => {
        const cache = createLibraryCache<number>(100);
        let finish!: (value: number) => void;
        const old = cache.read('folder', () => new Promise<number>((resolve) => { finish = resolve; }));
        await Promise.resolve();
        cache.clear();
        await cache.read('folder', async () => 2);
        finish(1);
        await old;
        expect(cache.peek('folder')?.value).toBe(2);
    });
    it('retries failures and bounds retained listings independently for each session', async () => {
        const cache = createLibraryCache<number>(100, 2);
        await expect(cache.read('a', async () => { throw new Error('offline'); })).rejects.toThrow('offline');
        expect(await cache.read('a', async () => 1)).toBe(1);
        await cache.read('b', async () => 2);
        await cache.read('c', async () => 3);
        expect(cache.peek('a')).toBeUndefined();
        expect(createLibraryCache<number>(100).peek('b')).toBeUndefined();
    });
});

describe('bounded original-file storage scan', () => {
    it('keeps legacy files, empty folders and paginated originals while skipping entire variant trees', async () => {
        const list = vi.fn(async ({ Prefix, ContinuationToken }: any) => {
            if (!Prefix) return { CommonPrefixes: [{ Prefix: 'documents/' }, { Prefix: 'photos/' }, { Prefix: 'variants/' }, { Prefix: 'empty/' }], Contents: [{ Key: 'root.pdf', Size: 1 }] };
            if (Prefix === 'photos/') return { CommonPrefixes: [{ Prefix: 'photos/originals/' }, { Prefix: 'photos/variants/' }], Contents: [{ Key: 'photos/legacy.jpg', Size: 2 }] };
            if (Prefix === 'documents/') return ContinuationToken ? { Contents: [{ Key: 'documents/b.pdf' }] } : { Contents: [{ Key: 'documents/a.pdf' }], IsTruncated: true, NextContinuationToken: 'page-2' };
            if (Prefix === 'photos/originals/') return { Contents: [{ Key: 'photos/originals/a.jpg', ETag: '"abc"' }, { Key: 'photos/originals/' }] };
            return {};
        });
        const result = await scanLibraryOriginals(list, 25_000);
        expect(result.files.map((file) => file.objectKey)).toEqual(['documents/a.pdf', 'documents/b.pdf', 'photos/legacy.jpg', 'photos/originals/a.jpg', 'root.pdf']);
        expect(result.roots).toEqual(['documents', 'empty', 'photos', 'variants']);
        expect(result.truncated).toBe(false);
        expect(result.files[3].etag).toBe('abc');
        expect(list.mock.calls.some(([input]) => /variants/.test(input.Prefix))).toBe(false);
        expect(list.mock.calls.find(([input]) => input.Prefix === 'photos/')?.[0].Delimiter).toBe('/');
    });
    it('caps concurrency and marks incomplete scans instead of silently dropping files', async () => {
        let active = 0;
        let maximum = 0;
        const list = async ({ Prefix }: any) => {
            if (!Prefix) return { CommonPrefixes: Array.from({ length: 10 }, (_, i) => ({ Prefix: `folder-${i}/` })) };
            maximum = Math.max(maximum, ++active);
            await new Promise((resolve) => setTimeout(resolve, 1));
            active -= 1;
            return { Contents: [{ Key: `${Prefix}a.pdf` }] };
        };
        const result = await scanLibraryOriginals(list, 5);
        expect(maximum).toBe(4);
        expect(result.files).toHaveLength(5);
        expect(result.truncated).toBe(true);
    });
    it('rejects storage failures so a partial listing is never cached as complete', async () => {
        await expect(scanLibraryOriginals(async () => { throw new Error('storage offline'); }, 25_000)).rejects.toThrow('storage offline');
    });
});
