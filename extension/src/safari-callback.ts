const webext: any = (globalThis as any).browser || (globalThis as any).chrome;

const params = new URLSearchParams(window.location.search);
if (params.has('code') || params.has('error')) {
    void (async () => {
        const status = document.getElementById('safari-extension-auth-status');
        try {
            const response = await webext.runtime.sendMessage({
                type: 'SAFARI_OAUTH_CALLBACK',
                url: window.location.href,
            });
            if (!status) return;
            status.textContent = response?.ok
                ? 'Signed in. You can return to Safari.'
                : response?.error || 'Sign in could not be completed.';
        } catch {
            if (status) status.textContent = 'Open the extension and start Google sign-in again.';
        }
    })();
}
