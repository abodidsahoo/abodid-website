import { getActiveTab, sendRuntimeMessage, webext } from './browser';

const AUTH_CACHE_KEY = 'opportunity-auth-cache-v1';
const CAPTURE_STATE_KEY = 'opportunity-capture-state-v1';

type CaptureState = {
    id: string;
    status: 'capturing' | 'queued' | 'success' | 'error';
    startedAt: number;
    result?: any;
    error?: string;
};

const byId = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const authPanel = byId<HTMLDivElement>('auth-panel');
const capturePanel = byId<HTMLDivElement>('capture-panel');
const profileRow = byId<HTMLDivElement>('profile-row');
const profileName = byId<HTMLSpanElement>('profile-name');
const profileUsername = byId<HTMLSpanElement>('profile-username');
const targetCard = byId<HTMLDivElement>('target-card');
const pageTitle = byId<HTMLDivElement>('page-title');
const status = byId<HTMLDivElement>('status-msg');
const captureProgress = byId<HTMLElement>('capture-progress');
const result = byId<HTMLDivElement>('result-box');
const resultSuccessBadge = byId<HTMLSpanElement>('result-success-badge');
const resultCategory = byId<HTMLElement>('result-category');
const resultDeadline = byId<HTMLElement>('result-deadline');
const saveButton = byId<HTMLButtonElement>('save-btn');
const signInButton = byId<HTMLButtonElement>('sign-in-btn');
const logoutButton = byId<HTMLButtonElement>('logout-btn');
const dashboardButton = byId<HTMLButtonElement>('dashboard-btn');
const closeProgressButton = byId<HTMLButtonElement>('close-progress-btn');

let activeTab: any = null;
let authResolved = false;
let signedIn = false;
let isCapturing = false;
let currentCaptureState: CaptureState | null = null;

const syncSaveButton = () => {
    if (isCapturing) {
        saveButton.classList.add('hidden');
        return;
    }

    saveButton.classList.remove('hidden');
    if (!authResolved) {
        saveButton.disabled = true;
        saveButton.textContent = 'Checking tracker…';
        return;
    }
    if (!signedIn) {
        saveButton.disabled = true;
        saveButton.textContent = 'Sign in to save';
        return;
    }
    if (!activeTab?.url) {
        saveButton.disabled = true;
        saveButton.textContent = 'Page unavailable';
        return;
    }
    saveButton.disabled = false;
    saveButton.textContent = 'Capture & Save';
};

const showError = (message: string) => {
    status.textContent = message;
    status.className = 'status-msg error';
};

const clearStatus = () => {
    status.textContent = '';
    status.className = 'status-msg';
};

const renderProfile = (profile: any) => {
    profileName.textContent = profile?.display_name || 'Opportunity tracker';
    profileUsername.textContent = profile?.username ? `@${profile.username}` : '';
};

const applyAuthState = (state: any) => {
    signedIn = Boolean(state?.signedIn);
    authResolved = true;
    authPanel.classList.toggle('hidden', signedIn);
    capturePanel.classList.toggle('hidden', !signedIn);
    profileRow.classList.toggle('hidden', !signedIn);
    if (signedIn) renderProfile(state.profile);
    syncSaveButton();
};

