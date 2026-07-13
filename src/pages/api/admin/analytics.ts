import type { APIRoute } from 'astro';
import {
    emptyAnalyticsReport,
    getAnalyticsRangeStart,
    normalizeAnalyticsRange,
} from '../../../lib/analytics/reporting.js';
import { createSupabaseServiceClient } from '../../../lib/supabaseServer';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
    status,
    headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
    },
});

export const GET: APIRoute = async ({ request, url }) => {
    try {
        const supabase = createSupabaseServiceClient();
        if (!supabase) return json({ error: 'Server configuration is incomplete.' }, 500);

        const authorization = request.headers.get('Authorization');
        const token = authorization?.startsWith('Bearer ')
            ? authorization.slice('Bearer '.length).trim()
            : '';
        if (!token) return json({ error: 'Unauthorized' }, 401);

        const {
            data: { user },
            error: authError,
        } = await supabase.auth.getUser(token);
        if (authError || !user) return json({ error: 'Unauthorized' }, 401);

        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();
        if (profileError || profile?.role !== 'admin') {
            return json({ error: 'Admin access required.' }, 403);
        }

        const range = normalizeAnalyticsRange(url.searchParams.get('range'));
        const timezoneOffset = Number(url.searchParams.get('timezoneOffset') || 0);
        const startAt = getAnalyticsRangeStart(range, new Date(), timezoneOffset);
        const { data, error } = await supabase.rpc('analytics_build_report', {
            p_start_at: startAt.toISOString(),
        });

        if (error) {
            console.error('[analytics] Admin report failed:', error.message);
            return json({ error: 'Analytics data is not available yet.' }, 503);
        }

        return json({
            range,
            startAt: startAt.toISOString(),
            generatedAt: new Date().toISOString(),
            report: data || emptyAnalyticsReport(),
        });
    } catch (error) {
        console.error('[analytics] Admin endpoint failed:', error);
        return json({ error: 'Could not load analytics.' }, 500);
    }
};
