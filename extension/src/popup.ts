import { getActiveTab, sendRuntimeMessage } from './browser';

const byId = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const authPanel = byId<HTMLDivElement>('auth-panel');
const capturePanel = byId<HTMLDivElement>('capture-panel');
const profileName = byId<HTMLSpanElement>('profile-name');
const profileUsername = byId<HTMLSpanElement>('profile-username');
const pageTitle = byId<HTMLDivElement>('page-title');
const pageUrl = byId<HTMLDivElement>('page-url');
const status = byId<HTMLDivElement>('status-msg');
const result = byId<HTMLDivElement>('result-box');
const saveButton = byId<HTMLButtonElement>('save-btn');
const signInButton = byId<HTMLButtonElement>('sign-in-btn');
const logoutButton = byId<HTMLButtonElement>('logout-btn');
const dashboardButton = byId<HTMLButtonElement>('dashboard-btn');

let activeTab: any = null;

const showError = (message: string) => {
    status.textContent = message;
    status.className = 'status-msg error';
};

const clearStatus = () => {
    status.textContent = '';
    status.className = 'status-msg';
};

const renderState = async () => {
    const response = await sendRuntimeMessage<any>({ type: 'AUTH_STATE' });
    const signedIn = Boolean(response?.ok && response.data?.signedIn);
    authPanel.classList.toggle('hidden', signedIn);
    capturePanel.classList.toggle('hidden', !signedIn);
    if (!signedIn) return;

    const profile = response.data.profile;
    profileName.textContent = profile?.display_name || 'Opportunity tracker';
    profileUsername.textContent = profile?.username ? `@${profile.username}` : '';
};

document.addEventListener('DOMContentLoaded', async () => {
    try {
        activeTab = await getActiveTab();
        if (activeTab?.url) {
            pageTitle.textContent = activeTab.title || 'Untitled page';
            pageUrl.textContent = activeTab.url;
        } else {
            pageTitle.textContent = 'This tab cannot be captured';
            pageUrl.textContent = 'Open a normal webpage and try again.';
            saveButton.disabled = true;
        }
        await renderState();
    } catch (error) {
        showError(error instanceof Error ? error.message : 'The extension could not start. Reopen it and try again.');
    }
});

signInButton.addEventListener('click', async () => {
    signInButton.disabled = true;
    signInButton.textContent = 'Opening Google…';
    clearStatus();
    try {
        const response = await sendRuntimeMessage<any>({ type: 'AUTH_LOGIN' });
        if (!response?.ok) {
            showError(response?.error || 'Sign in failed');
            return;
        }
        if (response?.data?.pending) {
            status.textContent = 'Finish Google sign-in in the Safari tab, then reopen this panel.';
        }
        await renderState();
    } catch (error) {
        showError(error instanceof Error ? error.message : 'Sign in failed');
    } finally {
        signInButton.disabled = false;
        signInButton.textContent = 'Continue with Google →';
    }
});

logoutButton.addEventListener('click', async () => {
    clearStatus();
    try {
        const response = await sendRuntimeMessage<any>({ type: 'AUTH_LOGOUT' });
        if (!response?.ok) throw new Error(response?.error || 'Log out failed');
        await renderState();
    } catch (error) {
        showError(error instanceof Error ? error.message : 'Log out failed');
    }
});

dashboardButton.addEventListener('click', async () => {
    clearStatus();
    try {
        const response = await sendRuntimeMessage<any>({ type: 'OPEN_DASHBOARD' });
        if (!response?.ok) throw new Error(response?.error || 'Dashboard could not be opened');
    } catch (error) {
        showError(error instanceof Error ? error.message : 'Dashboard could not be opened');
    }
});

saveButton.addEventListener('click', async () => {
    if (!activeTab?.url) return;
    saveButton.disabled = true;
    saveButton.textContent = 'Extracting…';
    clearStatus();
    result.classList.add('hidden');

    try {
        const response = await sendRuntimeMessage<any>({
            type: 'CAPTURE_TAB',
            tabId: activeTab.id,
            url: activeTab.url,
            title: activeTab.title || '',
        });

        if (!response?.ok) {
            showError(response?.error || 'Opportunity could not be saved');
            saveButton.textContent = 'Try Again →';
            return;
        }

        const opportunity = response.data.opportunity;
        byId<HTMLSpanElement>('result-category').textContent = String(opportunity.category || 'other').replace('_', ' ');
        byId<HTMLDivElement>('result-deadline').textContent = opportunity.deadline_at
            ? new Date(opportunity.deadline_at).toLocaleString()
            : opportunity.deadline_raw || 'No deadline found';
        result.classList.remove('hidden');
        saveButton.textContent = response.data.is_duplicate ? 'Already saved ✓' : 'Saved ✓';
    } catch (error) {
        showError(error instanceof Error ? error.message : 'Opportunity could not be saved');
        saveButton.textContent = 'Try Again →';
    } finally {
        saveButton.disabled = false;
    }
});
