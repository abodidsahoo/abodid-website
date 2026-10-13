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

export const consumeOpportunityAiLimit = async (serviceClient: SupabaseClient, userId: string) => {
    const [minuteLimit, dailyLimit] = await Promise.all([
        consumeLimit(serviceClient, `opportunity-minute:${userId}`, 10, 60),
        consumeLimit(serviceClient, `opportunity-day:${userId}`, 100, 24 * 60 * 60),
    ]);

    return {
        allowed: minuteLimit.allowed && dailyLimit.allowed,
        retryAfter: Math.max(minuteLimit.retryAfter, dailyLimit.retryAfter),
        unavailable: minuteLimit.unavailable || dailyLimit.unavailable,
    };
};
