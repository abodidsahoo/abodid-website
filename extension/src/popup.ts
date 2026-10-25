import { type CaptureState } from './captureState';
import { getActiveTab, requestSafariAppAccess, sendRuntimeMessage, webext } from './browser';

const AUTH_CACHE_KEY = 'opportunity-auth-cache-v1';
const CAPTURE_STATE_KEY = 'opportunity-capture-state-v1';

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
const resultSource = byId<HTMLElement>('result-source');
const resultSuccessBadge = byId<HTMLSpanElement>('result-success-badge');
const resultProcessing = byId<HTMLDivElement>('result-processing');
const resultProcessingTitle = byId<HTMLElement>('result-processing-title');
const resultProcessingDetail = byId<HTMLElement>('result-processing-detail');
const resultProcessingProgress = byId<HTMLElement>('result-processing-progress');
const resultDetails = byId<HTMLDivElement>('result-details');
const resultCategory = byId<HTMLElement>('result-category');
const resultDeadline = byId<HTMLElement>('result-deadline');
const saveButton = byId<HTMLButtonElement>('save-btn');
const signInButton = byId<HTMLButtonElement>('sign-in-btn');
const logoutButton = byId<HTMLButtonElement>('logout-btn');
const dashboardButton = byId<HTMLButtonElement>('dashboard-btn');

let activeTab: any = null;
let authResolved = false;
let signedIn = false;
let isCapturing = false;
let currentCaptureState: CaptureState | null = null;
let captureStateRevision = 0;
let capturePollTimer: ReturnType<typeof setTimeout> | undefined;

const setButtonLabel = (button: HTMLButtonElement, label: string, busy = false) => {
    const line = document.createElement('span');
    line.className = 'opp-busy-line';
    if (busy) {
        const dots = document.createElement('span');
        dots.className = 'opp-wave-dots';
        dots.setAttribute('aria-hidden', 'true');
        dots.append(document.createElement('i'), document.createElement('i'), document.createElement('i'));
        line.append(dots);
    }
    line.append(document.createTextNode(label));
    button.replaceChildren(line);
    button.classList.toggle('opp-waiting', busy);
    button.setAttribute('aria-busy', String(busy));
};

