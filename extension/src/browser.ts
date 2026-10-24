declare const __APP_ORIGIN__: string;
declare const __BROWSER_TARGET__: string;

export const webext: any = (globalThis as any).browser || (globalThis as any).chrome;

export const EXTENSION_CAPTURE_TIMEOUT_MS = 80_000;

export const sendRuntimeMessage = <T = any>(message: unknown): Promise<T> =>
    webext.runtime.sendMessage(message);

export const requestSafariAppAccess = (): Promise<boolean> => {
    if (__BROWSER_TARGET__ !== 'safari') return Promise.resolve(true);
    if (!webext.permissions?.request) {
        return Promise.reject(new Error('Safari cannot request access to the sign-in callback.'));
    }

    const appOriginPattern = `${new URL(__APP_ORIGIN__).origin}/*`;
    return webext.permissions.request({ origins: [appOriginPattern] });
};

export const getActiveTab = async () => {
    const tabs = await webext.tabs.query({ active: true, currentWindow: true });
    return tabs?.[0] || null;
};

export const openTab = async (url: string) => webext.tabs.create({ url });
