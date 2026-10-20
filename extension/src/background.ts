import { completeSafariSignIn, extensionSupabase, signInWithGoogle } from './auth';
import { extractPageText } from './capture';
import { EXTENSION_CAPTURE_TIMEOUT_MS, webext } from './browser';
import { showOpportunityToast } from './toast';

declare const __APP_ORIGIN__: string;

const AUTH_CACHE_KEY = 'opportunity-auth-cache-v1';
const CAPTURE_STATE_KEY = 'opportunity-capture-state-v1';
const CAPTURE_STATE_MAX_AGE_MS = 15 * 60 * 1000;
const CAPTURE_NOTIFICATION_PREFIX = 'opportunity-capture:';
const captureStorage = webext.storage.local;

type CaptureState = {
    id: string;
    status: 'capturing' | 'queued' | 'success' | 'error';
    startedAt: number;
    tabId?: number;
    result?: any;
    error?: string;
};

const profileFromUser = (user: any) => {
    const metadata = user?.user_metadata || {};
    const emailName = typeof user?.email === 'string' ? user.email.split('@')[0] : '';
    const username = metadata.user_name || metadata.preferred_username || emailName;
    return {
        display_name: metadata.full_name || metadata.name || username || 'Opportunity tracker',
        username: username || null,
    };
};

const cacheSignedInProfile = async (profile: ReturnType<typeof profileFromUser>) => {
    const state = { signedIn: true, profile, updatedAt: Date.now() };
    await webext.storage.local.set({ [AUTH_CACHE_KEY]: state });
    return state;
};

const refreshProfileCache = async (accessToken: string) => {
    try {
        const response = await fetch(`${__APP_ORIGIN__}/api/opportunities/session`, {
            headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!response.ok) return;
        const payload = await response.json();
        const { data: { session } } = await extensionSupabase.auth.getSession();
        if (session?.access_token !== accessToken) return;
        await cacheSignedInProfile(payload.profile);
    } catch (error) {
        console.warn('Opportunity profile refresh failed', error instanceof Error ? error.message : error);
    }
};

const getSessionState = async () => {
    const { data: { session } } = await extensionSupabase.auth.getSession();
    if (!session?.access_token) {
        await webext.storage.local.remove(AUTH_CACHE_KEY);
        return { signedIn: false, profile: null };
    }

    const cached = await webext.storage.local.get(AUTH_CACHE_KEY);
    const profile = cached?.[AUTH_CACHE_KEY]?.profile || profileFromUser(session.user);
    const state = await cacheSignedInProfile(profile);
    void refreshProfileCache(session.access_token);
    return state;
};

const prewarmAuthCache = async () => {
    try {
        await getSessionState();
    } catch (error) {
        console.warn('Opportunity sign-in cache could not be prepared', error instanceof Error ? error.message : error);
    }
};

const openDashboardTab = async () => {
    const state = await getSessionState();
    const url = state.profile?.username
        ? `${__APP_ORIGIN__}/opportunities/${state.profile.username}`
        : `${__APP_ORIGIN__}/opportunities`;
    await webext.tabs.create({ url });
};

const getCaptureState = async (): Promise<CaptureState | null> => {
    const stored = await captureStorage.get(CAPTURE_STATE_KEY);
    const state = stored?.[CAPTURE_STATE_KEY] as CaptureState | undefined;
    if (!state) return null;
    if (Date.now() - state.startedAt > CAPTURE_STATE_MAX_AGE_MS) {
        await captureStorage.remove(CAPTURE_STATE_KEY);
        return null;
    }
    return state;
};

const setCaptureState = async (state: CaptureState) => {
    await captureStorage.set({ [CAPTURE_STATE_KEY]: state });
    return state;
};

const saveUrl = async (idempotencyKey: string, url: string, title = '', pageText = '') => {
    const controller = new AbortController();
    let timedOut = false;
    let rejectTimeout: ((reason: Error) => void) | undefined;
    const timeout = new Promise<never>((_resolve, reject) => {
        rejectTimeout = reject;
    });
    const timeoutId = globalThis.setTimeout(() => {
        timedOut = true;
        controller.abort();
        rejectTimeout?.(new Error('This extraction took too long. Please try the link again.'));
    }, EXTENSION_CAPTURE_TIMEOUT_MS);

    const send = (accessToken: string, endpoint = '/api/opportunities/capture-jobs') => fetch(`${__APP_ORIGIN__}${endpoint}`, {
        method: 'POST',
        signal: controller.signal,
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
            url,
            title,
            page_text: pageText,
            channel: 'extension',
            idempotency_key: idempotencyKey,
            captured_at: new Date().toISOString(),
            capture_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }),
    });

    const execute = async () => {
        const { data: { session } } = await extensionSupabase.auth.getSession();
        if (!session?.access_token) throw new Error('Sign in before saving an opportunity');

        let activeToken = session.access_token;
        let response = await send(activeToken);
        if (response.status === 401 && !controller.signal.aborted) {
            const { data, error } = await extensionSupabase.auth.refreshSession();
            if (!error && data.session?.access_token && !controller.signal.aborted) {
                activeToken = data.session.access_token;
                response = await send(activeToken);
            }
        }

        let payload = await response.json().catch(() => ({}));
        if (response.status === 503 && payload?.code === 'CAPTURE_JOBS_NOT_CONFIGURED') {
            response = await send(activeToken, '/api/opportunities/capture');
            payload = await response.json().catch(() => ({}));
        }
        if (!response.ok) throw new Error(payload.error || 'Opportunity could not be saved');
        return payload;
    };

    try {
        return await Promise.race([execute(), timeout]);
    } catch (error) {
        if (timedOut) {
            throw new Error('This extraction took too long. Please try the link again.');
        }
        throw error;
    } finally {
        globalThis.clearTimeout(timeoutId);
    }
};

