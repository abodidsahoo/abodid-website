import { createClient } from '@supabase/supabase-js';
import { webext } from './browser';

declare const __SUPABASE_URL__: string;
declare const __SUPABASE_ANON_KEY__: string;
declare const __APP_ORIGIN__: string;
declare const __BROWSER_TARGET__: string;

const SAFARI_STATE_KEY = 'opportunity-safari-oauth-state';

const extensionStorage = {
    getItem: async (key: string) => {
        const result = await webext.storage.local.get(key);
        return result?.[key] ?? null;
    },
    setItem: async (key: string, value: string) => {
        await webext.storage.local.set({ [key]: value });
    },
    removeItem: async (key: string) => {
        await webext.storage.local.remove(key);
    },
};

export const extensionSupabase = createClient(__SUPABASE_URL__, __SUPABASE_ANON_KEY__, {
    auth: {
        flowType: 'pkce',
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        storage: extensionStorage,
    },
});

export const signInWithGoogle = async () => {
    if (__BROWSER_TARGET__ === 'safari') {
        const state = crypto.randomUUID();
        await webext.storage.local.set({ [SAFARI_STATE_KEY]: state });
        const redirect = new URL('/opportunities/extension/callback', __APP_ORIGIN__);
        redirect.searchParams.set('state', state);

        const { data, error } = await extensionSupabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: redirect.toString(),
                skipBrowserRedirect: true,
                queryParams: { prompt: 'select_account' },
            },
        });
        if (error || !data.url) throw error || new Error('Google sign-in URL was not created');
        await webext.tabs.create({ url: data.url });
        return null;
    }

    if (!webext.identity?.launchWebAuthFlow || !webext.identity?.getRedirectURL) {
        throw new Error('This browser build requires the Safari native authentication bridge. Open One Click Opportunity Tracker to sign in.');
    }

    const redirectTo = webext.identity.getRedirectURL('supabase-auth');
    const { data, error } = await extensionSupabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo,
            skipBrowserRedirect: true,
            queryParams: { prompt: 'select_account' },
        },
    });
    if (error || !data.url) throw error || new Error('Google sign-in URL was not created');

    const callbackUrl = await webext.identity.launchWebAuthFlow({ url: data.url, interactive: true });
    if (!callbackUrl) throw new Error('Google sign-in was cancelled');

    const callback = new URL(callbackUrl);
    const oauthError = callback.searchParams.get('error_description') || callback.searchParams.get('error');
    if (oauthError) throw new Error(oauthError);
    const code = callback.searchParams.get('code');
    if (!code) throw new Error('Google sign-in did not return an authorization code');

    const { data: sessionData, error: exchangeError } = await extensionSupabase.auth.exchangeCodeForSession(code);
    if (exchangeError || !sessionData.session) throw exchangeError || new Error('Could not create an extension session');
    return sessionData.session;
};

export const completeSafariSignIn = async (callbackUrl: string) => {
    if (__BROWSER_TARGET__ !== 'safari') throw new Error('Safari callback is not available in this build');
    const callback = new URL(callbackUrl);
    const expectedOrigin = new URL(__APP_ORIGIN__).origin;
    if (callback.origin !== expectedOrigin || callback.pathname !== '/opportunities/extension/callback') {
        throw new Error('Invalid Safari authentication callback');
    }

    const stored = await webext.storage.local.get(SAFARI_STATE_KEY);
    const expectedState = stored?.[SAFARI_STATE_KEY];
    const state = callback.searchParams.get('state');
    await webext.storage.local.remove(SAFARI_STATE_KEY);
    if (!expectedState || !state || state !== expectedState) throw new Error('Safari authentication state did not match');

    const oauthError = callback.searchParams.get('error_description') || callback.searchParams.get('error');
    if (oauthError) throw new Error(oauthError);
    const code = callback.searchParams.get('code');
    if (!code) throw new Error('Google sign-in did not return an authorization code');

    const { data, error } = await extensionSupabase.auth.exchangeCodeForSession(code);
    if (error || !data.session) throw error || new Error('Could not create a Safari extension session');
    return data.session;
};
