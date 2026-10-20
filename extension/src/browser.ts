export const webext: any = (globalThis as any).browser || (globalThis as any).chrome;

export const EXTENSION_CAPTURE_TIMEOUT_MS = 80_000;

export const sendRuntimeMessage = <T = any>(message: unknown): Promise<T> =>
    webext.runtime.sendMessage(message);

export const getActiveTab = async () => {
    const tabs = await webext.tabs.query({ active: true, currentWindow: true });
    return tabs?.[0] || null;
};

export const openTab = async (url: string) => webext.tabs.create({ url });
