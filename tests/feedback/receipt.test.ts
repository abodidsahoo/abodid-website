import { afterEach, describe, expect, it, vi } from 'vitest';
import { createReceipt, verifyReceipt, receiptCookie, requestReceipt, NIFT_SLUG } from '../../src/lib/feedback/receipt';

describe('feedback resource access receipt', () => {
    it('accepts only intact receipts signed for the same collection', () => {
        const token = createReceipt(NIFT_SLUG, 'saved-response-id', 'test-secret');
        expect(verifyReceipt(token, NIFT_SLUG, 'test-secret')).toBe(true);
        expect(verifyReceipt(token, 'other-workshop', 'test-secret')).toBe(false);
        expect(verifyReceipt(token, NIFT_SLUG, 'wrong-secret')).toBe(false);
        expect(verifyReceipt(token + 'tampered', NIFT_SLUG, 'test-secret')).toBe(false);
        expect(verifyReceipt('submitted=1', NIFT_SLUG, 'test-secret')).toBe(false);
    });
    it('expires receipts after 30 days', () => {
        vi.useFakeTimers();
        const token = createReceipt(NIFT_SLUG, 'saved-response-id', 'test-secret');
        vi.advanceTimersByTime(31 * 86400_000);
        expect(verifyReceipt(token, NIFT_SLUG, 'test-secret')).toBe(false);
        vi.useRealTimers();
    });
    it('keeps receipts HTTP-only and available to both tabs, with Secure on HTTPS', () => {
        const cookie = receiptCookie('token', new Request('https://abodid.com/api/feedback/nift'));
        expect(cookie).toContain('Path=/;');
        expect(cookie).not.toContain('Path=/nift-workshop-resources');
        expect(cookie).toContain('HttpOnly; SameSite=Lax; Secure');
        expect(receiptCookie('token', new Request('http://localhost:4321'))).not.toContain('; Secure');
    });
});


describe('legacy receipt restoration', () => {
    afterEach(() => { vi.unstubAllEnvs(); vi.useRealTimers(); });
    it('chooses the latest valid proof when old and new cookie paths coexist', () => {
        vi.stubEnv('FEEDBACK_RECEIPT_SECRET', 'migration-test-secret'); vi.useFakeTimers();
        const old = createReceipt(NIFT_SLUG, 'old-response');
        vi.advanceTimersByTime(1000);
        const latest = createReceipt(NIFT_SLUG, 'latest-response');
        const request = new Request('https://abodid.com/nift-workshop-resources', { headers: { Cookie: `nift_lecture_receipt=${old}; nift_lecture_receipt=${latest}` } });
        expect(requestReceipt(request)?.receipt.id).toBe('latest-response');
    });
    it('ignores altered proofs rather than allowing a stored receipt flag to grant access', () => {
        vi.stubEnv('FEEDBACK_RECEIPT_SECRET', 'migration-test-secret');
        expect(requestReceipt(new Request('https://abodid.com', { headers: { Cookie: 'nift_lecture_receipt=submitted' } }))).toBeNull();
    });
});