const syncSaveButton = () => {
    const savedCurrentPage = currentCaptureState?.status === 'success'
        && normalizePageUrl(currentCaptureState.url) === normalizePageUrl(activeTab?.url);
    if (isCapturing || savedCurrentPage) {
        saveButton.classList.add('hidden');
        return;
    }

    saveButton.classList.remove('hidden');
    if (!authResolved) {
        saveButton.disabled = true;
        setButtonLabel(saveButton, 'Finding your place…', true);
        return;
    }
    if (!signedIn) {
        saveButton.disabled = true;
        setButtonLabel(saveButton, 'Sign in to save', false);
        return;
    }
    if (!activeTab?.url) {
        saveButton.disabled = true;
        setButtonLabel(saveButton, 'Page unavailable', false);
        return;
    }
    saveButton.disabled = false;
    setButtonLabel(saveButton, 'Save opportunity', false);
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

const formatPageTitle = (title: unknown) => {
    if (typeof title !== 'string' || !title.trim()) return 'Untitled page';
    const simplified = title
        .replace(/\s*[·|—]\s*Opportunity Tracker(?:\s*[|·—]\s*.*)?$/i, '')
        .trim();
    return simplified || 'Opportunity page';
};

const normalizePageUrl = (value: unknown) => {
    if (typeof value !== 'string') return '';
    try {
        const url = new URL(value);
        url.hash = '';
        return url.toString();
    } catch {
        return value;
    }
};

const applyAuthState = (state: any) => {
    signedIn = Boolean(state?.signedIn);
    authResolved = true;
    authPanel.classList.toggle('hidden', signedIn);
    capturePanel.classList.toggle('hidden', !signedIn);
    profileRow.classList.toggle('hidden', !signedIn);
    profileRow.classList.remove('is-pending');
    if (signedIn) renderProfile(state.profile);
    if (!signedIn) {
        currentCaptureState = null;
        result.classList.add('hidden');
        captureProgress.classList.add('hidden');
        if (capturePollTimer) clearTimeout(capturePollTimer);
    }
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
    if (state && currentCaptureState) {
        if (state.startedAt < currentCaptureState.startedAt) return;
        if (state.id === currentCaptureState.id && currentCaptureState.status === 'success' && state.status !== 'success') return;
        if (state.id === currentCaptureState.id && state.status === 'capturing' && currentCaptureState.status !== 'capturing') return;
    }
    currentCaptureState = state;
    isCapturing = state?.status === 'capturing' || state?.status === 'queued';
    captureProgress.classList.toggle('hidden', state?.status !== 'capturing');
    result.classList.add('hidden');
    clearStatus();
    syncSaveButton();
    if (capturePollTimer) clearTimeout(capturePollTimer);
    if (!state || state.status === 'capturing') return;

    const differentPage = normalizePageUrl(state.url) !== normalizePageUrl(activeTab?.url);
    resultSource.textContent = differentPage ? (state.title || state.url || '') : '';
    resultSource.classList.toggle('hidden', !differentPage);
    result.classList.toggle('is-processing', state.status === 'queued');
    result.classList.toggle('is-error', state.status === 'error');
    resultProcessing.classList.add('hidden');
    resultDetails.classList.add('hidden');
    resultProcessingProgress.classList.add('hidden');
    result.classList.remove('hidden');

    if (state.status === 'error') {
        resultSuccessBadge.textContent = 'Could not save';
        resultProcessingTitle.textContent = 'Please try again';
        resultProcessingDetail.textContent = state.error || 'Opportunity could not be saved.';
        resultProcessing.classList.remove('hidden');
        setButtonLabel(saveButton, 'Try again', false);
        return;
    }
    if (state.status === 'queued') {
        resultSuccessBadge.textContent = 'Processing';
        resultProcessingTitle.textContent = 'Sorting the details. Saving you the tabs.';
        resultProcessingDetail.textContent = 'Your page is safely received. You can close this popup and check back here.';
        resultProcessingProgress.classList.remove('hidden');
        resultProcessing.classList.remove('hidden');
        capturePollTimer = setTimeout(() => { void restoreCaptureState(); }, 3000);
        return;
    }

    const saved = state.result || {};
    resultSuccessBadge.textContent = saved.is_duplicate ? '✓ Already saved' : '✓ Opportunity saved';
    const opportunity = saved.opportunity;
    if (opportunity) {
        const deadline = formatResultDeadline(opportunity.deadline_at, opportunity.deadline_raw);
        resultCategory.textContent = String(opportunity.category || 'other').replaceAll('_', ' ');
        resultDeadline.textContent = deadline.label;
        resultDeadline.classList.toggle('result-deadline-passed', deadline.hasPassed);
        resultDetails.classList.remove('hidden');
    }
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
    pageTitle.textContent = activeTab?.url ? formatPageTitle(activeTab.title) : 'This tab cannot be captured';
    syncSaveButton();
    return activeTab;
};

const restoreCaptureState = async () => {
    const revision = captureStateRevision;
    try {
        const response = await sendRuntimeMessage<any>({ type: 'GET_CAPTURE_STATE' });
        if (revision !== captureStateRevision) return;
        if (!response?.ok) throw new Error('Status could not be refreshed');
        applyCaptureState(response.data || null);
    } catch {
        // Keep the last durable receipt visible if a status refresh is offline.
        if (currentCaptureState?.status === 'queued') {
            capturePollTimer = setTimeout(() => { void restoreCaptureState(); }, 5000);
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    void (async () => {
        try {
            await loadActiveTab();
            const stored = await webext.storage.local.get(CAPTURE_STATE_KEY);
            if (!currentCaptureState && stored?.[CAPTURE_STATE_KEY]) applyCaptureState(stored[CAPTURE_STATE_KEY]);
            await restoreCaptureState();
        } catch (error) {
            showError(error instanceof Error ? error.message : 'The page could not be read.');
        }
    })();
    void (async () => {
        try {
            await renderCachedAuth();
            await renderState();
        } catch (error) {
            if (!signedIn) applyAuthState({ signedIn: false, profile: null });
            showError(error instanceof Error ? error.message : 'Your tracker session could not be checked.');
        }
    })();
});

webext.storage.onChanged.addListener((changes: any, areaName: string) => {
    if (areaName !== 'local') return;
    if (changes[CAPTURE_STATE_KEY]) {
        captureStateRevision += 1;
        applyCaptureState(changes[CAPTURE_STATE_KEY].newValue || null);
    }
    if (changes[AUTH_CACHE_KEY]) {
        applyAuthState(changes[AUTH_CACHE_KEY].newValue || { signedIn: false });
    }
});

signInButton.addEventListener('click', async () => {
    try {
        // Keep this as the first awaited call. Safari only grants callback-site
        // access while the sign-in click still carries a user gesture.
        const appAccessGranted = await requestSafariAppAccess();
        if (!appAccessGranted) {
            throw new Error('Allow access to abodid.com so Safari can finish Google sign-in.');
        }
        signInButton.disabled = true;
        setButtonLabel(signInButton, 'A quick hello to Google…', true);
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
        setButtonLabel(signInButton, 'Continue with Google →', false);
    }
});

logoutButton.addEventListener('click', async () => {
    clearStatus();
    logoutButton.disabled = true;
    setButtonLabel(logoutButton, 'Logging out…', true);
    try {
        const response = await sendRuntimeMessage<any>({ type: 'AUTH_LOGOUT' });
        if (!response?.ok) throw new Error(response?.error || 'Log out failed');
        applyAuthState(response.data);
    } catch (error) {
        showError(error instanceof Error ? error.message : 'Log out failed');
    } finally {
        logoutButton.disabled = false;
        setButtonLabel(logoutButton, 'Log out', false);
    }
});

dashboardButton.addEventListener('click', openDashboard);

saveButton.addEventListener('click', async () => {
    captureStateRevision += 1;
    clearStatus();
    result.classList.add('hidden');
    applyCaptureState({ id: 'pending', status: 'capturing', startedAt: Date.now(), url: activeTab?.url, title: activeTab?.title });

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
        if (currentCaptureState?.id === 'pending') applyCaptureState(response.data);
    } catch (error) {
        applyCaptureState({
            id: 'failed',
            status: 'error',
            startedAt: Date.now(),
            error: error instanceof Error ? error.message : 'Opportunity could not be captured',
        });
    }
});
