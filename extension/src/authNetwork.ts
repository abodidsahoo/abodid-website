export const AUTH_CONNECTION_MESSAGE = 'Your sign-in service is temporarily unreachable. Check your internet connection and reopen the extension to retry. Your saved sign-in has been kept.';
export const AUTH_REQUEST_TIMEOUT_MS = 8_000;

/** Keep transport outages retryable so Supabase retains the refresh token. */
export function createExtensionAuthFetch(fetchImpl: typeof fetch = globalThis.fetch, timeoutMs = AUTH_REQUEST_TIMEOUT_MS): typeof fetch {
    return async (input, init) => {
        const controller = new AbortController();
        const sourceSignal = init?.signal || (input instanceof Request ? input.signal : undefined);
        const abort = () => controller.abort(sourceSignal?.reason);
        if (sourceSignal?.aborted) abort();
        else sourceSignal?.addEventListener('abort', abort, { once: true });
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        try {
            return await fetchImpl(input, { ...init, signal: controller.signal });
        } catch (error) {
            // The SDK treats 503 as retryable. Returning it also avoids its raw
            // console.error for rejected fetches; the caller still receives an error.
            if (!(error instanceof TypeError) && !(error instanceof Error && ['AbortError', 'TimeoutError'].includes(error.name))) throw error;
            return new Response(JSON.stringify({ msg: AUTH_CONNECTION_MESSAGE }), {
                status: 503,
                headers: { 'Content-Type': 'application/json' },
            });
        } finally {
            clearTimeout(timer);
            sourceSignal?.removeEventListener('abort', abort);
        }
    };
}

export function isTemporaryAuthFailure(error: unknown): boolean {
    return error instanceof TypeError || Boolean(error && typeof error === 'object' && (
        ('name' in error && ['AuthRetryableFetchError', 'AbortError', 'TimeoutError'].includes(String(error.name)))
        || ('status' in error && [0, 502, 503, 504].includes(Number(error.status)))
    ));
}

export function readExtensionSession<T>(result: { data: { session: T | null }; error: unknown }): T | null {
    if (result.error) {
        if (isTemporaryAuthFailure(result.error)) {
            const error = new Error(AUTH_CONNECTION_MESSAGE);
            error.name = 'AuthRetryableFetchError';
            throw error;
        }
        throw result.error;
    }
    return result.data.session;
}
