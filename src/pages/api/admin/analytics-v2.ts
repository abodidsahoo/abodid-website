export const prerender = false;

import type { APIRoute } from 'astro';
import { authorizeAdminRequest, jsonResponse } from '../../../lib/admin/serverAuth';
import { getMostEngagedPage, isLegacySession, isVisibleSession, MIN_SESSION_SECONDS, RECENT_SESSION_LIMIT } from '../../../lib/analytics/session-journeys.js';
import { runGa4DashboardReport } from '../../../lib/analytics/ga4-reporting.js';
import { getAnalyticsRangeStart, normalizeAnalyticsRange } from '../../../lib/analytics/reporting.js';

const GA_CACHE_MS = 5 * 60 * 1000;
const gaCache = new Map<string, { expiresAt: number; value: unknown }>();
const LEAD_STATUSES = new Set(['unreviewed', 'qualified', 'unqualified', 'won', 'lost', 'spam']);

const cachedGa4Report = async (range: string) => {
    const cached = gaCache.get(range);
    if (cached && cached.expiresAt > Date.now()) return cached.value;
    const value = await runGa4DashboardReport({ range });
    gaCache.set(range, { value, expiresAt: Date.now() + GA_CACHE_MS });
    return value;
};

export const ga4Failure = (error: any) => {
    const category = error?.category || 'api';
    const messages: Record<string, string> = {
        configuration: 'GA4 configuration needs attention. ' + (error?.message || 'Check the server credential settings.'),
        authentication: 'Google rejected the GA4 credentials. Check whether the service-account key was revoked.',
        authorization: 'The GA4 service account lacks access to this property. Grant it Viewer access in Google Analytics.',
        request: 'Google rejected the GA4 property or report request. Check the property configuration.',
        api: 'Google Analytics could not be reached. Try refreshing shortly.',
    };
    return { available: false, category, error: messages[category] || messages.api };
};

// PostgREST caps responses; page through all matching views so no route is silently cut off.
const loadSessionPages = async (supabase: any, sessionIds: string[]) => {
    const data: any[] = [];
    for (let offset = 0; ; offset += 500) {
        const result = await supabase.from('analytics_page_views')
            .select('id, session_id, page_path, page_title, sequence_number, viewed_at, engaged_seconds')
            .in('session_id', sessionIds)
            .order('session_id').order('viewed_at').order('sequence_number').order('id')
            .range(offset, offset + 499);
        if (result.error) return { data: [], error: result.error };
        data.push(...(result.data || []));
        if ((result.data || []).length < 500) return { data, error: null };
    }
};

