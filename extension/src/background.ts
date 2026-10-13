import { completeSafariSignIn, extensionSupabase, signInWithGoogle } from './auth';
import { extractPageText } from './capture';
import { webext } from './browser';

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
    const { data: { session } } = await extensionSupabase.auth.getSession();
    if (!session?.access_token) throw new Error('Sign in before saving an opportunity');

    const response = await fetch(`${__APP_ORIGIN__}/api/opportunities/capture`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
            url,
            title,
            page_text: pageText,
            captured_at: new Date().toISOString(),
            capture_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || 'Opportunity could not be saved');
    return payload;
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
    try {
        await saveUrl(url, tab?.title || '');
        await showActionFeedback('✓', '#caff48');
    } catch (error) {
        console.warn('Context-menu opportunity save failed', error instanceof Error ? error.message : error);
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
