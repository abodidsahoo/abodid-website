import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const harness = vi.hoisted(() => ({
    data: {} as Record<string, any>,
    session: null as any,
    openTab: vi.fn(), signIn: vi.fn(), extract: vi.fn(),
    sessionError: null as Error | null,
    listeners: {} as Record<string, any>,
    alarms: vi.fn(), notifications: vi.fn(), toast: vi.fn(),
}));
vi.mock('../../extension/src/auth', () => ({
    getExtensionSession: async () => { if (harness.sessionError) throw harness.sessionError; return harness.session; },
    refreshExtensionSession: async () => harness.session,
    signInWithGoogle: (...args: any[]) => harness.signIn(...args), completeSafariSignIn: vi.fn(),
    extensionSupabase: { auth: { signOut: async () => { harness.session = null; return { error: null }; } } },
}));
vi.mock('../../extension/src/capture', () => ({ extractPageText: (...args: any[]) => harness.extract(...args) }));
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
            onInstalled: { addListener: (fn: any) => { harness.listeners.installed = fn; } }, onStartup: { addListener: (fn: any) => { harness.listeners.startup = fn; } },
        },
        tabs: { create: (...args: any[]) => harness.openTab(...args) },
        contextMenus: { removeAll: vi.fn(async () => {}), create: vi.fn(), onClicked: { addListener: (fn: any) => { harness.listeners.context = fn; } } },
    },
}));
const key = 'opportunity-capture-state-v1';
const message = (value: any) => new Promise<any>((resolve) => harness.listeners.message(value, {}, resolve));
const flush = async () => { for (let i = 0; i < 100; i++) await Promise.resolve(); };

