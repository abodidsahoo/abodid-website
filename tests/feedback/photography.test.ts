import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import seeds from '../../src/data/feedbackForms.seed.json';
import collections from '../../src/data/photographyCollections.json';
import { createReceipt, readReceipt, followUpToken, NIFT_SLUG, RECEIPT_COOKIE } from '../../src/lib/feedback/receipt';
const mocks = vi.hoisted(() => ({ getFeedbackForm: vi.fn(), feedbackClient: vi.fn(), loadIdentity: vi.fn() }));
vi.mock('../../src/lib/feedback/server', () => mocks);
vi.mock('../../src/lib/feedback/identity', async (original) => ({ ...await original<any>(), loadIdentity: mocks.loadIdentity }));
import { POST } from '../../src/pages/nift-workshop-resources/follow-up';
const responseId = 'a7b0b28e-398b-46b0-a1e6-1fed1241a11b';
let receipt: string; let token: string; let results: any[]; let chain: any; let upsert: any;
beforeEach(() => {
    vi.clearAllMocks(); vi.stubEnv('FEEDBACK_RECEIPT_SECRET', 'private-photography-test-secret');
    receipt = createReceipt(NIFT_SLUG, responseId); token = followUpToken(readReceipt(receipt, NIFT_SLUG)!);
    results = [{ data: { id: responseId, metadata: {} }, error: null }, { error: null }];
    chain = {}; for (const method of ['select', 'eq', 'in', 'maybeSingle']) chain[method] = vi.fn(() => chain);
    upsert = vi.fn(() => chain); chain.upsert = upsert;
    chain.then = (resolve: any, reject: any) => Promise.resolve(results.shift()).then(resolve, reject);
    mocks.feedbackClient.mockReturnValue({ from: vi.fn(() => chain) });
    mocks.getFeedbackForm.mockImplementation(async (slug) => slug === NIFT_SLUG ? { ...seeds[1], id: 'nift-form-id' } : { ...collections[1], id: 'interest-form-id', is_open: true, form_version: 1 });
    mocks.loadIdentity.mockResolvedValue({ id: responseId, name: 'Original student', email: 'original@example.com' });
});
afterEach(() => vi.unstubAllEnvs());
const submit = (fields: Record<string, string>, options: { receipt?: string; origin?: string; native?: boolean } = {}) => POST({
    request: new Request('https://abodid.com/nift-workshop-resources/follow-up', { method: 'POST', body: new URLSearchParams({ follow_up_token: token, ...fields }), headers: { Origin: options.origin || 'https://abodid.com', Accept: options.native ? 'text/html' : 'application/json' } }),
    cookies: { get: (name: string) => name === RECEIPT_COOKIE ? { value: options.receipt ?? receipt } : undefined },
    redirect: (location: string, status: number) => new Response(null, { status, headers: { Location: location } }),
} as any);

describe('independent photography collections', () => {
    it('saves interest in its own form without modifying lecture answers or collecting album thoughts', async () => {
        const response = await submit({ kind: 'interest', photography_interest: 'on', album_thoughts: 'Ignore this', response_id: 'spoofed', name: 'Spoofed', email: 'spoofed@example.com' });
        expect(await response.json()).toEqual({ ok: true });
        expect(upsert).toHaveBeenCalledWith(expect.objectContaining({ form_id: 'interest-form-id', submission_key: responseId, participant_name: 'Original student', participant_email: 'original@example.com', answers: { interested: 'Yes, I am interested.' }, metadata: expect.objectContaining({ source_response_id: responseId, participant_id: responseId }) }), { onConflict: 'form_id,submission_key' });
        expect(JSON.stringify(upsert.mock.calls)).not.toContain('Ignore this'); expect(chain.eq).not.toHaveBeenCalledWith('id', 'spoofed');
        expect(chain.select.mock.calls.flat().join(',')).not.toContain('private_follow_up');
    });
    it('lets the same participant withdraw interest without creating duplicates', async () => {
        expect((await submit({ kind: 'interest' })).status).toBe(200);
        expect(upsert).toHaveBeenCalledWith(expect.objectContaining({ submission_key: responseId, answers: { interested: 'Not right now.' } }), expect.anything());
    });
    it('opens the independent album page with a shared identity cookie, without saving an album response or interest', async () => {
        const response = await submit({ kind: 'album' }, { native: true });
        expect(response.status).toBe(303); expect(response.headers.get('Location')).toBe('/photo-album-feedback');
        expect(response.headers.get('Set-Cookie')).toContain('feedback_participant='); expect(response.headers.get('Set-Cookie')).toContain('HttpOnly');
        expect(upsert).not.toHaveBeenCalled();
    });
    it('requires the existing signed receipt and matching CSRF token', async () => {
        expect((await submit({ kind: 'interest' }, { receipt: '' })).status).toBe(403);
        expect((await submit({ kind: 'interest', follow_up_token: 'bad' })).status).toBe(403);
        expect(mocks.feedbackClient).not.toHaveBeenCalled();
    });
    it('rejects cross-site requests before accessing storage', async () => {
        expect((await submit({ kind: 'interest' }, { origin: 'https://another.example' })).status).toBe(403);
        expect(mocks.feedbackClient).not.toHaveBeenCalled();
    });
    it('rejects unknown collection kinds and invalid checkbox values', async () => {
        expect((await submit({ kind: 'invented' })).status).toBe(400);
        expect((await submit({ kind: 'interest', photography_interest: 'yes' })).status).toBe(400); expect(upsert).not.toHaveBeenCalled();
    });
    it('rejects missing lecture receipts and keeps database errors private', async () => {
        results = [{ data: null, error: null }]; expect((await submit({ kind: 'interest' })).status).toBe(404);
        results = [{ data: { id: responseId, metadata: {} }, error: null }, { error: { code: 'failure', message: 'Private DB detail' } }];
        const response = await submit({ kind: 'interest' }); expect(response.status).toBe(503); expect(await response.text()).not.toContain('Private DB detail');
    });
    it('supports native interest submission without JavaScript', async () => {
        const response = await submit({ kind: 'interest', photography_interest: 'on' }, { native: true });
        expect(response.status).toBe(303); expect(response.headers.get('Location')).toBe('/nift-workshop-resources?interest=saved#photography');
        expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    });
});