const formatResultDeadline = (deadlineAt: unknown, deadlineRaw: unknown) => {
    if (typeof deadlineAt !== 'string' || !deadlineAt.trim()) {
        return {
            label: typeof deadlineRaw === 'string' && deadlineRaw.trim() ? deadlineRaw.trim() : 'No deadline found',
            hasPassed: false,
        };
    }

    const deadline = new Date(deadlineAt);
    if (Number.isNaN(deadline.getTime())) {
        return {
            label: typeof deadlineRaw === 'string' && deadlineRaw.trim() ? deadlineRaw.trim() : 'No deadline found',
            hasPassed: false,
        };
    }

    const formattedDate = new Intl.DateTimeFormat('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    }).format(deadline);
    const hasPassed = deadline.getTime() < Date.now();
    return { label: hasPassed ? `⚠ Deadline passed (${formattedDate})` : formattedDate, hasPassed };
};

const applyCaptureState = (state: CaptureState | null) => {
    if (
        state?.status === 'capturing'
        && currentCaptureState?.id === state.id
        && currentCaptureState.status !== 'capturing'
    ) return;
    currentCaptureState = state;
    isCapturing = state?.status === 'capturing';
    captureProgress.classList.toggle('hidden', !isCapturing);
    syncSaveButton();

    if (!state || state.status === 'capturing') {
        if (state?.status === 'capturing') result.classList.add('hidden');
        return;
    }

    if (state.status === 'error') {
        result.classList.add('hidden');
        showError(state.error || 'Opportunity could not be saved');
        saveButton.textContent = 'Try again';
        return;
    }

    if (state.status === 'queued') {
        clearStatus();
        resultSuccessBadge.textContent = '✓ Safely captured';
        resultCategory.textContent = 'Processing';
        resultDeadline.textContent = 'You can close Chrome';
        resultDeadline.classList.remove('result-deadline-passed');
        result.classList.remove('hidden');
        return;
    }

    clearStatus();
    const saved = state.result || {};
    const opportunity = saved.opportunity || {};
    const deadline = formatResultDeadline(opportunity.deadline_at, opportunity.deadline_raw);
    resultSuccessBadge.textContent = saved.is_duplicate ? '✓ Already saved' : '✓ Captured successfully';
    resultCategory.textContent = String(opportunity.category || 'other').replaceAll('_', ' ');
    resultDeadline.textContent = deadline.label;
    resultDeadline.classList.toggle('result-deadline-passed', deadline.hasPassed);
    result.classList.remove('hidden');
};

const openDashboard = async () => {
    clearStatus();
    try {
        const response = await sendRuntimeMessage<any>({ type: 'OPEN_DASHBOARD' });
        if (!response?.ok) throw new Error(response?.error || 'Dashboard could not be opened');
    } catch (error) {
        showError(error instanceof Error ? error.message : 'Dashboard could not be opened');
    }
};

const renderCachedAuth = async () => {
    const cached = await webext.storage.local.get(AUTH_CACHE_KEY);
    if (cached?.[AUTH_CACHE_KEY]?.signedIn) applyAuthState(cached[AUTH_CACHE_KEY]);
};

const renderState = async () => {
    const response = await sendRuntimeMessage<any>({ type: 'AUTH_STATE' });
    if (!response?.ok) throw new Error(response?.error || 'Your tracker session could not be checked');
    applyAuthState(response.data);
};

const loadActiveTab = async () => {
    activeTab = await getActiveTab();
    targetCard.classList.remove('is-scanning');
    pageTitle.textContent = activeTab?.url ? (activeTab.title || 'Untitled page') : 'This tab cannot be captured';
    syncSaveButton();
    return activeTab;
};

document.addEventListener('DOMContentLoaded', () => {
    void renderCachedAuth();
    void loadActiveTab().catch((error) => {
        targetCard.classList.remove('is-scanning');
        pageTitle.textContent = 'This tab cannot be captured';
        showError(error instanceof Error ? error.message : 'The page could not be read.');
        syncSaveButton();
    });
    void renderState().catch((error) => {
        if (!signedIn) applyAuthState({ signedIn: false, profile: null });
        showError(error instanceof Error ? error.message : 'Your tracker session could not be checked.');
    });
    void sendRuntimeMessage<any>({ type: 'GET_CAPTURE_STATE' }).then((response) => {
        if (response?.ok) applyCaptureState(response.data);
    });
});

webext.storage.onChanged.addListener((changes: any, areaName: string) => {
    if ((areaName === 'session' || areaName === 'local') && changes[CAPTURE_STATE_KEY]) {
        applyCaptureState(changes[CAPTURE_STATE_KEY].newValue || null);
    }
    if (areaName === 'local' && changes[AUTH_CACHE_KEY]?.newValue?.signedIn) {
        applyAuthState(changes[AUTH_CACHE_KEY].newValue);
    }
});

signInButton.addEventListener('click', async () => {
    try {
        signInButton.disabled = true;
        signInButton.textContent = 'Opening Google…';
        clearStatus();
        const response = await sendRuntimeMessage<any>({ type: 'AUTH_LOGIN' });
        if (!response?.ok) throw new Error(response?.error || 'Sign in failed');
        if (response.data?.pending) {
            status.textContent = 'Finish Google sign-in in the Safari tab, then reopen this panel.';
            return;
        }
        applyAuthState(response.data);
    } catch (error) {
        showError(error instanceof Error ? error.message : 'Sign in failed');
    } finally {
        signInButton.disabled = false;
        signInButton.textContent = 'Continue with Google →';
    }
});

logoutButton.addEventListener('click', async () => {
    clearStatus();
    logoutButton.disabled = true;
    logoutButton.textContent = 'Logging out…';
    try {
        const response = await sendRuntimeMessage<any>({ type: 'AUTH_LOGOUT' });
        if (!response?.ok) throw new Error(response?.error || 'Log out failed');
        applyAuthState(response.data);
    } catch (error) {
        showError(error instanceof Error ? error.message : 'Log out failed');
    } finally {
        logoutButton.disabled = false;
        logoutButton.textContent = 'Log out';
    }
});

dashboardButton.addEventListener('click', openDashboard);
closeProgressButton.addEventListener('click', () => window.close());

saveButton.addEventListener('click', async () => {
    clearStatus();
    result.classList.add('hidden');
    applyCaptureState({ id: 'pending', status: 'capturing', startedAt: Date.now() });

    try {
        const captureTab = await loadActiveTab();
        if (!captureTab?.url) throw new Error('Open a normal webpage and try again.');
        const response = await sendRuntimeMessage<any>({
            type: 'START_CAPTURE',
            tabId: captureTab.id,
            url: captureTab.url,
            title: captureTab.title || '',
        });
        if (!response?.ok) throw new Error(response?.error || 'Opportunity could not be captured');
        applyCaptureState(response.data);
    } catch (error) {
        applyCaptureState({
            id: 'failed',
            status: 'error',
            startedAt: Date.now(),
            error: error instanceof Error ? error.message : 'Opportunity could not be captured',
        });
    }
});