const showActionFeedback = async (text: string, color: string) => {
    await webext.action?.setBadgeText({ text });
    await webext.action?.setBadgeBackgroundColor({ color });
    setTimeout(() => { void webext.action?.setBadgeText({ text: '' }); }, 2500);
};

const showCaptureNotification = async (state: CaptureState, title: string, message: string) => {
    if (!webext.notifications?.create) return false;
    try {
        await webext.notifications.create(`${CAPTURE_NOTIFICATION_PREFIX}${state.status}:${state.id}`, {
            type: 'basic',
            iconUrl: webext.runtime.getURL('icons/icon-128.png'),
            title,
            message,
        });
        return true;
    } catch (error) {
        console.warn('Capture notification could not be shown', error instanceof Error ? error.message : error);
        return false;
    }
};

const keepCaptureWorkerAlive = () => {
    let keepAliveTimer: ReturnType<typeof setTimeout> | undefined;
    const pulse = () => {
        keepAliveTimer = globalThis.setTimeout(() => {
            void captureStorage.get(CAPTURE_STATE_KEY).finally(pulse);
        }, 20_000);
    };
    pulse();
    return () => {
        if (keepAliveTimer) globalThis.clearTimeout(keepAliveTimer);
    };
};

const runCaptureOperation = async (state: CaptureState, url: string, title: string, pageText: string) => {
    const stopKeepingAlive = keepCaptureWorkerAlive();
    try {
        const saved = await saveUrl(state.id, url, title, pageText);
        if (saved?.job) {
            const queuedState: CaptureState = {
                ...state,
                id: String(saved.job.id || state.id),
                status: 'queued',
                result: saved,
            };
            await setCaptureState(queuedState);
            const notified = await showCaptureNotification(
                queuedState,
                'Capture received',
                'It is safely processing in the background. You can close the tab or browser.',
            );
            if (!notified) {
                await showOpportunityToast(state.tabId, {
                    kind: 'success',
                    requestId: state.id,
                    message: 'Capture received.',
                    detail: 'It is safely processing in the background.',
                });
            }
            await showActionFeedback('✓', '#caff48');
            return;
        }
        const completedState: CaptureState = { ...state, status: 'success', result: saved };
        await setCaptureState(completedState);
        const opportunityTitle = saved?.opportunity?.title
            ? String(saved.opportunity.title)
            : 'Your opportunity';
        const notified = await showCaptureNotification(
            completedState,
            'Captured successfully',
            saved?.is_duplicate
                ? `${opportunityTitle} was already in your tracker.`
                : `${opportunityTitle} is ready in your dashboard.`,
        );
        if (!notified) {
            await showOpportunityToast(state.tabId, {
                kind: 'success',
                requestId: state.id,
                message: 'Captured successfully.',
                detail: saved?.is_duplicate ? 'This opportunity was already in your tracker.' : 'The opportunity is ready in your dashboard.',
            });
        }
        await showActionFeedback('✓', '#caff48');
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Opportunity could not be saved';
        const failedState: CaptureState = { ...state, status: 'error', error: message };
        await setCaptureState(failedState);
        const notified = await showCaptureNotification(failedState, 'Capture failed', message);
        if (!notified) {
            await showOpportunityToast(state.tabId, {
                kind: 'error',
                requestId: state.id,
                message: 'Couldn’t capture this opportunity',
                detail: message,
            });
        }
        await showActionFeedback('!', '#ff4d4d');
    } finally {
        stopKeepingAlive();
    }
};

webext.notifications?.onClicked?.addListener((notificationId: string) => {
    if (!notificationId.startsWith(`${CAPTURE_NOTIFICATION_PREFIX}success:`)) return;
    void (async () => {
        await webext.notifications.clear(notificationId);
        await openDashboardTab();
    })();
});

