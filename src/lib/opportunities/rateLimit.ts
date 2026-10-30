import crypto from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

const consumeLimit = async (
    serviceClient: SupabaseClient,
    key: string,
    limit: number,
    windowSeconds: number,
) => {
    const keyHash = crypto.createHash('sha256').update(key).digest('hex');
    const { data, error } = await serviceClient.rpc('consume_opportunity_ingestion_rate_limit', {
        p_key_hash: keyHash,
        p_limit: limit,
        p_window_seconds: windowSeconds,
    });
    if (error || !data?.[0]) {
        console.error('Opportunity rate-limit check failed', {
            code: error?.code || 'MISSING_RESULT',
            message: error?.message || 'The quota function returned no result',
        });
        return { allowed: false, retryAfter: 0, unavailable: true };
    }

    const allowed = Boolean(data[0].allowed);
    return {
        allowed,
        // An allowed window can still report when it resets. That value must
        // not inflate the retry time of a different, blocked window.
        retryAfter: allowed ? 0 : Number(data[0].retry_after_seconds) || 60,
        unavailable: false,
    };
};

export const consumeOpportunityAiLimit = async (serviceClient: SupabaseClient, userId: string): Promise<{
    allowed: boolean; retryAfter: number; unavailable: boolean;
    code?: string; message?: string; status?: number; release?: () => Promise<void>;
}> => {
    const burst = await consumeLimit(serviceClient, `opportunity-minute:${userId}`, 10, 60);
    if (!burst.allowed) return burst;
    const configuredInteger = (value: unknown, fallback: number, min: number, max: number) => {
        const number = Number(value);
        return value !== undefined && value !== '' && Number.isInteger(number) && number >= min && number <= max
            ? number : fallback;
    };
    const { data, error } = await serviceClient.rpc('reserve_opportunity_ai_capture', {
        p_user_id: userId,
        p_monthly_limit: configuredInteger(process.env.OPPORTUNITIES_AI_MONTHLY_LIMIT, 5, 0, 10000),
        p_global_concurrency: configuredInteger(process.env.OPPORTUNITIES_AI_CONCURRENCY, 4, 1, 20),
    });
    const allowance = data?.[0];
    if (error || !allowance || (allowance.allowed && !allowance.lease_id)) {
        console.error('Opportunity AI allowance unavailable', { code: error?.code || 'MISSING_ALLOWANCE' });
        return { allowed: false, retryAfter: 0, unavailable: true };
    }
    return {
        allowed: allowance.allowed === true,
        retryAfter: allowance.allowed ? 0 : Number(allowance.retry_after_seconds) || 30,
        unavailable: false,
        status: allowance.reason === 'capacity' ? 409 : allowance.reason === 'authentication' ? 401 : 429,
        code: allowance.reason === 'capacity' ? 'SAVED_CAPACITY_REACHED' : allowance.reason === 'authentication' ? 'CAPTURE_AUTH_REQUIRED'
            : allowance.reason === 'monthly' ? 'AI_MONTHLY_LIMIT_REACHED' : 'CAPTURE_LIMIT_REACHED',
        message: allowance.reason === 'capacity' ? 'Your radar has 100 saved opportunities. Delete one to make room, or contact the Support team of Abodid & Co.' : allowance.reason === 'authentication' ? 'Sign in with Google before saving an opportunity.'
            : allowance.reason === 'monthly'
            ? 'You have used this month’s AI captures. Your allowance resets next month. Your saved opportunities are still available, along with your reminders. Request more credits from the Support team of Abodid & Co.'
            : 'Another capture is being processed. Please try again shortly.',
        release: async () => {
            if (!allowance.lease_id) return;
            try {
                const result = await serviceClient.rpc('release_opportunity_ai_capture', { p_lease_id: allowance.lease_id });
                if (result.error) console.error('Opportunity AI lease cleanup deferred', { code: result.error.code });
            } catch {
                console.error('Opportunity AI lease cleanup deferred');
            }
        },
    };
};
