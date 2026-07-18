import type { APIRoute } from 'astro';
import {
    emptyAnalyticsReport,
    getAnalyticsRangeStart,
    normalizeAnalyticsRange,
    normalizeAnalyticsTrafficClass,
} from '../../../lib/analytics/reporting.js';
import { createSupabaseServiceClient } from '../../../lib/supabaseServer';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
        const trafficClass = normalizeAnalyticsTrafficClass(url.searchParams.get('traffic'));
        const submissionId = url.searchParams.get('submission') || '';
        const newsletterSubmissionId = url.searchParams.get('newsletterSubmission') || '';
        let focusedJourney = null;
        const focusId = submissionId || newsletterSubmissionId;
        if (focusId) {
            if (!UUID_PATTERN.test(focusId)) return json({ error: 'Invalid notification reference.' }, 400);
            const focusTable = newsletterSubmissionId ? 'newsletter_submissions' : 'contact_submissions';
            const { data: submission } = await supabase
                .from(focusTable)
                .select('session_id, submitted_at')
                .eq('id', focusId)
                .single();
            if (!submission) return json({ error: 'The enquiry visit could not be found.' }, 404);

            const [{ data: exactSession }, { data: exactPages }] = await Promise.all([
                supabase
                    .from('analytics_sessions')
                    .select('id, source, country, landing_page, exit_page, started_at, ended_at, total_engaged_seconds')
                    .eq('id', submission.session_id)
                    .single(),
                supabase
                    .from('analytics_page_views')
                    .select('page_path, page_title, sequence_number, viewed_at, engaged_seconds')
                    .eq('session_id', submission.session_id)
                    .lte('viewed_at', submission.submitted_at)
                    .order('sequence_number', { ascending: true })
                    .order('viewed_at', { ascending: true }),
            ]);
            if (exactSession) {
                focusedJourney = {
                    id: exactSession.id,
                    source: exactSession.source,
                    country: exactSession.country,
                    landingPage: exactSession.landing_page,
                    exitPage: exactPages?.at(-1)?.page_path || exactSession.exit_page,
                    startedAt: exactSession.started_at,
                    endedAt: submission.submitted_at,
                    totalEngagedSeconds: (exactPages || []).reduce((sum, page) => sum + Math.max(0, Number(page.engaged_seconds) || 0), 0),
                    pages: (exactPages || []).map((page) => ({
                        path: page.page_path,
                        title: page.page_title,
                        sequenceNumber: page.sequence_number,
                        viewedAt: page.viewed_at,
                        engagedSeconds: page.engaged_seconds,
                    })),
                };
            }
        }
        const timezoneOffset = Number(url.searchParams.get('timezoneOffset') || 0);
        const startAt = getAnalyticsRangeStart(range, new Date(), timezoneOffset);
        const reportArgs = {
            p_start_at: startAt.toISOString(),
            p_traffic_class: trafficClass,
        };
        const [trafficResult, navigationResult] = await Promise.all([
            supabase.rpc('analytics_build_report', reportArgs),
            supabase.rpc('analytics_build_navigation_report', reportArgs),
        ]);

        if (trafficResult.error) {
            console.error('[analytics] Admin report failed:', trafficResult.error.message);
            return json({ error: 'Analytics data is not available yet.' }, 503);
        }

        if (navigationResult.error) {
            console.warn('[analytics] Navigation report is not available yet:', navigationResult.error.message);
        }

        const emptyReport = emptyAnalyticsReport();
        const report = {
            ...emptyReport,
            ...(trafficResult.data || {}),
            navigation: navigationResult.data || emptyReport.navigation,
        };

        return json({
            range,
            trafficClass,
            startAt: startAt.toISOString(),
            generatedAt: new Date().toISOString(),
            report,
            focusedJourney,
        });
    } catch (error) {
        console.error('[analytics] Admin endpoint failed:', error);
        return json({ error: 'Could not load analytics.' }, 500);
    }
};
