export type CaptureState = {
    id: string;
    status: 'capturing' | 'queued' | 'success' | 'error';
    startedAt: number;
    tabId?: number;
    url?: string;
    title?: string;
    userId?: string;
    operationId?: string;
    result?: any;
    error?: string;
};

/** Accepted jobs and final receipts remain available until replaced or signed out. */
export function restoreStoredCapture(state: CaptureState | null, now = Date.now()): CaptureState | null {
    if (state?.status === 'capturing' && now - state.startedAt > 5 * 60 * 1000) {
        return { ...state, status: 'error', error: 'Sending was interrupted. Try saving this page again; duplicate opportunities will not be added.' };
    }
    return state;
}

export function isOlderCaptureUpdate(current: CaptureState | null, next: CaptureState): boolean {
    if (!current) return false;
    if (current.startedAt > next.startedAt) return true;
    return current.id === next.id
        && (current.status === 'success' || current.status === 'error')
        && (next.status === 'capturing' || next.status === 'queued');
}
