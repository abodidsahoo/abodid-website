import { completeSafariSignIn, extensionSupabase, signInWithGoogle } from './auth';
import { extractPageText } from './capture';
import { EXTENSION_CAPTURE_TIMEOUT_MS, webext } from './browser';
import { showOpportunityToast } from './toast';

declare const __APP_ORIGIN__: string;

const getSessionState = async () => {
    const { data: { session } } = await extensionSupabase.auth.getSession();
    if (!session?.access_token) return { signedIn: false, profile: null };

    const response = await fetch(`${__APP_ORIGIN__}/api/opportunities/session`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (!response.ok) return { signedIn: false, profile: null };
    const payload = await response.json();
    return { signedIn: true, profile: payload.profile };
};

const saveUrl = async (url: string, title = '', pageText = '') => {
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

    const send = (accessToken: string) => fetch(`${__APP_ORIGIN__}/api/opportunities/capture`, {
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
            captured_at: new Date().toISOString(),
            capture_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }),
    });

    const execute = async () => {
        const { data: { session } } = await extensionSupabase.auth.getSession();
        if (!session?.access_token) throw new Error('Sign in before saving an opportunity');

        let response = await send(session.access_token);
        if (response.status === 401 && !controller.signal.aborted) {
            const { data, error } = await extensionSupabase.auth.refreshSession();
            if (!error && data.session?.access_token && !controller.signal.aborted) {
                response = await send(data.session.access_token);
            }
        }

        const payload = await response.json().catch(() => ({}));
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

webext.runtime.onInstalled.addListener(() => {
    void (async () => {
        await webext.contextMenus.removeAll();
        webext.contextMenus.create({ id: 'save-opportunity-page', title: 'Save page to Opportunity Tracker', contexts: ['page'] });
        webext.contextMenus.create({ id: 'save-opportunity-link', title: 'Save link to Opportunity Tracker', contexts: ['link'] });
    })().catch((error) => {
        console.warn('Opportunity context menus could not be created', error instanceof Error ? error.message : error);
    });
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
        message: 'Extracting opportunity…',
        detail: 'Reading the details and important dates.',
    });

    try {
        const pageText = isCurrentPage && tabId ? await extractPageText(tabId) : '';
        const saved = await saveUrl(url, tab?.title || '', pageText);
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
                return { signedIn: false, profile: null };
            case 'CAPTURE_TAB': {
                const pageText = message.tabId ? await extractPageText(message.tabId) : '';
                return saveUrl(message.url, message.title || '', pageText);
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
                const state = await getSessionState();
                const url = state.profile?.username
                    ? `${__APP_ORIGIN__}/opportunities/${state.profile.username}`
                    : `${__APP_ORIGIN__}/opportunities`;
                await webext.tabs.create({ url });
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