export const GET: APIRoute = async ({ request, url }) => {
    const authorization = await authorizeAdminRequest(request);
    if (!authorization.ok) return authorization.response;

    const range = normalizeAnalyticsRange(url.searchParams.get('range'));
    const timezoneOffset = Number(url.searchParams.get('timezoneOffset') || 0);
    const startAt = getAnalyticsRangeStart(range, new Date(), timezoneOffset);
    const { supabase } = authorization;

    const [gaResult, sessionsResult, latestResult] = await Promise.allSettled([
        cachedGa4Report(range),
        supabase
            .from('analytics_sessions')
            .select('id, visitor_id, started_at, ended_at, source, country, city, landing_page, exit_page, total_engaged_seconds, human_confidence_score, human_confidence_tier, human_signals, is_returning, device_type, device_label, intent_category, intent_score, referrer_domain, utm_source, utm_medium, utm_campaign, utm_term, utm_content', { count: 'exact' })
            .gte('started_at', startAt.toISOString())
            .or('total_engaged_seconds.gte.5,and(human_signals->>evidenceVersion.eq.2,human_confidence_tier.in.(meaningful,high_intent,exceptional))')
            .order('started_at', { ascending: false })
            .limit(RECENT_SESSION_LIMIT),
        supabase.from('analytics_sessions').select('started_at').order('started_at', { ascending: false }).limit(1),
    ]);

    const ga4 = gaResult.status === 'fulfilled'
        ? gaResult.value
        : ga4Failure(gaResult.reason);
    if (gaResult.status === 'rejected') {
        console.warn('[analytics-v2] GA4 report failed:', gaResult.reason?.message || gaResult.reason);
    }

    if (sessionsResult.status === 'rejected' || sessionsResult.value.error) {
        return jsonResponse({ error: 'Private journey reporting is not ready. Apply the latest analytics migration.' }, 503);
    }

    const sessions = (sessionsResult.value.data || []).filter(isVisibleSession);
    const warnings: string[] = [];
    if (latestResult.status === 'rejected' || latestResult.value.error) warnings.push('Could not check when collection last received a session.');
    const sessionIds = sessions.map((session) => session.id);
    let pages: any[] = [];
    let enquiries: any[] = [];
    let newsletterActions: any[] = [];

    if (sessionIds.length > 0) {
        const [pagesResult, enquiriesResult, newsletterResult] = await Promise.all([
            loadSessionPages(supabase, sessionIds),
            supabase
                .from('contact_submissions')
                .select('id, session_id, enquiry_title, submitted_at, lead_quality_status')
                .in('session_id', sessionIds)
                .order('submitted_at', { ascending: false }),
            supabase
                .from('newsletter_submissions')
                .select('id, session_id, source, subscriber_status, submitted_at')
                .in('session_id', sessionIds)
                .order('submitted_at', { ascending: false }),
        ]);
        if (pagesResult.error) return jsonResponse({ error: 'Could not load session page sequences. Try refreshing.' }, 503);
        if (enquiriesResult.error || newsletterResult.error) warnings.push('Some conversion details could not be loaded.');
        pages = pagesResult.data || [];
        enquiries = enquiriesResult.data || [];
        newsletterActions = newsletterResult.data || [];
    }

    const sessionsPerVisitor = new Map<string, number>();
    for (const session of sessions) {
        sessionsPerVisitor.set(session.visitor_id, (sessionsPerVisitor.get(session.visitor_id) || 0) + 1);
    }

    const journeyCards = sessions.flatMap((session) => {
        const sessionPages = pages
            .filter((page) => page.session_id === session.id)
            .map((page) => ({
                path: page.page_path,
                title: page.page_title,
                enteredAt: page.viewed_at,
                engagedSeconds: page.engaged_seconds,
                sequenceNumber: page.sequence_number,
            }));
        const enquiry = enquiries.find((item) => item.session_id === session.id) || null;
        const newsletter = newsletterActions.find((item) => item.session_id === session.id) || null;
        const conversion = enquiry
            ? { type: 'enquiry', label: enquiry.enquiry_title, submissionId: enquiry.id, status: enquiry.lead_quality_status }
            : newsletter
                ? { type: 'newsletter', label: newsletter.source, status: newsletter.subscriber_status }
                : null;

        const signals = session.human_signals || {};

        // Legacy rows are visible but explicitly unverified; duration is not proof of a person.
        if (conversion?.status === 'spam') return [];

        return [{
            id: session.id,
            visitorId: session.visitor_id,
            returning: Boolean(session.is_returning) || (sessionsPerVisitor.get(session.visitor_id) || 0) > 1,
            startedAt: session.started_at,
            endedAt: session.ended_at,
            source: session.source,
            attribution: {
                referrerDomain: session.referrer_domain || null,
                source: session.utm_source || null,
                medium: session.utm_medium || null,
                campaign: session.utm_campaign || null,
                term: session.utm_term || null,
                content: session.utm_content || null,
            },
            evidence: isLegacySession(session) ? 'legacy' : signals.evidenceVersion === 2 ? signals.evidenceLevel : 'older_measurement',
            mostEngagedPage: getMostEngagedPage(sessionPages),
            country: session.country,
            city: session.city,
            landingPage: session.landing_page,
            exitPage: session.exit_page,
            activeSeconds: session.total_engaged_seconds,
            confidenceScore: session.human_confidence_score,
            confidenceTier: session.human_confidence_tier,
            signals,
            intentCategory: session.intent_category || 'general',
            intentScore: session.intent_score || 0,
            device: { type: session.device_type, label: session.device_label },
            pages: sessionPages,
            conversion,
        }];
    });

    return jsonResponse({
        range,
        generatedAt: new Date().toISOString(),
        sourcePriority: ['GA4 acquisition and aggregate reporting', 'private first-party session journeys'],
        ga4,
        warnings,
        sessionFeed: {
            minimumSeconds: MIN_SESSION_SECONDS,
            limit: RECENT_SESSION_LIMIT,
            matchingSessions: sessionsResult.value.count || 0,
            latestCollectedAt: latestResult.status === 'fulfilled' ? latestResult.value.data?.[0]?.started_at || null : null,
        },
        journeys: journeyCards,
    });
};

export const PATCH: APIRoute = async ({ request }) => {
    const authorization = await authorizeAdminRequest(request);
    if (!authorization.ok) return authorization.response;

    const body = await request.json().catch(() => ({}));
    const submissionId = typeof body?.submissionId === 'string' ? body.submissionId : '';
    const status = typeof body?.status === 'string' ? body.status : '';
    if (!/^[0-9a-f-]{36}$/i.test(submissionId) || !LEAD_STATUSES.has(status)) {
        return jsonResponse({ error: 'Invalid lead-quality update.' }, 400);
    }

    const { error } = await authorization.supabase
        .from('contact_submissions')
        .update({ lead_quality_status: status, lead_quality_updated_at: new Date().toISOString() })
        .eq('id', submissionId);
    if (error) return jsonResponse({ error: 'Could not update lead quality.' }, 500);
    return jsonResponse({ ok: true, status });
};
