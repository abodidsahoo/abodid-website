declare const __APP_ORIGIN__: string;
declare const __BROWSER_TARGET__: string;

export const webext: any = (globalThis as any).browser || (globalThis as any).chrome;

export const EXTENSION_CAPTURE_TIMEOUT_MS = 80_000;

export const isCapturableUrl = (value: unknown): value is string => {
    if (typeof value !== 'string') return false;
    try {
        const url = new URL(value);
        return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password;
    } catch { return false; }
};

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
    const tab = tabs?.[0];
    return tab ? { ...tab, url: isCapturableUrl(tab.url) ? tab.url : undefined } : null;
};

export const openTab = async (url: string) => webext.tabs.create({ url });
