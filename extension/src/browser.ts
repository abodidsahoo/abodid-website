export const webext: any = (globalThis as any).browser || (globalThis as any).chrome;

export const EXTENSION_CAPTURE_TIMEOUT_MS = 80_000;

export const sendRuntimeMessage = <T = any>(message: unknown): Promise<T> =>
    webext.runtime.sendMessage(message);

export const sendRuntimeMessageWithTimeout = async <T = any>(
    message: unknown,
    timeoutMs = EXTENSION_CAPTURE_TIMEOUT_MS + 5_000,
): Promise<T> => {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_resolve, reject) => {
        timeoutId = setTimeout(() => {
            reject(new Error('The extension stopped waiting for this extraction. Please try again.'));
        }, timeoutMs);
    });

    try {
        return await Promise.race([sendRuntimeMessage<T>(message), timeout]);
    } finally {
        if (timeoutId) clearTimeout(timeoutId);
    }
};

export const getActiveTab = async () => {
    const tabs = await webext.tabs.query({ active: true, currentWindow: true });
    return tabs?.[0] || null;
};

export const openTab = async (url: string) => webext.tabs.create({ url });
