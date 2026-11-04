import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createReceipt, NIFT_SLUG, RECEIPT_COOKIE } from '../../src/lib/feedback/receipt';
import { GET } from '../../src/pages/nift-workshop-resources/access.json';
beforeEach(() => vi.stubEnv('FEEDBACK_RECEIPT_SECRET', 'resource-access-test-secret'));
afterEach(() => vi.unstubAllEnvs());
const access = (token = '') => GET({ request: new Request('https://abodid.com/nift-workshop-resources/access.json', { headers: { Cookie: `${RECEIPT_COOKIE}=${token}` } }) } as any);
describe('resource access restoration', () => {
    it('does not unlock first-time visitors or invalid receipts', async () => {
        for (const token of ['', 'submitted', createReceipt('other-form', 'other-response')]) {
            const response = await access(token);
            expect(await response.json()).toEqual({ unlocked: false });
            expect(response.headers.get('Set-Cookie')).toBeNull();
        }
    });
    it('promotes a valid receipt without exposing the token or contact data', async () => {
        const response = await access(createReceipt(NIFT_SLUG, 'saved-response-id'));
        expect(await response.json()).toEqual({ unlocked: true });
        const cookies = response.headers.getSetCookie();
        expect(cookies).toHaveLength(2);
        expect(cookies[0]).toContain('Path=/;'); expect(cookies[0]).toContain('HttpOnly');
        expect(cookies[1]).toContain('Path=/nift-workshop-resources; Max-Age=0');
        expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    });
});
