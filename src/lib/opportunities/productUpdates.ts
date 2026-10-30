export const PRODUCT_UPDATES_CONSENT_VERSION = '2026-10-30-v1';
export const PRODUCT_UPDATES_CONSENT_TEXT = 'Send me occasional product updates and new feature announcements from Abodid & Co.';
export const PRODUCT_UPDATES_INTENT_KEY = 'opportunity-product-updates-intent-v1';
const INTENT_TTL_MS = 30 * 60 * 1000;

type IntentStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
type StorageProvider = () => IntentStorage;
const browserStorage: StorageProvider = () => window.sessionStorage;

/** Bind an affirmative choice to this OAuth attempt, rather than to a future login. */
export function prepareProductUpdatesSignIn(callback: URL, optedIn: boolean, getStorage: StorageProvider = browserStorage, now = Date.now()) {
    callback.searchParams.delete('updates_intent');
    callback.searchParams.delete('updates_notice');
    try {
        const storage = getStorage();
        storage.removeItem(PRODUCT_UPDATES_INTENT_KEY);
        if (!optedIn) return;
        const nonce = crypto.randomUUID();
        storage.setItem(PRODUCT_UPDATES_INTENT_KEY, JSON.stringify({ nonce, optedIn: true, createdAt: now, version: PRODUCT_UPDATES_CONSENT_VERSION }));
        callback.searchParams.set('updates_intent', nonce);
    } catch {
        if (optedIn) callback.searchParams.set('updates_notice', 'not-saved');
    }
}

export function discardProductUpdatesSignIn(callback: URL, getStorage: StorageProvider = browserStorage) {
    try {
        const storage = getStorage();
        const value = JSON.parse(storage.getItem(PRODUCT_UPDATES_INTENT_KEY) || 'null');
        if (value?.nonce === callback.searchParams.get('updates_intent')) storage.removeItem(PRODUCT_UPDATES_INTENT_KEY);
    } catch { /* Storage restrictions must never prevent signing in. */ }
}

export async function completeProductUpdatesSignIn(
    accessToken: string,
    params: URLSearchParams,
    getStorage: StorageProvider = browserStorage,
    fetchImpl: typeof fetch = fetch,
    now = Date.now(),
): Promise<'none' | 'saved' | 'not-saved'> {
    if (params.get('updates_notice') === 'not-saved') return 'not-saved';
    const nonce = params.get('updates_intent');
    if (!nonce) return 'none';
    try {
        const storage = getStorage();
        const value = JSON.parse(storage.getItem(PRODUCT_UPDATES_INTENT_KEY) || 'null');
        if (!value || value.nonce !== nonce) return 'none';
        storage.removeItem(PRODUCT_UPDATES_INTENT_KEY);
        const age = now - value.createdAt;
        if (value.optedIn !== true || value.version !== PRODUCT_UPDATES_CONSENT_VERSION
            || typeof value.createdAt !== 'number' || !Number.isFinite(age) || age < 0 || age > INTENT_TTL_MS) return 'none';
        const response = await fetchImpl('/api/opportunities/product-updates', {
            method: 'POST',
            headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ opt_in: true, source: 'onboarding', consent_version: PRODUCT_UPDATES_CONSENT_VERSION }),
            signal: AbortSignal.timeout(6000),
        });
        return response.ok ? 'saved' : 'not-saved';
    } catch {
        return 'not-saved';
    }
}
