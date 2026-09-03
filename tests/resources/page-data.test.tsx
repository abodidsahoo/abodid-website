import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { load } from 'cheerio';

const db = vi.hoisted(() => ({ from: vi.fn(), getSession: vi.fn() }));
vi.mock('../../src/lib/supabaseClient', () => ({ supabase: { from: db.from, auth: { getSession: db.getSession } } }));
import { clearResourcePageData, getCachedDashboard, getResourceViewer, invalidateResourcePageData, loadDashboardData, loadResourceDetail, retryResourceRead, RESOURCE_DATA_CHANGED } from '../../src/lib/resources/pageData';
import UnifiedDashboard from '../../src/components/resources/UnifiedDashboard';
import CuratorDashboard from '../../src/components/resources/CuratorDashboard';
import ResourceDetailView from '../../src/components/resources/ResourceDetailView';

const user = { id: 'curator-a', email: 'a@example.com', user_metadata: {} } as any;
const row = (id: string, status = 'pending') => ({
    id, status, title: `Resource ${id}`, url: `https://example.com/${id}`,
    created_at: `2026-09-0${id}`, submitted_by: user.id, thumbnail_url: null,
    tags: [{ tag: { id: 'tag-1', name: 'Design' } }],
});
function query(result: any) {
    const chain: any = {};
    for (const method of ['select', 'eq', 'order', 'single', 'maybeSingle']) chain[method] = vi.fn(() => chain);
    chain.abortSignal = vi.fn(() => Promise.resolve(result));
    return chain;
}

beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('window', new EventTarget());
    clearResourcePageData();
    db.from.mockReset();
    db.getSession.mockReset().mockResolvedValue({ data: { session: { user } }, error: null });
});
afterEach(() => { clearResourcePageData(); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('resource navigation data', () => {
    it('fetches once, derives each queue, and reuses the result on return navigation', async () => {
        db.from.mockReturnValue(query({ data: [row('3', 'approved'), row('2'), row('1'), row('4', 'deleted')], error: null }));
        const [first, duplicate] = await Promise.all([loadDashboardData(user.id, 'admin'), loadDashboardData(user.id, 'admin')]);
        expect(db.from).toHaveBeenCalledTimes(1);
        expect(first).toBe(duplicate);
        expect(first.pending.map(r => r.id)).toEqual(['1', '2']);
        expect(first.resources.map(r => r.id)).toEqual(['3', '2', '1']);
        expect(first.deleted.map(r => r.id)).toEqual(['4']);
        expect(first.pending[0].tags).toEqual([{ id: 'tag-1', name: 'Design' }]);
        expect(await loadDashboardData(user.id, 'admin')).toBe(first);
        expect(db.from).toHaveBeenCalledTimes(1);
        const html = renderToStaticMarkup(<CuratorDashboard user={user} role="admin" />);
        expect(html).toContain('Resource 1');
        expect(html).not.toContain('Loading dashboard.');
    });

    it('never reuses a private snapshot for another account or role, and expires old snapshots', async () => {
        db.from.mockReturnValue(query({ data: [row('1')], error: null }));
        await loadDashboardData(user.id, 'admin');
        expect(getCachedDashboard('curator-b', 'admin')).toBeNull();
        expect(getCachedDashboard(user.id, 'curator')).toBeNull();
        await expect(loadDashboardData('reader', 'user')).rejects.toThrow('Staff access required');
        vi.advanceTimersByTime(300_001);
        expect(getCachedDashboard(user.id, 'admin')).toBeNull();
    });

    it('retries a transient failure automatically and stores only a successful result', async () => {
        db.from.mockReturnValueOnce(query({ data: null, error: new Error('offline') }))
            .mockReturnValue(query({ data: [row('1')], error: null }));
        const pending = loadDashboardData(user.id, 'admin');
        await vi.runAllTimersAsync();
        expect((await pending).pending).toHaveLength(1);
        expect(db.from).toHaveBeenCalledTimes(2);
    });

    it('keeps the last successful dashboard when a background update fails', async () => {
        db.from.mockReturnValue(query({ data: [row('1')], error: null }));
        const first = await loadDashboardData(user.id, 'admin');
        db.from.mockReturnValue(query({ data: null, error: new Error('offline') }));
        const failed = expect(loadDashboardData(user.id, 'admin', true)).rejects.toThrow('offline');
        await vi.runAllTimersAsync();
        await failed;
        expect(getCachedDashboard(user.id, 'admin')).toBe(first);
        expect(db.from).toHaveBeenCalledTimes(4);
    });

    it('invalidates edited data and rejects a response started before that edit', async () => {
        let finish!: (value: any) => void;
        const delayed = new Promise(resolve => { finish = resolve; });
        db.from.mockReturnValueOnce(query(delayed));
        const old = loadDashboardData(user.id, 'admin');
        const rejected = expect(old).rejects.toThrow('Resource data changed');
        await vi.advanceTimersByTimeAsync(0);
        const changed = vi.fn();
        window.addEventListener(RESOURCE_DATA_CHANGED, changed);
        invalidateResourcePageData();
        expect(changed).toHaveBeenCalledOnce();
        db.from.mockReturnValue(query({ data: [row('2')], error: null }));
        const current = await loadDashboardData(user.id, 'admin');
        finish({ data: [row('1')], error: null });
        await rejected;
        expect(getCachedDashboard(user.id, 'admin')).toBe(current);
        expect(current.pending[0].id).toBe('2');
    });

    it('checks the current session before reading its cached profile', async () => {
        db.from.mockReturnValue(query({ data: { role: 'admin' }, error: null }));
        expect((await getResourceViewer())?.role).toBe('admin');
        db.getSession.mockResolvedValue({ data: { session: { user: { id: 'reader-b' } } }, error: null });
        db.from.mockReturnValue(query({ data: { role: 'user' }, error: null }));
        expect((await getResourceViewer())?.role).toBe('user');
        expect(db.from).toHaveBeenCalledTimes(2);
        db.getSession.mockResolvedValue({ data: { session: null }, error: null });
        expect(await getResourceViewer()).toBeNull();
        expect(getCachedDashboard(user.id, 'admin')).toBeNull();
    });

    it('does not downgrade an admin to a user dashboard on a profile connection failure', async () => {
        db.from.mockReturnValue(query({ data: null, error: new Error('profile offline') }));
        const result = expect(getResourceViewer()).rejects.toThrow('profile offline');
        await vi.runAllTimersAsync();
        await result;
    });

    it('times out and aborts stalled reads instead of waiting forever', async () => {
        const signals: AbortSignal[] = [];
        const result = expect(retryResourceRead(signal => {
            signals.push(signal);
            return new Promise(() => {});
        })).rejects.toThrow('timed out');
        await vi.runAllTimersAsync();
        await result;
        expect(signals).toHaveLength(3);
        expect(signals.every(signal => signal.aborted)).toBe(true);
    });

    it('distinguishes an unavailable resource from a request failure', async () => {
        db.from.mockReturnValue(query({ data: null, error: null }));
        expect(await loadResourceDetail('missing', user.id)).toBeNull();
        db.from.mockReturnValue(query({ data: null, error: new Error('offline') }));
        const failed = expect(loadResourceDetail('existing', user.id)).rejects.toThrow('offline');
        await vi.runAllTimersAsync();
        await failed;
    });
});

describe('first HTML before hydration', () => {
    it('renders a real dashboard loading state with no auth or database access', () => {
        vi.unstubAllGlobals();
        const $ = load(renderToStaticMarkup(<UnifiedDashboard />));
        expect($('.resource-loading[role="status"] h1').text()).toBe('Loading dashboard.');
        expect(db.getSession).not.toHaveBeenCalled();
        expect(db.from).not.toHaveBeenCalled();
    });

    it('renders approved resource content immediately, and a loader for missing private data', () => {
        vi.unstubAllGlobals();
        const resource = { ...row('1', 'approved'), tags: [] } as any;
        expect(renderToStaticMarkup(<ResourceDetailView initialResource={resource} resourceId="1" />)).toContain('Resource 1');
        const blank = renderToStaticMarkup(<ResourceDetailView initialResource={null} resourceId="private" />);
        expect(blank).toContain('Loading resource.');
        expect(blank).not.toContain('Resource Not Found');
    });
});