webext.runtime.onInstalled.addListener(() => {
    void prewarmAuthCache();
    void (async () => {
        await webext.contextMenus.removeAll();
        webext.contextMenus.create({ id: 'save-opportunity-page', title: 'Save page to Opportunity Tracker', contexts: ['page'] });
        webext.contextMenus.create({ id: 'save-opportunity-link', title: 'Save link to Opportunity Tracker', contexts: ['link'] });
    })().catch((error) => {
        console.warn('Opportunity context menus could not be created', error instanceof Error ? error.message : error);
    });
});

webext.runtime.onStartup?.addListener(() => {
    void prewarmAuthCache();
});

webext.contextMenus.onClicked.addListener(async (info: any, tab: any) => {
    const url = info.linkUrl || info.pageUrl || tab?.url;
    if (!url) return;
    const tabId = typeof tab?.id === 'number' ? tab.id : undefined;
    const isCurrentPage = info.menuItemId === 'save-opportunity-page';
    const requestId = globalThis.crypto.randomUUID();

    await showOpportunityToast(tabId, {
        kind: 'working',
        requestId,
        message: 'Securing capture…',
        detail: 'Recording it safely before background processing begins.',
    });

    try {
        const pageText = isCurrentPage && tabId ? await extractPageText(tabId) : '';
        const saved = await saveUrl(requestId, url, tab?.title || '', pageText);
        if (saved?.job) {
            await showOpportunityToast(tabId, {
                kind: 'success',
                requestId,
                message: 'Capture received',
                detail: 'It is safely processing in the background. You can close this tab.',
            });
            await showActionFeedback('✓', '#caff48');
            return;
        }
        const opportunityTitle = saved?.opportunity?.title
            ? String(saved.opportunity.title)
            : 'The opportunity';
        await showOpportunityToast(tabId, {
            kind: 'success',
            requestId,
            message: saved?.is_duplicate ? 'Already in your tracker' : 'Added to your tracker',
            detail: `${opportunityTitle} is ready in your opportunities table.`,
        });
        await showActionFeedback('✓', '#caff48');
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Opportunity could not be saved';
        console.warn('Context-menu opportunity save failed', message);
        await showOpportunityToast(tabId, {
            kind: 'error',
            requestId,
            message: 'Couldn’t save this opportunity',
            detail: message,
        });
        await showActionFeedback('!', '#ff4d4d');
    }
});

webext.runtime.onMessage.addListener((message: any, sender: any, sendResponse: (value: any) => void) => {
    const handle = async () => {
        switch (message?.type) {
            case 'AUTH_STATE':
                return getSessionState();
            case 'AUTH_LOGIN':
                return (await signInWithGoogle())
                    ? getSessionState()
                    : { signedIn: false, profile: null, pending: true };
            case 'AUTH_LOGOUT':
                await extensionSupabase.auth.signOut();
                await webext.storage.local.remove(AUTH_CACHE_KEY);
                await captureStorage.remove(CAPTURE_STATE_KEY);
                return { signedIn: false, profile: null };
            case 'GET_CAPTURE_STATE':
                return getCaptureState();
            case 'START_CAPTURE': {
                const existing = await getCaptureState();
                if (existing?.status === 'capturing') return existing;

                const state: CaptureState = {
                    id: globalThis.crypto.randomUUID(),
                    status: 'capturing',
                    startedAt: Date.now(),
                    tabId: typeof message.tabId === 'number' ? message.tabId : undefined,
                };
                await setCaptureState(state);
                const pageText = state.tabId
                    ? await extractPageText(state.tabId).catch(() => '')
                    : '';
                void runCaptureOperation(state, message.url, message.title || '', pageText);
                return state;
            }
            case 'SAFARI_OAUTH_CALLBACK': {
                const callbackUrl = String(message.url || '');
                if (!sender?.url?.startsWith(`${__APP_ORIGIN__}/opportunities/extension/callback`)) {
                    throw new Error('Untrusted Safari authentication callback');
                }
                await completeSafariSignIn(callbackUrl);
                const state = await getSessionState();
                if (sender.tab?.id) {
                    setTimeout(() => { void webext.tabs.remove(sender.tab.id); }, 500);
                }
                return state;
            }
            case 'OPEN_DASHBOARD': {
                await openDashboardTab();
                return { ok: true };
            }
            default:
                throw new Error('Unknown extension request');
        }
    };

    void (async () => {
        try {
            const data = await handle();
            sendResponse({ ok: true, data });
        } catch (error) {
            sendResponse({ ok: false, error: error instanceof Error ? error.message : 'Extension request failed' });
        }
    })();
    return true;
});
