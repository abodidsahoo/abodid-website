import type { APIRoute } from 'astro';
import {
    classifyAcquisitionSource,
    cleanAnalyticsString,
    getReferrerDomain,
    isAnalyticsBot,
    isLocalAnalyticsUrl,
    isPreviewAnalyticsEnvironment,
    isSameOriginAnalyticsRequest,
    resolveAnalyticsCountry,
    resolveAnalyticsCity,
    shouldTrackAnalyticsPath,
} from '../../../lib/analytics/classification.js';
import { createSupabaseServiceClient } from '../../../lib/supabaseServer';

const MAX_BODY_BYTES = 12_000;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MENU_EVENT_NAMES = new Set(['menu_open', 'menu_dismiss', 'menu_link_click']);
const MENU_CONTEXTS = new Set(['mobile', 'desktop']);
const MENU_TARGET_TYPES = new Set(['primary', 'secondary', 'cta', 'social']);

const silentResponse = () => new Response(null, {
    status: 204,
    headers: { 'Cache-Control': 'no-store' },
});

const hasOwnerExclusionCookie = (request: Request) => request.headers
    .get('cookie')
    ?.split(';')
    .some((part) => part.trim() === 'abodid_analytics_exclude=1') ?? false;

const validUuid = (value: unknown) => typeof value === 'string' && UUID_PATTERN.test(value) ? value : '';

export const POST: APIRoute = async ({ request }) => {
    try {
        const vercelEnvironment = import.meta.env.VERCEL_ENV || process.env.VERCEL_ENV;
        if (isPreviewAnalyticsEnvironment({
            DEV: import.meta.env.DEV,
            MODE: import.meta.env.MODE,
            VERCEL_ENV: vercelEnvironment,
        })) return silentResponse();
        if (isLocalAnalyticsUrl(request.url)) return silentResponse();

        const contentLength = Number(request.headers.get('content-length') || 0);
        if (contentLength > MAX_BODY_BYTES) return silentResponse();
        if (hasOwnerExclusionCookie(request)) return silentResponse();
        if (isAnalyticsBot(request.headers.get('user-agent'))) return silentResponse();
        if (!isSameOriginAnalyticsRequest(request)) return silentResponse();

        const body = await request.json();
        const action = body?.action;
        const sessionId = validUuid(body?.sessionId);
        const pageViewId = validUuid(body?.pageViewId);
        const pagePath = cleanAnalyticsString(body?.pagePath, 240);

        if (!sessionId || !pageViewId || !shouldTrackAnalyticsPath(pagePath)) {
            return silentResponse();
        }

        const supabase = createSupabaseServiceClient();
        if (!supabase) return silentResponse();

        if (action === 'page_open') {
            const visitorId = validUuid(body?.visitorId);
            if (!visitorId) return silentResponse();

            const referrer = cleanAnalyticsString(body?.referrer, 500);
            const utmSource = cleanAnalyticsString(body?.utm?.source, 100);
            const siteOrigin = new URL(request.url).origin;
            const sequenceNumber = Math.max(1, Math.min(1000, Math.round(Number(body?.sequenceNumber) || 1)));
            const projectId = validUuid(body?.projectId) || null;

            const { error } = await supabase.rpc('analytics_record_page_open', {
                p_session_id: sessionId,
                p_visitor_id: visitorId,
                p_page_view_id: pageViewId,
                p_source: classifyAcquisitionSource({
                    utmSource,
                    utmMedium: cleanAnalyticsString(body?.utm?.medium, 100),
                    referrer,
                    siteOrigin,
                }),
                p_referrer_domain: getReferrerDomain(referrer),
                p_utm_source: utmSource,
                p_utm_medium: cleanAnalyticsString(body?.utm?.medium, 100),
                p_utm_campaign: cleanAnalyticsString(body?.utm?.campaign, 150),
                p_utm_term: cleanAnalyticsString(body?.utm?.term, 150),
                p_utm_content: cleanAnalyticsString(body?.utm?.content, 150),
                p_country: resolveAnalyticsCountry(request.headers),
                p_city: resolveAnalyticsCity(request.headers),
                p_landing_page: cleanAnalyticsString(body?.landingPage, 240) || pagePath,
                p_page_path: pagePath,
                p_page_title: cleanAnalyticsString(body?.pageTitle, 240),
                p_sequence_number: sequenceNumber,
                p_project_id: projectId,
            });

            if (error) console.warn('[analytics] Page open was not recorded:', error.message);
            return silentResponse();
        }

        if (action === 'engagement') {
            const engagedSeconds = Math.max(0, Math.min(86_400, Math.floor(Number(body?.engagedSeconds) || 0)));
            const { error } = await supabase.rpc('analytics_record_engagement', {
                p_session_id: sessionId,
                p_page_view_id: pageViewId,
                p_engaged_seconds: engagedSeconds,
                p_exit_page: pagePath,
            });

            if (error) console.warn('[analytics] Engagement was not recorded:', error.message);
            return silentResponse();
        }

        if (action === 'menu_event') {
            const eventId = validUuid(body?.eventId);
            const eventName = cleanAnalyticsString(body?.eventName, 40);
            const menuContext = cleanAnalyticsString(body?.menuContext, 20);
            if (!eventId || !MENU_EVENT_NAMES.has(eventName) || !MENU_CONTEXTS.has(menuContext)) {
                return silentResponse();
            }

            const rawTargetType = cleanAnalyticsString(body?.targetType, 30);
            const targetType = MENU_TARGET_TYPES.has(rawTargetType) ? rawTargetType : '';
            const position = Math.max(0, Math.min(100, Math.round(Number(body?.position) || 0)));
            const { error } = await supabase.rpc('analytics_record_navigation_event', {
                p_event_id: eventId,
                p_session_id: sessionId,
                p_page_view_id: pageViewId,
                p_event_name: eventName,
                p_page_path: pagePath,
                p_menu_context: menuContext,
                p_target_label: cleanAnalyticsString(body?.targetLabel, 120),
                p_target_url: cleanAnalyticsString(body?.targetUrl, 500),
                p_target_type: targetType,
                p_position: position || null,
            });

            if (error) console.warn('[analytics] Menu event was not recorded:', error.message);
        }
    } catch (error) {
        console.warn('[analytics] Collector failed silently:', error instanceof Error ? error.message : error);
    }

    return silentResponse();
};
