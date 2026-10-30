import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const auth = vi.hoisted(() => ({ signInWithOAuth: vi.fn(), exchangeCodeForSession: vi.fn() }));
const identity = vi.hoisted(() => ({
    getRedirectURL: () => 'https://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.chromiumapp.org/supabase-auth',
    launchWebAuthFlow: vi.fn(),
}));
vi.mock('../../extension/src/authClient', () => ({ createExtensionAuthClient: () => auth }));
vi.mock('../../extension/src/browser', () => ({ webext: { identity, storage: { local: {} } } }));
beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('__SUPABASE_URL__', 'https://project.supabase.co');
    vi.stubGlobal('__SUPABASE_ANON_KEY__', 'public-test-key');
    vi.stubGlobal('__BROWSER_TARGET__', 'chrome');
    auth.signInWithOAuth.mockResolvedValue({ data: { url: 'https://project.supabase.co/auth/v1/authorize' } });
    auth.exchangeCodeForSession.mockResolvedValue({ data: { session: { user: { id: 'user-a' } } } });
});
afterEach(() => vi.unstubAllGlobals());
describe('Extension OAuth callback boundary', () => {
    it('exchanges the exact installed identity callback through PKCE', async () => {
        identity.launchWebAuthFlow.mockResolvedValue(`${identity.getRedirectURL()}?code=one-time-code`);
        const { signInWithGoogle } = await import('../../extension/src/auth');
        expect(await signInWithGoogle()).toMatchObject({ user: { id: 'user-a' } });
        expect(auth.exchangeCodeForSession).toHaveBeenCalledWith('one-time-code');
        expect(auth.signInWithOAuth).toHaveBeenCalledWith(expect.objectContaining({
            options: expect.objectContaining({ redirectTo: identity.getRedirectURL(), scopes: 'openid email profile' }),
        }));
    });
    it.each([
        'https://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.chromiumapp.org.attacker.test/supabase-auth?code=bad',
        'https://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.chromiumapp.org/other?code=bad',
        'http://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.chromiumapp.org/supabase-auth?code=bad',
    ])('rejects a spoofed callback before exchanging any code: %s', async (callback) => {
        identity.launchWebAuthFlow.mockResolvedValue(callback);
        const { signInWithGoogle } = await import('../../extension/src/auth');
        await expect(signInWithGoogle()).rejects.toThrow('unexpected address');
        expect(auth.exchangeCodeForSession).not.toHaveBeenCalled();
    });
});
