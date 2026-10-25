import { AuthClient, type SupportedStorage } from '@supabase/supabase-js';
import { createExtensionAuthFetch } from './authNetwork';

/** Auth-only client: no unused database/realtime subscriber refreshing at worker startup. */
export function createExtensionAuthClient(url: string, publicKey: string, storage: SupportedStorage, fetchImpl: typeof fetch = globalThis.fetch) {
    return new AuthClient({
        url: `${url.replace(/\/$/, '')}/auth/v1`,
        headers: { apikey: publicKey, Authorization: `Bearer ${publicKey}` },
        // Match createClient's existing key so installed users keep their session and PKCE verifier.
        storageKey: `sb-${new URL(url).hostname.split('.')[0]}-auth-token`,
        flowType: 'pkce',
        persistSession: true,
        // Workers have no foreground visibility lifecycle. getSession refreshes on demand.
        autoRefreshToken: false,
        detectSessionInUrl: false,
        storage,
        fetch: createExtensionAuthFetch(fetchImpl),
    });
}
