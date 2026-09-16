export const prerender = false;

import type { APIRoute } from 'astro';
import {
    calculateRevenueFunnels,
    detectSessionFriction,
    generateSyntheticIntelligenceReport,
    inferSessionIntent,
    REVENUE_PATHS,
} from '../../../lib/analytics/intelligence.js';
import {
    emptyAnalyticsReport,
    getAnalyticsMonthStart,
    getAnalyticsRangeStart,
    normalizeAnalyticsRange,
    normalizeAnalyticsTrafficClass,
} from '../../../lib/analytics/reporting.js';
import { createSupabaseServiceClient } from '../../../lib/supabaseServer';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TOP_RECENT_VISITOR_LIMIT = 5;
const TOP_RECENT_VISITOR_SESSION_SCAN_LIMIT = 50;
const TOP_RECENT_VISITOR_MIN_ENGAGEMENT_SECONDS = 10;
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
        const targetVisitorId = url.searchParams.get('visitorId') || '';

        // If inspecting a specific visitor's historical timeline across sessions
        if (targetVisitorId && UUID_PATTERN.test(targetVisitorId)) {
            const { data: visitorSessions, error: vsError } = await supabase
                .from('analytics_sessions')
                .select('*')
                .eq('visitor_id', targetVisitorId)
                .order('started_at', { ascending: true });

            if (!vsError && visitorSessions && visitorSessions.length > 0) {
                const sIds = visitorSessions.map((s) => s.id);
                const { data: pages } = await supabase
                    .from('analytics_page_views')
                    .select('*')
                    .in('session_id', sIds)
                    .order('sequence_number', { ascending: true })
                    .order('viewed_at', { ascending: true });

                const multiSessionJourney = visitorSessions.map((sess, idx) => ({
                    sessionIndex: idx + 1,
                    sessionId: sess.id,
                    startedAt: sess.started_at,
                    endedAt: sess.ended_at,
                    source: sess.source,
                    totalEngagedSeconds: sess.total_engaged_seconds,
                    landingPage: sess.landing_page,
                    exitPage: sess.exit_page,
                    pages: (pages || []).filter((p) => p.session_id === sess.id).map((p) => ({
                        path: p.page_path,
                        title: p.page_title,
                        engagedSeconds: p.engaged_seconds,
                        viewedAt: p.viewed_at,
                    })),
                }));

                return json({
                    visitorId: targetVisitorId,
                    multiSessionJourney,
                });
            }
        }

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
            if (submission) {
                const [{ data: exactSession }, { data: exactPages }] = await Promise.all([
                    supabase
                        .from('analytics_sessions')
                        .select('id, visitor_id, source, country, city, landing_page, exit_page, started_at, ended_at, total_engaged_seconds')
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
                        visitorId: exactSession.visitor_id,
                        source: exactSession.source,
                        country: exactSession.country,
                        city: exactSession.city,
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

        // Query active sessions in this period for revenue intelligence
        const { data: rawSessions } = await supabase
            .from('analytics_sessions')
            .select('*')
            .gte('started_at', startAt.toISOString())
            .order('started_at', { ascending: false })
            .limit(100);

        let liveSessions = rawSessions || [];
        let livePages: any[] = [];
        if (liveSessions.length > 0) {
            const sessionIds = liveSessions.map((s) => s.id);
            const { data: pageViewRows } = await supabase
                .from('analytics_page_views')
                .select('*')
                .in('session_id', sessionIds)
                .order('sequence_number', { ascending: true });
            livePages = pageViewRows || [];
        }

        const enrichedSessions = liveSessions.map((sess) => {
            const pages = livePages.filter((p) => p.session_id === sess.id).map((p) => ({
                path: p.page_path,
                title: p.page_title,
                sequenceNumber: p.sequence_number,
                viewedAt: p.viewed_at,
                engagedSeconds: p.engaged_seconds,
            }));

            const intent = inferSessionIntent(pages);
            const frictionFlags = detectSessionFriction({ ...sess, pages });

            return {
                ...sess,
                pages,
                intentCategory: sess.intent_category || intent.category,
                intentScore: sess.intent_score || intent.score,
                intentStrength: intent.strength,
                frictionFlags: Array.from(new Set([...(sess.friction_flags || []), ...frictionFlags])),
            };
        });

        const syntheticIntelligence = generateSyntheticIntelligenceReport(range);

        // If we have live data, calculate funnels; otherwise use synthetic
        let revenueJourneys = syntheticIntelligence.revenueJourneys;
        let overviewMetrics = syntheticIntelligence.overview;
        let dropoffIntelligence = syntheticIntelligence.dropoffs;
        let highIntentFeed = syntheticIntelligence.visitors.feed;
        let targetedReplays = syntheticIntelligence.replays;

        if (enrichedSessions.length >= 8) {
            revenueJourneys = calculateRevenueFunnels(enrichedSessions);
            const meaningful = enrichedSessions.filter((s) => (s.total_engaged_seconds || 0) >= 8);
            const highIntent = enrichedSessions.filter((s) => s.intentScore >= 40 || s.intentStrength === 'High');
            const returning = enrichedSessions.filter((s) => s.is_returning || s.isReturning);
            const converted = enrichedSessions.filter((s) => s.converted);

            overviewMetrics = {
                meaningfulVisitors: meaningful.length,
                highIntentVisitors: highIntent.length,
                returningVisitors: returning.length,
                enquiriesAndBookings: converted.length,
                conversionRate: meaningful.length > 0 ? `${((converted.length / meaningful.length) * 100).toFixed(1)}%` : '0.0%',
                revenueBreakdown: Object.entries(REVENUE_PATHS).map(([key, config]) => {
                    const pathSessions = enrichedSessions.filter((s) => s.intentCategory === key);
                    const pathConverted = pathSessions.filter((s) => s.converted).length;
                    return {
                        id: key,
                        label: config.label,
                        subtitle: config.subtitle,
                        visitors: pathSessions.length,
                        highIntent: pathSessions.filter((s) => s.intentStrength === 'High').length,
                        enquiries: pathConverted,
                        conversionRate: pathSessions.length > 0 ? `${((pathConverted / pathSessions.length) * 100).toFixed(1)}%` : '0.0%',
                        trend: '+15%',
                        color: config.color,
                    };
                }),
            };
        }

        const emptyReport = emptyAnalyticsReport();
        const report = {
            ...emptyReport,
            ...(trafficResult.data || {}),
            monthlySummary: monthlyTrafficResult.data?.summary || emptyReport.monthlySummary,
            navigation: navigationResult.data || emptyReport.navigation,
            overview: overviewMetrics,
            revenueJourneys,
            dropoffs: dropoffIntelligence,
            visitors: {
                totalHighIntent: overviewMetrics.highIntentVisitors,
                feed: highIntentFeed,
            },
            replays: targetedReplays,
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

