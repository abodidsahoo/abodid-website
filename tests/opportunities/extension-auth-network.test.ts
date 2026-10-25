import { afterEach, describe, expect, it, vi } from 'vitest';
import { createExtensionAuthClient } from '../../extension/src/authClient';
import { AUTH_CONNECTION_MESSAGE, createExtensionAuthFetch, readExtensionSession } from '../../extension/src/authNetwork';

afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe('Extension authentication network recovery', () => {
    it('reports rejected network requests as retryable service failures', async () => {
        const fetcher = createExtensionAuthFetch(vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
        const response = await fetcher('https://example.supabase.co/auth/v1/token');
        expect(response.status).toBe(503);
        expect(await response.json()).toEqual({ msg: AUTH_CONNECTION_MESSAGE });
    });

    it('aborts a stalled request and makes it retryable', async () => {
        vi.useFakeTimers();
        const fetcher = createExtensionAuthFetch(vi.fn((_input, init) => new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
        })), 50);
        const response = fetcher('https://example.supabase.co/auth/v1/token');
        await vi.advanceTimersByTimeAsync(50);
        expect((await response).status).toBe(503);
    });

    it('does not mistake failed session recovery for a missing sign-in', () => {
        expect(() => readExtensionSession({ data: { session: null }, error: { name: 'AuthRetryableFetchError', status: 0 } }))
            .toThrow(AUTH_CONNECTION_MESSAGE);
        expect(readExtensionSession({ data: { session: null }, error: null })).toBeNull();
        const invalid = new Error('Invalid refresh token');
        expect(() => readExtensionSession({ data: { session: null }, error: invalid })).toThrow(invalid);
    });

    it('preserves the stored session through an outage and refreshes it after recovery', async () => {
        vi.useFakeTimers();
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        const original = {
            access_token: 'old-access-token', refresh_token: 'stored-refresh-token', token_type: 'bearer',
            expires_at: Math.floor(Date.now() / 1000) - 60, expires_in: 3600,
            user: { id: 'user-one', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() },
        };
        const stored = new Map([['sb-example-auth-token', JSON.stringify(original)]]);
        const network = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
        const client = { auth: createExtensionAuthClient('https://example.supabase.co', 'public-test-key', {
            getItem: (key) => stored.get(key) ?? null,
            setItem: (key, value) => { stored.set(key, value); },
            removeItem: (key) => { stored.delete(key); },
        }, network) };
        await client.auth.initialize();
        expect(network).not.toHaveBeenCalled();
        const failed = client.auth.getSession();
        await vi.advanceTimersByTimeAsync(60_000);
        expect((await failed).error?.name).toBe('AuthRetryableFetchError');
        expect(JSON.parse(stored.get('sb-example-auth-token')!).refresh_token).toBe('stored-refresh-token');
        expect(consoleError).not.toHaveBeenCalled();

        network.mockResolvedValue(new Response(JSON.stringify({
            access_token: 'fresh-access-token', refresh_token: 'rotated-refresh-token', token_type: 'bearer', expires_in: 3600, user: original.user,
        }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
        const recovered = await client.auth.getSession();
        expect(recovered.error).toBeNull();
        expect(recovered.data.session?.access_token).toBe('fresh-access-token');
        expect(JSON.parse(stored.get('sb-example-auth-token')!).refresh_token).toBe('rotated-refresh-token');
    });
});
