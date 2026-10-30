import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { consumeOpportunityAiLimit } from '../../src/lib/opportunities/rateLimit';

describe('Opportunity AI rate limiting', () => {
    afterEach(() => vi.unstubAllEnvs());

    it('blocks a burst before reserving paid monthly capacity', async () => {
        const rpc = vi.fn(async (_name: string, params: { p_limit: number }) => ({
            data: [{
                allowed: params.p_limit !== 10,
                retry_after_seconds: 42,
            }],
            error: null,
        }));

        const result = await consumeOpportunityAiLimit({ rpc } as unknown as SupabaseClient, 'user-1');

        expect(result).toEqual({ allowed: false, retryAfter: 42, unavailable: false });
        expect(rpc).toHaveBeenCalledTimes(1);
        expect(rpc).toHaveBeenCalledWith(
            'consume_opportunity_ingestion_rate_limit',
            expect.objectContaining({ p_limit: 10, p_window_seconds: 60 }),
        );
    });

    it('distinguishes a quota backend error from an exhausted quota', async () => {
        const rpc = vi.fn(async () => ({
            data: null,
            error: { code: '42804', message: 'timestamp type mismatch' },
        }));

        const result = await consumeOpportunityAiLimit({ rpc } as unknown as SupabaseClient, 'user-1');

        expect(result).toEqual({ allowed: false, retryAfter: 0, unavailable: true });
    });

    const backend = (allowance: Record<string, unknown> | null, error: unknown = null) => vi.fn(async (name: string) => ({
        data: name === 'consume_opportunity_ingestion_rate_limit'
            ? [{ allowed: true, retry_after_seconds: 0 }]
            : allowance ? [allowance] : null,
        error: name === 'reserve_opportunity_ai_capture' ? error : null,
    }));

    it('defaults to five monthly captures and a shared concurrency limit, then releases its lease', async () => {
        vi.stubEnv('OPPORTUNITIES_AI_MONTHLY_LIMIT', '');
        vi.stubEnv('OPPORTUNITIES_AI_CONCURRENCY', '');
        const rpc = backend({ allowed: true, reason: 'allowed', lease_id: 'lease-1' });
        const result = await consumeOpportunityAiLimit({ rpc } as unknown as SupabaseClient, 'user-1');
        expect(result.allowed).toBe(true);
        expect(rpc).toHaveBeenCalledWith('reserve_opportunity_ai_capture', {
            p_user_id: 'user-1', p_monthly_limit: 5, p_global_concurrency: 4,
        });
        await result.release?.();
        expect(rpc).toHaveBeenCalledWith('release_opportunity_ai_capture', { p_lease_id: 'lease-1' });
    });

    it('honours a server-configured allowance of zero and bounds unsafe configuration', async () => {
        vi.stubEnv('OPPORTUNITIES_AI_MONTHLY_LIMIT', '0');
        vi.stubEnv('OPPORTUNITIES_AI_CONCURRENCY', '9999');
        const rpc = backend({ allowed: false, reason: 'monthly', retry_after_seconds: 3600 });
        const result = await consumeOpportunityAiLimit({ rpc } as unknown as SupabaseClient, 'user-2');
        expect(result).toMatchObject({ allowed: false, code: 'AI_MONTHLY_LIMIT_REACHED', retryAfter: 3600 });
        expect(result.message).toContain('saved opportunities are still available');
        expect(rpc).toHaveBeenCalledWith('reserve_opportunity_ai_capture', {
            p_user_id: 'user-2', p_monthly_limit: 0, p_global_concurrency: 4,
        });
    });

    it.each([
        [null, { code: 'PGRST202' }],
        [{ allowed: true }, null],
    ])('fails closed when reservation fails or returns no lease', async (allowance, error) => {
        const rpc = backend(allowance, error);
        const result = await consumeOpportunityAiLimit({ rpc } as unknown as SupabaseClient, 'user-1');
        expect(result).toMatchObject({ allowed: false, unavailable: true });
    });

    it('reports busy capacity without calling it a monthly exhaustion', async () => {
        const rpc = backend({ allowed: false, reason: 'busy', retry_after_seconds: 30 });
        const result = await consumeOpportunityAiLimit({ rpc } as unknown as SupabaseClient, 'user-1');
        expect(result).toMatchObject({ allowed: false, code: 'CAPTURE_LIMIT_REACHED', retryAfter: 30 });
    });

    it('rejects an anonymous identity at paid admission even in a service worker path', async () => {
        const rpc = backend({ allowed: false, reason: 'authentication', retry_after_seconds: 0 });
        const result = await consumeOpportunityAiLimit({ rpc } as unknown as SupabaseClient, 'anonymous-user');
        expect(result).toMatchObject({ allowed: false, status: 401, code: 'CAPTURE_AUTH_REQUIRED' });
    });
});
