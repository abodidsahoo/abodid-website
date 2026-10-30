import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PRODUCT_UPDATES_CONSENT_TEXT, PRODUCT_UPDATES_CONSENT_VERSION } from '../../src/lib/opportunities/productUpdates';

const harness = vi.hoisted(() => ({ authorize: vi.fn(), from: vi.fn(), select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn(), upsert: vi.fn() }));
vi.mock('../../src/lib/opportunities/userAuth', async (original) => ({
    ...await original<typeof import('../../src/lib/opportunities/userAuth')>(), authorizeOpportunityRequest: harness.authorize,
}));
import { GET, POST } from '../../src/pages/api/opportunities/product-updates';

const user = { id: 'verified-user', email: 'person@example.org', email_confirmed_at: '2026-10-30T00:00:00Z' };
const body = { opt_in: true, source: 'onboarding', consent_version: PRODUCT_UPDATES_CONSENT_VERSION };
const post = (payload: unknown) => POST({ request: new Request('https://abodid.com/api/opportunities/product-updates', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
}) } as any);

beforeEach(() => {
    vi.resetAllMocks();
    harness.select.mockReturnValue(harness); harness.eq.mockReturnValue(harness);
    harness.from.mockReturnValue(harness);
    harness.maybeSingle.mockResolvedValue({ data: null, error: null });
    harness.upsert.mockResolvedValue({ error: null });
    harness.authorize.mockResolvedValue({ ok: true, user, serviceClient: { from: harness.from } });
});

describe('Authenticated product-update preferences', () => {
    it('requires authentication and never writes for rejected sessions', async () => {
        harness.authorize.mockResolvedValue({ ok: false, response: new Response('{}', { status: 401 }) });
        expect((await post(body)).status).toBe(401);
        expect(harness.from).not.toHaveBeenCalled();
    });

    it('saves explicit consent only for the verified token owner and address', async () => {
        expect((await post(body)).status).toBe(200);
        expect(harness.upsert).toHaveBeenCalledWith(expect.objectContaining({
            user_id: user.id, product_updates_opt_in: true, product_updates_email: user.email,
            product_updates_consent_text: PRODUCT_UPDATES_CONSENT_TEXT,
            product_updates_consent_version: PRODUCT_UPDATES_CONSENT_VERSION,
            product_updates_consent_source: 'onboarding', product_updates_opt_in_at: expect.any(String),
        }), { onConflict: 'user_id', defaultToNull: false });
    });

    it.each([
        { ...body, email: 'another@example.org' },
        { ...body, user_id: 'another-user' },
        { ...body, opt_in: 'true' },
        { ...body, consent_version: 'old' },
        { ...body, source: 'automatic-login' },
    ])('rejects forged identity or non-explicit consent: %j', async (payload) => {
        expect((await post(payload)).status).toBe(400);
        expect(harness.upsert).not.toHaveBeenCalled();
    });

    it('rejects an unverified email', async () => {
        harness.authorize.mockResolvedValue({ ok: true, user: { ...user, email_confirmed_at: null }, serviceClient: { from: harness.from } });
        expect((await post(body)).status).toBe(409);
        expect(harness.upsert).not.toHaveBeenCalled();
    });

    it('allows opting out while retaining the earlier consent audit fields', async () => {
        expect((await post({ ...body, opt_in: false, source: 'profile' })).status).toBe(200);
        const saved = harness.upsert.mock.calls[0][0];
        expect(saved).toMatchObject({ user_id: user.id, product_updates_opt_in: false, product_updates_opt_out_at: expect.any(String) });
        expect(saved).not.toHaveProperty('product_updates_opt_in_at');
        expect(saved).not.toHaveProperty('product_updates_consent_text');
    });

    it('defaults an account with no preference to false', async () => {
        const response = await GET({ request: new Request('https://abodid.com/api/opportunities/product-updates?user_id=other') } as any);
        expect(await response.json()).toEqual({ opt_in: false });
        expect(harness.eq).toHaveBeenCalledWith('user_id', user.id);
    });

    it('does not transfer consent to a changed account email', async () => {
        harness.maybeSingle.mockResolvedValue({ data: { product_updates_opt_in: true, product_updates_email: 'old@example.org' }, error: null });
        expect(await (await GET({ request: new Request('https://abodid.com/api/opportunities/product-updates') } as any)).json()).toEqual({ opt_in: false });
    });

    it('loads a saved opt-in for the same verified email', async () => {
        harness.maybeSingle.mockResolvedValue({ data: { product_updates_opt_in: true, product_updates_email: 'PERSON@example.org' }, error: null });
        expect(await (await GET({ request: new Request('https://abodid.com/api/opportunities/product-updates') } as any)).json()).toEqual({ opt_in: true });
    });

    it('returns a retryable error if persistence fails', async () => {
        harness.upsert.mockResolvedValue({ error: { code: '503' } });
        expect((await post(body)).status).toBe(500);
    });
});
