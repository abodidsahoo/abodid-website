const webext: any = (globalThis as any).browser || (globalThis as any).chrome;
const CALLBACK_ATTEMPTS = 3;
const CALLBACK_TIMEOUT_MS = 10_000;
const CALLBACK_RETRY_DELAY_MS = 750;

const wait = (delay: number) => new Promise((resolve) => globalThis.setTimeout(resolve, delay));

const sendCallbackOnce = async () => {
    let timeoutId: ReturnType<typeof globalThis.setTimeout> | undefined;
    const timeout = new Promise<never>((_resolve, reject) => {
        timeoutId = globalThis.setTimeout(
            () => reject(new Error('The extension did not respond in time.')),
            CALLBACK_TIMEOUT_MS,
        );
    });
    try {
        return await Promise.race([
            webext.runtime.sendMessage({
                type: 'SAFARI_OAUTH_CALLBACK',
                url: window.location.href,
            }),
            timeout,
        ]);
    } finally {
        if (timeoutId) globalThis.clearTimeout(timeoutId);
    }
};

const sendCallback = async () => {
    let lastError: unknown;
    for (let attempt = 1; attempt <= CALLBACK_ATTEMPTS; attempt += 1) {
        try {
            return await sendCallbackOnce();
        } catch (error) {
            lastError = error;
            if (attempt < CALLBACK_ATTEMPTS) await wait(CALLBACK_RETRY_DELAY_MS);
        }
    }
    throw lastError;
};

const params = new URLSearchParams(window.location.search);
if (params.has('code') || params.has('error')) {
    void (async () => {
        const status = document.getElementById('safari-extension-auth-status');
        if (status) status.textContent = 'Connecting securely to Opportunity Tracker…';
        try {
            const response = await sendCallback();
            if (!status) return;
            status.textContent = response?.ok
                ? 'Signed in. You can return to Opportunity Tracker.'
                : response?.error || 'Sign in could not be completed.';
        } catch (error) {
            if (status) {
                const detail = error instanceof Error ? error.message : '';
                status.textContent = detail
                    ? `Safari could not reach the extension: ${detail} Reload this page to retry.`
                    : 'Safari could not reach the extension. Reload this page to retry.';
            }
        }
    })();
}
