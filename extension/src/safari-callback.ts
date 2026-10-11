const webext: any = (globalThis as any).browser || (globalThis as any).chrome;

const params = new URLSearchParams(window.location.search);
if (params.has('code') || params.has('error')) {
    void webext.runtime.sendMessage({
        type: 'SAFARI_OAUTH_CALLBACK',
        url: window.location.href,
    }).then((response: any) => {
        const status = document.getElementById('safari-extension-auth-status');
        if (status) {
            status.textContent = response?.ok
                ? 'Signed in. You can return to Safari.'
                : response?.error || 'Sign in could not be completed.';
        }
    }).catch(() => {
        const status = document.getElementById('safari-extension-auth-status');
        if (status) status.textContent = 'Open the extension and start Google sign-in again.';
    });
}
