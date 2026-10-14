import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { consumeOpportunityAiLimit } from '../../src/lib/opportunities/rateLimit';

describe('Opportunity AI rate limiting', () => {
    it('keeps short-window abuse protection without imposing a daily quota', async () => {
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
});
