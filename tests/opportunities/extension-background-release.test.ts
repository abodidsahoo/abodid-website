import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const harness = vi.hoisted(() => ({
    data: {} as Record<string, any>,
    session: null as any,
    listeners: {} as Record<string, any>,
    alarms: vi.fn(), notifications: vi.fn(), toast: vi.fn(),
}));
vi.mock('../../extension/src/auth', () => ({
    getExtensionSession: async () => harness.session,
    refreshExtensionSession: async () => harness.session,
    signInWithGoogle: vi.fn(), completeSafariSignIn: vi.fn(),
    extensionSupabase: { auth: { signOut: async () => { harness.session = null; return { error: null }; } } },
}));
vi.mock('../../extension/src/capture', () => ({ extractPageText: async () => 'Public opportunity text' }));
vi.mock('../../extension/src/toast', () => ({ showOpportunityToast: (...args: any[]) => harness.toast(...args) }));
vi.mock('../../extension/src/browser', async (importOriginal) => ({
    ...await importOriginal<typeof import('../../extension/src/browser')>(),
    EXTENSION_CAPTURE_TIMEOUT_MS: 80_000,
    webext: {
        storage: { local: {
            get: async (key: string) => ({ [key]: harness.data[key] }),
            set: async (values: any) => { Object.assign(harness.data, values); },
            remove: async (key: string) => { delete harness.data[key]; },
        } },
        alarms: { create: (...args: any[]) => harness.alarms(...args), onAlarm: { addListener: (fn: any) => { harness.listeners.alarm = fn; } } },
        notifications: { create: (...args: any[]) => harness.notifications(...args), onClicked: { addListener: vi.fn() } },
        action: { setBadgeText: vi.fn(), setBadgeBackgroundColor: vi.fn() },
        runtime: {
            getURL: (path: string) => `chrome-extension://test/${path}`,
            onMessage: { addListener: (fn: any) => { harness.listeners.message = fn; } },
            onInstalled: { addListener: vi.fn() }, onStartup: { addListener: (fn: any) => { harness.listeners.startup = fn; } },
        },
        contextMenus: { onClicked: { addListener: (fn: any) => { harness.listeners.context = fn; } } },
    },
}));
const key = 'opportunity-capture-state-v1';
const message = (value: any) => new Promise<any>((resolve) => harness.listeners.message(value, {}, resolve));
const flush = async () => { for (let i = 0; i < 100; i++) await Promise.resolve(); };