beforeEach(async () => {
    vi.resetModules(); vi.clearAllMocks(); vi.useFakeTimers();
    harness.data = {}; harness.listeners = {}; harness.sessionError = null;
    harness.signIn.mockReset(); harness.extract.mockReset().mockResolvedValue('Public opportunity text');
    harness.session = { access_token: 'test-token', user: { id: 'account-a' } };
    vi.stubGlobal('__APP_ORIGIN__', 'https://abodid.com');
    await import('../../extension/src/background');
});
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('Extension store release regressions', () => {
    it.each(['save-opportunity-page', 'save-opportunity-link'])('opens Google sign-in and resumes the original %s only after success', async (menuItemId) => {
        harness.session = null;
        harness.data['opportunity-auth-cache-v1'] = { signedIn: true, userId: 'expired-account', profile: { username: 'old-user' } };
        let finishSignIn!: (session: any) => void;
        harness.signIn.mockImplementation(() => new Promise((resolve) => { finishSignIn = resolve; }));
        const provider = vi.fn(async (_url: any, _options: any) => Response.json({ job: { id: 'after-login', status: 'pending' } }, { status: 202 }));
        vi.stubGlobal('fetch', provider);
        const tab = { id: 2, title: 'Original page', url: 'https://example.org/original' };
        const info = menuItemId === 'save-opportunity-page'
            ? { menuItemId, pageUrl: tab.url }
            : { menuItemId, linkUrl: 'https://example.org/linked-call' };
        const saving = harness.listeners.context(info, tab);
        await flush();
        expect(harness.signIn).toHaveBeenCalledTimes(1);
        expect(provider).not.toHaveBeenCalled();
        expect(harness.extract).not.toHaveBeenCalled();
        expect(harness.data[key]).toBeUndefined();
        expect(harness.toast).toHaveBeenCalledWith(2, expect.objectContaining({ kind: 'working', message: 'Sign in to save this opportunity' }));
        // Navigating during OAuth must not capture the new page or its title.
        tab.url = 'https://example.org/unrelated'; tab.title = 'Unrelated page';
        harness.session = { access_token: 'new-token', user: { id: 'signed-in-user' } };
        finishSignIn(harness.session);
        await saving;
        expect(harness.data[key]).toMatchObject({ id: 'after-login', status: 'queued', userId: 'signed-in-user' });
        expect(provider).toHaveBeenCalledTimes(1);
        expect(harness.data['opportunity-auth-cache-v1'].userId).toBe('signed-in-user');
        expect(JSON.parse(provider.mock.calls[0][1].body)).toMatchObject({
            url: menuItemId === 'save-opportunity-page' ? 'https://example.org/original' : 'https://example.org/linked-call',
            title: menuItemId === 'save-opportunity-page' ? 'Original page' : '', page_text: '',
        });
        expect(harness.extract).not.toHaveBeenCalled();
    });
    it('requires Google sign-in for an anonymous session before saving', async () => {
        harness.session = { access_token: 'anonymous-token', user: { id: 'guest', is_anonymous: true } };
        harness.signIn.mockImplementation(async () => {
            harness.session = { access_token: 'real-token', user: { id: 'real-user' } };
            return harness.session;
        });
        vi.stubGlobal('fetch', vi.fn(async () => Response.json({ job: { id: 'signed-in-job', status: 'pending' } }, { status: 202 })));
        await harness.listeners.context({ menuItemId: 'save-opportunity-page', pageUrl: 'https://example.org/call' }, { id: 2 });
        expect(harness.signIn).toHaveBeenCalledTimes(1);
        expect(harness.data[key]).toMatchObject({ status: 'queued', userId: 'real-user' });
        expect(harness.extract).not.toHaveBeenCalled();
    });
    it('does not capture or charge an AI attempt if Google sign-in is cancelled', async () => {
        harness.session = null;
        harness.signIn.mockRejectedValue(new Error('Google sign-in was cancelled'));
        vi.stubGlobal('fetch', vi.fn());
        await harness.listeners.context({ menuItemId: 'save-opportunity-page', pageUrl: 'https://example.org/call' }, { id: 2 });
        expect(fetch).not.toHaveBeenCalled();
        expect(harness.extract).not.toHaveBeenCalled();
        expect(harness.data[key]).toBeUndefined();
        expect(harness.toast).toHaveBeenLastCalledWith(2, expect.objectContaining({ kind: 'error', detail: 'Google sign-in was cancelled' }));
    });
    it('leaves a pending Safari sign-in retryable without saving before its callback', async () => {
        harness.session = null;
        harness.signIn.mockResolvedValue(null);
        vi.stubGlobal('fetch', vi.fn());
        await harness.listeners.context({ menuItemId: 'save-opportunity-link', linkUrl: 'https://example.org/call' }, { id: 2 });
        expect(fetch).not.toHaveBeenCalled();
        expect(harness.data[key]).toBeUndefined();
        expect(harness.toast).toHaveBeenLastCalledWith(2, expect.objectContaining({ kind: 'working', message: 'Finish Google sign-in' }));
    });
    it('does not restart Google sign-in when checking an existing session fails temporarily', async () => {
        harness.sessionError = Object.assign(new Error('Offline'), { name: 'AuthRetryableFetchError' });
        vi.stubGlobal('fetch', vi.fn());
        await harness.listeners.context({ menuItemId: 'save-opportunity-page', pageUrl: 'https://example.org/call' }, { id: 2 });
        expect(harness.signIn).not.toHaveBeenCalled();
        expect(fetch).not.toHaveBeenCalled();
    });
    it('does not save if OAuth returns without establishing the extension session', async () => {
        harness.session = null;
        harness.signIn.mockResolvedValue({ access_token: 'unpersisted' });
        vi.stubGlobal('fetch', vi.fn());
        await harness.listeners.context({ menuItemId: 'save-opportunity-page', pageUrl: 'https://example.org/call' }, { id: 2 });
        expect(fetch).not.toHaveBeenCalled();
        expect(harness.data[key]).toBeUndefined();
    });

    it('routes a fresh installation through the welcome hook without capturing anything', async () => {
        harness.session = null;
        const provider = vi.fn();
        vi.stubGlobal('fetch', provider);
        harness.listeners.installed({ reason: 'install' });
        await flush();
        expect(harness.openTab).toHaveBeenCalledExactlyOnceWith({ url: 'chrome-extension://test/welcome.html' });
        expect(provider).not.toHaveBeenCalled();
        expect(harness.data[key]).toBeUndefined();
    });
    it('does not open a welcome tab on extension updates', async () => {
        harness.session = null;
        harness.listeners.installed({ reason: 'update' });
        await flush();
        expect(harness.openTab).not.toHaveBeenCalled();
    });
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
