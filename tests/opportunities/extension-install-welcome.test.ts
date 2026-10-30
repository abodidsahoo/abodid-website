import { describe, expect, it, vi } from 'vitest';
import { INSTALL_WELCOME_KEY, openWelcomeOnInstall } from '../../extension/src/installWelcome';
import { createWelcomeFlow } from '../../extension/src/welcomeFlow';

function browserFixture() {
    const data: Record<string, unknown> = {};
    return { data, browser: {
        storage: { local: {
            get: vi.fn(async (key: string) => ({ [key]: data[key] })),
            set: vi.fn(async (value: Record<string, unknown>) => { Object.assign(data, value); }),
            remove: vi.fn(async (key: string) => { delete data[key]; }),
        } },
        runtime: { getURL: vi.fn((path: string) => `chrome-extension://installed-id/${path}`) },
        tabs: { create: vi.fn(async (_options: { url: string }) => ({})) },
    } };
}

describe('First-install welcome', () => {
    it('opens only the packaged welcome page, once per installation', async () => {
        const { data, browser } = browserFixture();
        expect(await openWelcomeOnInstall({ reason: 'install' }, browser)).toBe(true);
        expect(browser.tabs.create).toHaveBeenCalledWith({ url: 'chrome-extension://installed-id/welcome.html' });
        expect(data[INSTALL_WELCOME_KEY]).toBe(true);
        expect(await openWelcomeOnInstall({ reason: 'install' }, browser)).toBe(false);
        expect(browser.tabs.create).toHaveBeenCalledTimes(1);
    });
    it.each(['update', 'chrome_update', 'shared_module_update', undefined])('does not interrupt existing users for %s', async reason => {
        const { browser } = browserFixture();
        expect(await openWelcomeOnInstall({ reason }, browser)).toBe(false);
        expect(browser.storage.local.get).not.toHaveBeenCalled();
        expect(browser.tabs.create).not.toHaveBeenCalled();
    });
    it('restores retry eligibility if opening the tab fails', async () => {
        const { data, browser } = browserFixture();
        browser.tabs.create.mockRejectedValueOnce(new Error('Tab unavailable'));
        await expect(openWelcomeOnInstall({ reason: 'install' }, browser)).rejects.toThrow('Tab unavailable');
        expect(data[INSTALL_WELCOME_KEY]).toBeUndefined();
        expect(await openWelcomeOnInstall({ reason: 'install' }, browser)).toBe(true);
    });
});

describe('Welcome extension sign-in', () => {
    it('checks the extension session without logging in or consuming a capture', async () => {
        const request = vi.fn(async () => ({ ok: true, data: { signedIn: false } }));
        const flow = createWelcomeFlow(request, vi.fn());
        await flow.checkSession();
        expect(request).toHaveBeenCalledExactlyOnceWith({ type: 'AUTH_STATE' });
        expect(flow.getState()).toMatchObject({ busy: null, signedIn: false, error: '' });
    });
    it('uses the existing extension login and reveals first-save guidance only after success', async () => {
        const request = vi.fn(async () => ({ ok: true, data: { signedIn: true } }));
        const flow = createWelcomeFlow(request, vi.fn());
        await flow.start();
        expect(request).toHaveBeenCalledExactlyOnceWith({ type: 'AUTH_LOGIN' });
        expect(flow.getState()).toMatchObject({ busy: null, signedIn: true, pending: false, error: '' });
        await flow.start();
        expect(request).toHaveBeenCalledTimes(1);
    });
    it('recognizes an existing signed-in session', async () => {
        const request = vi.fn(async () => ({ ok: true, data: { signedIn: true } }));
        const flow = createWelcomeFlow(request, vi.fn());
        await flow.checkSession();
        expect(flow.getState().signedIn).toBe(true);
        expect(request).toHaveBeenCalledExactlyOnceWith({ type: 'AUTH_STATE' });
    });
    it('allows retry after Google cancellation instead of claiming success', async () => {
        const request = vi.fn().mockResolvedValueOnce({ ok: false, error: 'Sign-in cancelled.' }).mockResolvedValueOnce({ ok: true, data: { signedIn: true } });
        const flow = createWelcomeFlow(request, vi.fn());
        await flow.start();
        expect(flow.getState()).toMatchObject({ signedIn: false, busy: null, error: 'Sign-in cancelled.' });
        await flow.start();
        expect(flow.getState()).toMatchObject({ signedIn: true, error: '' });
    });
    it('does not treat a pending external sign-in as authenticated', async () => {
        const request = vi.fn().mockResolvedValueOnce({ ok: true, data: { pending: true, signedIn: false } }).mockResolvedValueOnce({ ok: true, data: { signedIn: true } });
        const flow = createWelcomeFlow(request, vi.fn());
        await flow.start();
        expect(flow.getState()).toMatchObject({ signedIn: false, pending: true });
        await flow.checkSession();
        expect(flow.getState()).toMatchObject({ signedIn: true, pending: false });
    });
    it('ignores double-clicks and focus checks while login is in progress', async () => {
        let finish!: (value: any) => void;
        const request = vi.fn(() => new Promise<any>(resolve => { finish = resolve; }));
        const flow = createWelcomeFlow(request, vi.fn());
        const pending = flow.start();
        await flow.start();
        await flow.checkSession();
        expect(request).toHaveBeenCalledTimes(1);
        finish({ ok: true, data: { signedIn: true } });
        await pending;
        expect(flow.getState().signedIn).toBe(true);
    });
    it('leaves sign-in available if session checking is offline', async () => {
        const request = vi.fn().mockRejectedValueOnce(new Error('Offline')).mockResolvedValueOnce({ ok: true, data: { signedIn: true } });
        const flow = createWelcomeFlow(request, vi.fn());
        await flow.checkSession();
        expect(flow.getState()).toMatchObject({ busy: null, signedIn: false, error: expect.stringContaining('still get started') });
        await flow.start();
        expect(flow.getState().signedIn).toBe(true);
    });
    it('rejects incomplete login responses', async () => {
        const request = vi.fn(async () => ({ ok: true, data: {} }));
        const flow = createWelcomeFlow(request, vi.fn());
        await flow.start();
        expect(flow.getState()).toMatchObject({ busy: null, signedIn: false, error: expect.stringContaining('did not finish') });
    });
});