beforeEach(async () => {
    vi.resetModules(); vi.clearAllMocks(); vi.useFakeTimers();
    harness.data = {}; harness.listeners = {};
    harness.session = { access_token: 'test-token', user: { id: 'account-a' } };
    vi.stubGlobal('__APP_ORIGIN__', 'https://abodid.com');
    await import('../../extension/src/background');
});
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('Extension store release regressions', () => {
    it('keeps an accepted server receipt when alarm creation fails', async () => {
        harness.alarms.mockRejectedValueOnce(new Error('Browser alarm unavailable'));
        vi.stubGlobal('fetch', vi.fn(async () => Response.json({ job: { id: 'job', status: 'pending' } }, { status: 202 })));
        await harness.listeners.context({ menuItemId: 'save-opportunity-link', linkUrl: 'https://example.org/call' }, { id: 2 });
        expect(harness.data[key]).toMatchObject({ id: 'job', status: 'queued' });
    });
    it('keeps unknown server status pending instead of claiming a false success', async () => {
        harness.data[key] = { id: 'job', operationId: 'op', status: 'queued', userId: 'account-a', startedAt: 1000 };
        vi.stubGlobal('fetch', vi.fn(async () => Response.json({ job: { id: 'job', status: 'unexpected' } })));
        const log = vi.spyOn(console, 'warn').mockImplementation(() => {});
        try {
            expect((await message({ type: 'GET_CAPTURE_STATE' })).data.status).toBe('queued');
            expect(harness.notifications).not.toHaveBeenCalled();
        } finally { log.mockRestore(); }
    });
    it('makes a missing job retryable instead of polling forever', async () => {
        harness.data[key] = { id: 'job', operationId: 'op', status: 'queued', userId: 'account-a', startedAt: 1000 };
        vi.stubGlobal('fetch', vi.fn(async () => Response.json({ error: 'Not found' }, { status: 404 })));
        expect((await message({ type: 'GET_CAPTURE_STATE' })).data).toMatchObject({ status: 'error', error: expect.stringContaining('no longer available') });
        expect(harness.alarms).not.toHaveBeenCalled();
    });
    it('rejects restricted browser pages before creating a job', async () => {
        vi.stubGlobal('fetch', vi.fn());
        const response = await message({ type: 'START_CAPTURE', tabId: 2, url: 'chrome://extensions/' });
        expect(response).toMatchObject({ ok: false, error: expect.stringContaining('HTTP or HTTPS') });
        expect(fetch).not.toHaveBeenCalled();
        expect(harness.data[key]).toBeUndefined();
    });
    it('atomically shares one handoff for simultaneous toolbar clicks', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => Response.json({ job: { id: 'server-job', status: 'pending' } }, { status: 202 })));
        const request = { type: 'START_CAPTURE', tabId: 2, url: 'https://example.org/apply' };
        const replies = await Promise.all([message(request), message(request)]);
        await flush();
        expect(replies[0].data.operationId).toBe(replies[1].data.operationId);
        expect(fetch).toHaveBeenCalledTimes(1);
    });
    it('drops another account receipt and avoids its cached identity', async () => {
        harness.data[key] = { id: 'old-job', operationId: 'old-op', status: 'success', userId: 'account-a', startedAt: 1000 };
        harness.data['opportunity-auth-cache-v1'] = { signedIn: true, userId: 'account-a', profile: { display_name: 'Account A', username: 'old-user' } };
        harness.session = { access_token: 'other-token', user: { id: 'account-b', email: 'b@example.org', user_metadata: { name: 'Account B' } } };
        vi.stubGlobal('fetch', vi.fn(async () => Response.json({}, { status: 503 })));
        expect((await message({ type: 'GET_CAPTURE_STATE' })).data).toBeNull();
        const state = await message({ type: 'AUTH_STATE' });
        expect(state.data).toMatchObject({ userId: 'account-b', profile: { display_name: 'Account B' } });
        expect(harness.data[key]).toBeUndefined();
    });
    it('restores a lost completion alarm after a browser restart', async () => {
        harness.data[key] = { id: 'accepted-job', status: 'queued', startedAt: 1000, userId: 'account-a' };
        harness.listeners.startup();
        await flush();
        expect(harness.alarms).toHaveBeenCalledWith('opportunity-capture-status:accepted-job', { delayInMinutes: 0.5 });
    });
    it('persists a right-click receipt and schedules completion checking', async () => {
        const fetch = vi.fn(async (_url: any, _options: any) => Response.json({ job: { id: 'server-job', status: 'pending' } }, { status: 202 }));
        vi.stubGlobal('fetch', fetch);
        await harness.listeners.context({ menuItemId: 'save-opportunity-link', linkUrl: 'https://example.org/apply' }, { id: 2, title: 'Unrelated parent page' });
        expect(harness.data[key]).toMatchObject({ status: 'queued', id: 'server-job', url: 'https://example.org/apply', title: '', userId: 'account-a' });
        expect(harness.alarms).toHaveBeenCalledWith('opportunity-capture-status:server-job', { delayInMinutes: 0.5 });
        expect(harness.toast).toHaveBeenLastCalledWith(2, expect.objectContaining({ kind: 'success' }));
        expect(JSON.parse(fetch.mock.calls[0][1].body)).toMatchObject({ title: '', page_text: '' });
    });
    it('does not resurrect an in-flight receipt or notification after logout', async () => {
        let resolveFetch!: (value: Response) => void;
        vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>((resolve) => { resolveFetch = resolve; })));
        const started = await message({ type: 'START_CAPTURE', tabId: 2, url: 'https://example.org/apply', title: 'Call' });
        expect(started.ok).toBe(true);
        await flush();
        await message({ type: 'AUTH_LOGOUT' });
        resolveFetch(Response.json({ job: { id: 'old-account-job', status: 'pending' } }, { status: 202 }));
        await flush();
        expect(harness.data[key]).toBeUndefined();
        expect(harness.notifications).not.toHaveBeenCalled();
        expect(harness.alarms).not.toHaveBeenCalled();
    });
    it('does not retry an old capture with a different account token', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => {
            harness.session = { access_token: 'other-token', user: { id: 'account-b' } };
            return Response.json({ error: 'Expired' }, { status: 401 });
        }));
        await harness.listeners.context({ menuItemId: 'save-opportunity-page', pageUrl: 'https://example.org/apply' }, { id: 2, title: 'Call' });
        expect(fetch).toHaveBeenCalledTimes(1);
        await message({ type: 'GET_CAPTURE_STATE' });
        expect(harness.data[key]).toBeUndefined();
    });
});
