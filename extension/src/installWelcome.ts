export const INSTALL_WELCOME_KEY = 'opportunity-install-welcome-shown-v1';

interface InstallBrowser {
    storage: { local: {
        get: (key: string) => Promise<Record<string, unknown>>;
        set: (value: Record<string, unknown>) => Promise<void>;
        remove: (key: string) => Promise<void>;
    } };
    runtime: { getURL: (path: string) => string };
    tabs: { create: (options: { url: string }) => Promise<unknown> };
}

/** Local onboarding only: never run on updates or browser startup. */
export async function openWelcomeOnInstall(details: { reason?: string } | undefined, browser: InstallBrowser): Promise<boolean> {
    if (details?.reason !== 'install') return false;
    const stored = await browser.storage.local.get(INSTALL_WELCOME_KEY);
    if (stored[INSTALL_WELCOME_KEY] === true) return false;
    await browser.storage.local.set({ [INSTALL_WELCOME_KEY]: true });
    try {
        await browser.tabs.create({ url: browser.runtime.getURL('welcome.html') });
        return true;
    } catch (error) {
        await browser.storage.local.remove(INSTALL_WELCOME_KEY);
        throw error;
    }
}
