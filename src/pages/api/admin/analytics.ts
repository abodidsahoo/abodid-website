import type { APIRoute } from 'astro';
import {
    emptyAnalyticsReport,
    getAnalyticsMonthStart,
    getAnalyticsRangeStart,
    normalizeAnalyticsRange,
    normalizeAnalyticsTrafficClass,
} from '../../../lib/analytics/reporting.js';
import { createSupabaseServiceClient } from '../../../lib/supabaseServer';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TOP_RECENT_VISITOR_LIMIT = 3;
const TOP_RECENT_VISITOR_SESSION_SCAN_LIMIT = 30;
const TOP_RECENT_VISITOR_MIN_ENGAGEMENT_SECONDS = 15;
const TOP_RECENT_VISITOR_LOOKBACK_DAYS = 95;

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
        const now = new Date();
        const startAt = getAnalyticsRangeStart(range, now, timezoneOffset);
        const monthStartAt = getAnalyticsMonthStart(now, timezoneOffset);
        const reportArgs = {
            p_start_at: startAt.toISOString(),
            p_traffic_class: trafficClass,
        };
        const monthlyReportArgs = {
            p_start_at: monthStartAt.toISOString(),
            p_traffic_class: 'human',
        };
        const [trafficResult, navigationResult, monthlyTrafficResult] = await Promise.all([
            supabase.rpc('analytics_build_report', reportArgs),
            supabase.rpc('analytics_build_navigation_report', reportArgs),
            supabase.rpc('analytics_build_report', monthlyReportArgs),
        ]);

        if (trafficResult.error) {
            console.error('[analytics] Admin report failed:', trafficResult.error.message);
            return json({ error: 'Analytics data is not available yet.' }, 503);
        }

        if (navigationResult.error) {
            console.warn('[analytics] Navigation report is not available yet:', navigationResult.error.message);
        }

        if (monthlyTrafficResult.error) {
            console.warn('[analytics] Monthly summary is not available yet:', monthlyTrafficResult.error.message);
        }

        // Automated user agents never reach analytics_sessions because the collector
        // rejects them. This stricter engagement threshold adds another confidence
        // signal for the three human visits surfaced most prominently in the UI.
        const recentVisitorCutoff = new Date(
            Date.now() - (TOP_RECENT_VISITOR_LOOKBACK_DAYS * 24 * 60 * 60 * 1000),
        ).toISOString();
        const { data: recentVisitorSessions, error: recentVisitorSessionsError } = await supabase
            .from('analytics_sessions')
            .select('id, visitor_id, source, country, landing_page, exit_page, started_at, ended_at, total_engaged_seconds')
            .gte('started_at', recentVisitorCutoff)
            .gt('total_engaged_seconds', TOP_RECENT_VISITOR_MIN_ENGAGEMENT_SECONDS)
            .order('started_at', { ascending: false })
            .limit(TOP_RECENT_VISITOR_SESSION_SCAN_LIMIT);

        if (recentVisitorSessionsError) {
            console.warn('[analytics] Top recent visitors are not available yet:', recentVisitorSessionsError.message);
        }

        const seenRecentVisitorIds = new Set();
        const distinctRecentVisitorSessions = (recentVisitorSessions || [])
            .filter((session) => {
                if (seenRecentVisitorIds.has(session.visitor_id)) return false;
                seenRecentVisitorIds.add(session.visitor_id);
                return true;
            })
            .slice(0, TOP_RECENT_VISITOR_LIMIT);
        const recentVisitorIds = distinctRecentVisitorSessions.map((session) => session.id);
        let recentVisitorPages = [];
        if (recentVisitorIds.length) {
            const { data, error } = await supabase
                .from('analytics_page_views')
                .select('session_id, page_path, page_title, sequence_number, viewed_at, engaged_seconds')
                .in('session_id', recentVisitorIds)
                .order('sequence_number', { ascending: true })
                .order('viewed_at', { ascending: true });
            if (error) {
                console.warn('[analytics] Top recent visitor navigation is not available yet:', error.message);
            } else {
                recentVisitorPages = data || [];
            }
        }

        const topRecentVisitors = distinctRecentVisitorSessions.map((session) => {
            const pages = recentVisitorPages
                .filter((page) => page.session_id === session.id)
                .map((page) => ({
                    path: page.page_path,
                    title: page.page_title,
                    sequenceNumber: page.sequence_number,
                    viewedAt: page.viewed_at,
                    engagedSeconds: page.engaged_seconds,
                }));

            return {
                id: session.id,
                source: session.source,
                country: session.country,
                landingPage: pages[0]?.path || session.landing_page,
                exitPage: pages.at(-1)?.path || session.exit_page,
                startedAt: session.started_at,
                endedAt: session.ended_at,
                totalEngagedSeconds: session.total_engaged_seconds,
                pages,
            };
        });

        const emptyReport = emptyAnalyticsReport();
        const report = {
            ...emptyReport,
            ...(trafficResult.data || {}),
            monthlySummary: monthlyTrafficResult.data?.summary || emptyReport.monthlySummary,
            topRecentVisitors,
            navigation: navigationResult.data || emptyReport.navigation,
        };

        return json({
            range,
            trafficClass,
            startAt: startAt.toISOString(),
            monthStartAt: monthStartAt.toISOString(),
            generatedAt: new Date().toISOString(),
            report,
            focusedJourney,
        });
    } catch (error) {
        console.error('[analytics] Admin endpoint failed:', error);
        return json({ error: 'Could not load analytics.' }, 500);
    }
};
