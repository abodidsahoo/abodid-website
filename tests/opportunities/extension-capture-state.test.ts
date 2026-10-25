import { describe, expect, it } from 'vitest';
import { restoreStoredCapture, isOlderCaptureUpdate, type CaptureState } from '../../extension/src/captureState';

const state = (status: CaptureState['status']): CaptureState => ({
    id: 'job-one', status, startedAt: 1000, url: 'https://example.org/opportunity',
});

describe('Extension capture receipt recovery', () => {
    it('keeps accepted work visible after long popup or browser closures', () => {
        const queued = state('queued');
        expect(restoreStoredCapture(queued, 1000 + 24 * 60 * 60 * 1000)).toBe(queued);
    });
    it('preserves saved and failed receipts until replaced or signed out', () => {
        for (const status of ['success', 'error'] as const) {
            const receipt = state(status);
            expect(restoreStoredCapture(receipt, 1000 + 7 * 24 * 60 * 60 * 1000)).toBe(receipt);
        }
    });
    it('makes an interrupted handoff retryable instead of showing processing forever', () => {
        expect(restoreStoredCapture(state('capturing'), 1000 + 6 * 60 * 1000))
            .toMatchObject({ status: 'error', url: 'https://example.org/opportunity', error: expect.stringContaining('interrupted') });
        expect(restoreStoredCapture(state('capturing'), 2000)?.status).toBe('capturing');
    });
    it('does not let a slow status response replace newer work or reopen completed work', () => {
        expect(isOlderCaptureUpdate({ ...state('capturing'), id: 'job-two', startedAt: 2000 }, state('success'))).toBe(true);
        expect(isOlderCaptureUpdate(state('success'), state('queued'))).toBe(true);
        expect(isOlderCaptureUpdate(state('queued'), state('success'))).toBe(false);
        expect(isOlderCaptureUpdate(state('capturing'), { ...state('queued'), id: 'server-job' })).toBe(false);
    });
});
