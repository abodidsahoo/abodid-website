export interface WelcomeState {
    busy: 'checking' | 'signing-in' | null;
    signedIn: boolean;
    pending: boolean;
    error: string;
}
export interface WelcomeResponse {
    ok: boolean;
    data?: { signedIn?: boolean; pending?: boolean };
    error?: string;
}
type WelcomeRequest = (message: { type: 'AUTH_STATE' | 'AUTH_LOGIN' }) => Promise<WelcomeResponse>;

/** Uses the extension session, without capturing any page or consuming AI attempts. */
export function createWelcomeFlow(request: WelcomeRequest, render: (state: WelcomeState) => void) {
    let state: WelcomeState = { busy: null, signedIn: false, pending: false, error: '' };
    const update = (patch: Partial<WelcomeState>) => { state = { ...state, ...patch }; render({ ...state }); };
    return {
        getState: () => ({ ...state }),
        async checkSession() {
            if (state.busy) return;
            update({ busy: 'checking' });
            try {
                const response = await request({ type: 'AUTH_STATE' });
                if (!response.ok) throw new Error(response.error || 'Sign-in could not be checked.');
                const signedIn = response.data?.signedIn === true;
                update({ signedIn, pending: signedIn ? false : state.pending });
            } catch {
                update({ error: 'Could not check sign-in. You can still get started.' });
            } finally { update({ busy: null }); }
        },
        async start() {
            if (state.busy || state.signedIn) return;
            update({ busy: 'signing-in', error: '', pending: false });
            try {
                const response = await request({ type: 'AUTH_LOGIN' });
                if (!response.ok) throw new Error(response.error || 'Google sign-in could not start. Please try again.');
                if (response.data?.signedIn !== true && response.data?.pending !== true) {
                    throw new Error('Google sign-in did not finish. Please try again.');
                }
                update({ signedIn: response.data?.signedIn === true, pending: response.data?.pending === true && response.data?.signedIn !== true });
            } catch (error) {
                update({ error: error instanceof Error ? error.message : 'Google sign-in could not start. Please try again.' });
            } finally { update({ busy: null }); }
        },
    };
}
