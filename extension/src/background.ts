import { completeSafariSignIn, extensionSupabase, getExtensionSession, refreshExtensionSession, signInWithGoogle } from './auth';
import { isTemporaryAuthFailure } from './authNetwork';
import { extractPageText } from './capture';
import { EXTENSION_CAPTURE_TIMEOUT_MS, isCapturableUrl, webext } from './browser';
import { restoreStoredCapture, isOlderCaptureUpdate, type CaptureState } from './captureState';
import { showOpportunityToast } from './toast';

declare const __APP_ORIGIN__: string;

const AUTH_CACHE_KEY = 'opportunity-auth-cache-v1';
const CAPTURE_STATE_KEY = 'opportunity-capture-state-v1';
const CAPTURE_NOTIFICATION_PREFIX = 'opportunity-capture:';
const CAPTURE_STATUS_ALARM_PREFIX = 'opportunity-capture-status:';
const CAPTURE_STATUS_POLL_MINUTES = 0.5;
const captureStorage = webext.storage.local;
// This promise serializes mutations within the active worker only. Receipts
// themselves live in storage, so worker restarts do not lose capture state.
let captureMutation: Promise<unknown> = Promise.resolve();
const mutateCaptureStorage = <T>(operation: () => Promise<T>): Promise<T> => {
    const previous = captureMutation;
    const next = (async () => {
        await previous;
        return operation();
    })();
    captureMutation = next.catch(() => undefined);
    return next;
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

const cacheSignedInProfile = (profile: ReturnType<typeof profileFromUser>, userId: string, accessToken: string) => mutateCaptureStorage(async () => {
    const session = await getExtensionSession();
    if (session?.user?.id !== userId || session?.access_token !== accessToken) throw new Error('Your session changed. Reopen the extension.');
    const state = { signedIn: true, userId, profile, updatedAt: Date.now() };
    await webext.storage.local.set({ [AUTH_CACHE_KEY]: state });
    return state;
});

const refreshProfileCache = async (accessToken: string) => {
    try {
        const response = await fetch(`${__APP_ORIGIN__}/api/opportunities/session`, {
            headers: { Authorization: `Bearer ${accessToken}` },
            signal: AbortSignal.timeout(8_000),
        });
        if (!response.ok) return;
        const payload = await response.json();
        const session = await getExtensionSession();
        if (session?.access_token !== accessToken) return;
        await cacheSignedInProfile(payload.profile, session.user.id, accessToken);
    } catch (error) {
        console.warn('Opportunity profile refresh failed', error instanceof Error ? error.message : error);
    }
};

const getSessionState = async () => {
    let session;
    try {
        session = await getExtensionSession();
    } catch (error) {
        // A network outage is not a sign-out. Keep the cached display identity
        // and stored refresh token; protected requests still require a valid token.
        if (isTemporaryAuthFailure(error)) throw error;
        await webext.storage.local.remove(AUTH_CACHE_KEY);
        throw error;
    }
    if (!session?.access_token) {
        await webext.storage.local.remove(AUTH_CACHE_KEY);
        return { signedIn: false, profile: null };
    }

    const cached = await webext.storage.local.get(AUTH_CACHE_KEY);
    const profile = (cached?.[AUTH_CACHE_KEY]?.userId === session.user.id ? cached[AUTH_CACHE_KEY].profile : null) || profileFromUser(session.user);
    const state = await cacheSignedInProfile(profile, session.user.id, session.access_token);
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
    const session = await getExtensionSession();
    if (!state.userId || state.userId !== session?.user?.id) {
        await mutateCaptureStorage(async () => {
            const current = (await captureStorage.get(CAPTURE_STATE_KEY))?.[CAPTURE_STATE_KEY];
            if (current?.id === state.id) await captureStorage.remove(CAPTURE_STATE_KEY);
        });
        return null;
    }
    const restored = restoreStoredCapture(state);
    if (restored && restored !== state) return setCaptureState(restored);
    return restored;
};

const setCaptureState = (state: CaptureState, begin = false, allowParallel = false) => mutateCaptureStorage(async () => {
    if (begin) {
        const session = await getExtensionSession();
        if (!state.userId || session?.user?.id !== state.userId) throw new Error('Your account changed. Save this page again.');
    }
    const stored = await captureStorage.get(CAPTURE_STATE_KEY);
    const current = stored?.[CAPTURE_STATE_KEY] as CaptureState | null;
    const identity = (await captureStorage.get(AUTH_CACHE_KEY))?.[AUTH_CACHE_KEY];
    if (!begin && (current?.userId !== state.userId || (identity?.userId && identity.userId !== state.userId))) return null;
    // Only a new user action can create a receipt. Late network completions
    // must not resurrect a receipt removed by logout or replace another save.
    if (begin && current?.userId === state.userId && ['capturing', 'queued'].includes(current.status)
        && (!allowParallel || current.url === state.url)) return current;
    if (!begin && (!current || (current.operationId || current.id) !== (state.operationId || state.id))) return null;
    if (isOlderCaptureUpdate(current, state)) return null;
    await captureStorage.set({ [CAPTURE_STATE_KEY]: state });
    return state;
});

const scheduleCaptureStatusCheck = async (jobId: string) => {
    if (!webext.alarms?.create) return;
    try {
        await webext.alarms.create(`${CAPTURE_STATUS_ALARM_PREFIX}${jobId}`, {
            delayInMinutes: CAPTURE_STATUS_POLL_MINUTES,
        });
    } catch { /* The persisted receipt and server job remain valid if browser feedback is unavailable. */ }
};

const resumeCaptureStatusCheck = async () => {
    const state = await getCaptureState();
    if (state?.status === 'queued') await scheduleCaptureStatusCheck(state.id);
};

const fetchCaptureJob = async (jobId: string, userId?: string) => {
    const send = (accessToken: string) => fetch(`${__APP_ORIGIN__}/api/opportunities/capture-jobs/${encodeURIComponent(jobId)}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: 'no-store',
        signal: AbortSignal.timeout(12_000),
    });
    const session = await getExtensionSession();
    if (!session?.access_token) throw new Error('Sign in to check this capture');
    if (userId && session.user?.id !== userId) throw new Error('Your account changed.');

    let response = await send(session.access_token);
    if (response.status === 401) {
        const refreshed = await refreshExtensionSession();
        if (userId && refreshed?.user?.id !== userId) throw new Error('Your account changed.');
        if (refreshed?.access_token) response = await send(refreshed.access_token);
    }
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.job) throw Object.assign(new Error(payload.error || 'Capture status could not be checked'), { status: response.status });
    return payload.job;
};

const saveUrl = async (idempotencyKey: string, url: string, title = '', pageText = '', userId?: string) => {
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
        const session = await getExtensionSession();
        if (!session?.access_token) throw new Error('Sign in before saving an opportunity');
        if (userId && session.user?.id !== userId) throw new Error('Your account changed. Save this page again.');

        let activeToken = session.access_token;
        let response = await send(activeToken);
        if (response.status === 401 && !controller.signal.aborted) {
            const refreshed = await refreshExtensionSession();
            if (userId && refreshed?.user?.id !== userId) throw new Error('Your account changed. Save this page again.');
            if (refreshed?.access_token && !controller.signal.aborted) {
                activeToken = refreshed.access_token;
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
    try {
        await webext.action?.setBadgeText({ text });
        await webext.action?.setBadgeBackgroundColor({ color });
        setTimeout(() => { void webext.action?.setBadgeText({ text: '' }).catch(() => undefined); }, 2500);
    } catch { /* A badge failure must not report an accepted server capture as failed. */ }
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

const refreshQueuedCaptureState = async (state: CaptureState, notifyCompletion = false) => {
    if (state.status !== 'queued') return state;
    try {
        const job = await fetchCaptureJob(state.id, state.userId);
        if (job.status === 'pending' || job.status === 'processing' || job.status === 'uploading') {
            await scheduleCaptureStatusCheck(state.id);
            return state;
        }
        if (job.status === 'failed') {
            const failedState: CaptureState = {
                ...state,
                status: 'error',
                error: job.error_message || 'This opportunity could not be saved.',
            };
            if (!await setCaptureState(failedState)) return null;
            if (notifyCompletion) await showCaptureNotification(failedState, 'Capture failed', failedState.error || 'Please try again.');
            return failedState;
        }
        if (job.status !== 'succeeded') throw new Error('Capture status was not recognized.');

        const completedState: CaptureState = {
            ...state,
            status: 'success',
            result: {
                backgroundCompleted: true,
                is_duplicate: Boolean(job.is_duplicate),
                job,
            },
        };
        if (!await setCaptureState(completedState)) return null;
        if (notifyCompletion) {
            await showCaptureNotification(
                completedState,
                job.is_duplicate ? 'Already in your tracker' : 'Saved successfully',
                job.is_duplicate
                    ? 'This opportunity was already saved. Nothing was duplicated.'
                    : 'The opportunity is ready in your dashboard.',
            );
        }
        await showActionFeedback('✓', '#caff48');
        return completedState;
    } catch (error) {
        if (error && typeof error === 'object' && 'status' in error && error.status === 404) {
            const missingState: CaptureState = { ...state, status: 'error', error: 'This capture receipt is no longer available. Check your dashboard or save the page again.' };
            return await setCaptureState(missingState);
        }
        console.warn('Capture completion check failed', error instanceof Error ? error.message : error);
        await scheduleCaptureStatusCheck(state.id);
        return state;
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

const runCaptureOperation = async (state: CaptureState, url: string, title: string, pageText: string, showPageFeedback = false) => {
    const stopKeepingAlive = keepCaptureWorkerAlive();
    const pageFeedback = async (kind: 'success' | 'error', message: string, detail: string) => {
        if (!showPageFeedback) return;
        try {
            if ((await getExtensionSession())?.user?.id === state.userId) {
                await showOpportunityToast(state.tabId, { kind, requestId: state.id, message, detail });
            }
        } catch { /* Feedback must never turn an accepted server job into a failed receipt. */ }
    };
    try {
        const saved = await saveUrl(state.id, url, title, pageText, state.userId);
        await pageFeedback('success', saved?.job ? 'Capture received' : saved?.is_duplicate ? 'Already in your tracker' : 'Added to your tracker',
            saved?.job ? 'It is safely processing. You can close this tab.' : 'The opportunity is ready in your dashboard.');
        if (saved?.job) {
            const queuedState: CaptureState = {
                ...state,
                id: String(saved.job.id || state.id),
                status: 'queued',
                result: saved,
            };
            if (!await setCaptureState(queuedState)) return;
            await scheduleCaptureStatusCheck(queuedState.id);
            const notified = await showCaptureNotification(
                queuedState,
                'Capture received',
                'It is safely processing. You do not need to capture this page again.',
            );
            if (!notified && !showPageFeedback) {
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
        if (!await setCaptureState(completedState)) return;
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
        if (!notified && !showPageFeedback) {
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
        if (!await setCaptureState(failedState)) {
            await pageFeedback('error', 'Couldn’t save this opportunity', message);
            return;
        }
        const notified = await showCaptureNotification(failedState, 'Capture failed', message);
        if (!notified || showPageFeedback) {
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

webext.alarms?.onAlarm?.addListener((alarm: { name?: string }) => {
    if (!alarm.name?.startsWith(CAPTURE_STATUS_ALARM_PREFIX)) return;
    void (async () => {
        const state = await getCaptureState();
        const jobId = alarm.name?.slice(CAPTURE_STATUS_ALARM_PREFIX.length);
        if (!state || state.status !== 'queued' || state.id !== jobId) return;
        await refreshQueuedCaptureState(state, true);
    })();
});

webext.runtime.onInstalled.addListener(() => {
    void prewarmAuthCache();
    void resumeCaptureStatusCheck().catch(() => undefined);
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
    void resumeCaptureStatusCheck().catch(() => undefined);
});

webext.contextMenus.onClicked.addListener(async (info: any, tab: any) => {
    if (!['save-opportunity-page', 'save-opportunity-link'].includes(info.menuItemId)) return;
    const url = info.linkUrl || info.pageUrl || tab?.url;
    if (!isCapturableUrl(url)) return;
    const tabId = typeof tab?.id === 'number' ? tab.id : undefined;
    const requestId = globalThis.crypto.randomUUID();
    try {
        const session = await getExtensionSession();
        if (!session?.access_token) throw new Error('Sign in before saving an opportunity');
        const state: CaptureState = {
            id: requestId, operationId: requestId, status: 'capturing', startedAt: Date.now(),
            tabId, url, title: info.menuItemId === 'save-opportunity-page' ? tab?.title || '' : '',
            userId: session.user.id,
        };
        const accepted = await setCaptureState(state, true, true);
        if (accepted?.operationId !== state.operationId) {
            await showOpportunityToast(tabId, { kind: 'success', requestId, message: 'This page is already processing', detail: 'Check its receipt in the extension.' });
            return;
        }
        await showOpportunityToast(tabId, {
            kind: 'working', requestId, message: 'Sending opportunity',
            detail: 'Saving a receipt before processing begins.',
        });
        const pageText = info.menuItemId === 'save-opportunity-page' && tabId
            ? await extractPageText(tabId) : '';
        await runCaptureOperation(state, url, state.title || '', pageText, true);
    } catch (error) {
        await showOpportunityToast(tabId, {
            kind: 'error', requestId, message: 'Couldn’t save this opportunity',
            detail: error instanceof Error ? error.message : 'Please try again.',
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
                const { error: logoutError } = await extensionSupabase.auth.signOut({ scope: 'local' });
                if (logoutError) throw logoutError;
                await mutateCaptureStorage(async () => {
                    await webext.storage.local.remove(AUTH_CACHE_KEY);
                    await captureStorage.remove(CAPTURE_STATE_KEY);
                });
                return { signedIn: false, profile: null };
            case 'GET_CAPTURE_STATE':
                return (async () => {
                    const state = await getCaptureState();
                    return state?.status === 'queued' ? refreshQueuedCaptureState(state) : state;
                })();
            case 'START_CAPTURE': {
                if (!isCapturableUrl(message.url)) throw new Error('Open a normal HTTP or HTTPS webpage and try again.');
                const existing = await getCaptureState();
                if (existing?.status === 'capturing' || existing?.status === 'queued') return existing;

                const session = await getExtensionSession();
                if (!session?.access_token) throw new Error('Sign in before saving an opportunity');
                const requestId = globalThis.crypto.randomUUID();
                const state: CaptureState = {
                    userId: session.user.id,
                    id: requestId,
                    operationId: requestId,
                    status: 'capturing',
                    startedAt: Date.now(),
                    tabId: typeof message.tabId === 'number' ? message.tabId : undefined,
                    url: String(message.url || ''),
                    title: String(message.title || ''),
                };
                const accepted = await setCaptureState(state, true);
                if (accepted?.operationId !== state.operationId) return accepted;
                const pageText = state.tabId
                    ? await extractPageText(state.tabId).catch(() => '')
                    : '';
                void runCaptureOperation(state, message.url, message.title || '', pageText);
                return state;
            }
            case 'SAFARI_OAUTH_CALLBACK': {
                const callbackUrl = String(message.url || '');
                const senderUrl = String(sender?.url || sender?.tab?.url || '');
                let trustedSender = false;
                try {
                    const actual = new URL(senderUrl);
                    const expected = new URL(__APP_ORIGIN__);
                    trustedSender = actual.origin !== 'null'
                        && actual.origin === expected.origin
                        && actual.pathname === '/opportunities/extension/callback';
                } catch {
                    trustedSender = false;
                }
                if (!trustedSender) {
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
