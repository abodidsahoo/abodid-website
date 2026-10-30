import './welcome.css';
import { sendRuntimeMessage, webext } from './browser';
import { createWelcomeFlow, type WelcomeResponse } from './welcomeFlow';

const byId = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const startButton = byId<HTMLButtonElement>('get-started');
const start = byId<HTMLDivElement>('welcome-start');
const next = byId<HTMLElement>('welcome-next');
const copy = byId<HTMLParagraphElement>('welcome-copy');
const status = byId<HTMLParagraphElement>('welcome-status');
const error = byId<HTMLParagraphElement>('welcome-error');
const dashboard = byId<HTMLButtonElement>('open-radar');
let wasSignedIn = false;

const flow = createWelcomeFlow((message) => sendRuntimeMessage<WelcomeResponse>(message), (state) => {
    const signedInNow = state.signedIn && !wasSignedIn;
    document.querySelector('.ow-card')?.classList.toggle('is-ready', state.signedIn);
    if (state.signedIn !== wasSignedIn) {
        byId<HTMLHeadingElement>('welcome-title').textContent = state.signedIn ? 'Your radar is ready.' : 'From open tabs to open doors.';
    }
    wasSignedIn = state.signedIn;
    start.hidden = state.signedIn;
    next.hidden = !state.signedIn;
    copy.textContent = state.signedIn ? 'You’re signed in. Your next good find belongs on your radar.' : 'Your tracker is installed. Save your first opportunity in one click.';
    startButton.disabled = Boolean(state.busy);
    startButton.setAttribute('aria-busy', String(Boolean(state.busy)));
    startButton.textContent = state.busy === 'checking' ? 'Checking sign-in…' : state.busy === 'signing-in' ? 'Connecting to Google…' : 'Get started ↗';
    status.textContent = state.pending ? 'Finish Google sign-in in the tab that opened.' : '';
    error.textContent = state.error;
    error.hidden = !state.error;
    if (signedInNow) byId<HTMLHeadingElement>('first-save-title').focus({ preventScroll: true });
});

if (webext?.runtime?.id) {
    startButton.addEventListener('click', () => { void flow.start(); });
    window.addEventListener('focus', () => { void flow.checkSession(); });
    void flow.checkSession();
    dashboard.addEventListener('click', async () => {
        dashboard.disabled = true;
        try {
            const response = await sendRuntimeMessage<{ ok: boolean; error?: string }>({ type: 'OPEN_DASHBOARD' });
            if (!response.ok) throw new Error(response.error || 'Your radar could not be opened. Please try again.');
        } catch (failure) {
            error.textContent = failure instanceof Error ? failure.message : 'Your radar could not be opened. Please try again.';
            error.hidden = false;
        } finally { dashboard.disabled = false; }
    });
} else {
    // The packaged screen can be previewed over HTTP without starting a web OAuth session.
    startButton.textContent = 'Get started ↗';
    status.textContent = 'Preview only. Install the extension to get started.';
}
