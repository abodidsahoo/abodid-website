export const prerender = false;

import type { APIRoute } from 'astro';
import {
    classifyAcquisitionSource,
    cleanAnalyticsString,
    extractClientIp,
    getReferrerDomain,
    isAnalyticsBot,
    isExcludedDeveloperLocation,
    isExcludedIpAddress,
    isLocalAnalyticsUrl,
    isPreviewAnalyticsEnvironment,
    isSameOriginAnalyticsRequest,
    resolveAnalyticsCountry,
    resolveAnalyticsCity,
    resolveAnalyticsRegion,
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

const hasOwnerExclusionCookie = (request: Request) => {
    const cookieHeader = request.headers.get('cookie') || '';
    return cookieHeader.split(';').some((part) => {
        const trimmed = part.trim();
        return trimmed === 'abodid_analytics_exclude=1' ||
               trimmed.startsWith('sb-') && trimmed.includes('-auth-token=');
    });
};

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

        const clientIp = extractClientIp(request.headers);
        if (isExcludedIpAddress(clientIp)) return silentResponse();

        const country = resolveAnalyticsCountry(request.headers);
        const city = resolveAnalyticsCity(request.headers);
        const region = resolveAnalyticsRegion(request.headers);
        if (isExcludedDeveloperLocation({ country, city, region })) return silentResponse();

        const body = await request.json();
        const action = body?.action;
        const sessionId = validUuid(body?.sessionId);
        const pageViewId = validUuid(body?.pageViewId);
        const pagePath = cleanAnalyticsString(body?.pagePath, 240);

        if (!sessionId || !shouldTrackAnalyticsPath(pagePath)) {
            return silentResponse();
        }

        const supabase = createSupabaseServiceClient();
        if (!supabase) return silentResponse();

        // 1. Unified Batched Session Snapshot (Minimal Vercel Compute: Single Direct UPSERT)
        if (action === 'session_snapshot') {
            const visitorId = validUuid(body?.visitorId);
            if (!visitorId) return silentResponse();

            const referrer = cleanAnalyticsString(body?.referrer, 500);
            const utmSource = cleanAnalyticsString(body?.utm?.source, 100);
            const siteOrigin = new URL(request.url).origin;
            const source = classifyAcquisitionSource({
                utmSource,
                utmMedium: cleanAnalyticsString(body?.utm?.medium, 100),
                referrer,
                siteOrigin,
            });
            const country = resolveAnalyticsCountry(request.headers);
            const city = resolveAnalyticsCity(request.headers);
            const engagedSeconds = Math.max(0, Math.min(86_400, Math.floor(Number(body?.engagedSeconds) || 0)));

            await supabase.from('analytics_sessions').upsert({
                id: sessionId,
                visitor_id: visitorId,
                source: source || 'Direct Visit',
                referrer_domain: getReferrerDomain(referrer) || null,
                utm_source: utmSource || null,
                utm_medium: cleanAnalyticsString(body?.utm?.medium, 100) || null,
                utm_campaign: cleanAnalyticsString(body?.utm?.campaign, 150) || null,
                utm_term: cleanAnalyticsString(body?.utm?.term, 150) || null,
                utm_content: cleanAnalyticsString(body?.utm?.content, 150) || null,
                country: country || 'Unknown',
                city: city || null,
                landing_page: cleanAnalyticsString(body?.landingPage, 240) || pagePath,
                exit_page: cleanAnalyticsString(body?.exitPage || pagePath, 240),
                started_at: body?.startedAt || new Date().toISOString(),
                ended_at: new Date().toISOString(),
                total_engaged_seconds: engagedSeconds,
                intent_category: cleanAnalyticsString(body?.intentCategory, 40) || null,
                intent_score: Math.max(0, Math.min(100, Math.round(Number(body?.intentScore) || 0))),
                is_returning: Boolean(body?.isReturning),
                converted: Boolean(body?.converted),
                conversion_type: cleanAnalyticsString(body?.conversionType, 60) || null,
                friction_flags: Array.isArray(body?.frictionFlags) ? body.frictionFlags : [],
                events: Array.isArray(body?.events) ? body.events.slice(-40) : [],
                replay_data: Array.isArray(body?.replayData) ? body.replayData.slice(-100) : [],
            }, { onConflict: 'id' });

            return silentResponse();
        }

        // 2. Legacy page_open / engagement handlers for backward compatibility
        if (action === 'page_open') {
            const visitorId = validUuid(body?.visitorId);
            if (!visitorId || !pageViewId) return silentResponse();

            const referrer = cleanAnalyticsString(body?.referrer, 500);
            const utmSource = cleanAnalyticsString(body?.utm?.source, 100);
            const siteOrigin = new URL(request.url).origin;
            const sequenceNumber = Math.max(1, Math.min(1000, Math.round(Number(body?.sequenceNumber) || 1)));
            const projectId = validUuid(body?.projectId) || null;

            await supabase.rpc('analytics_record_page_open', {
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

            return silentResponse();
        }

        if (action === 'engagement') {
            if (!pageViewId) return silentResponse();
            const engagedSeconds = Math.max(0, Math.min(86_400, Math.floor(Number(body?.engagedSeconds) || 0)));
            await supabase.rpc('analytics_record_engagement', {
                p_session_id: sessionId,
                p_page_view_id: pageViewId,
                p_engaged_seconds: engagedSeconds,
                p_exit_page: pagePath,
            });

            return silentResponse();
        }
    } catch (error) {
        console.warn('[analytics] Collector failed silently:', error instanceof Error ? error.message : error);
    }

    return silentResponse();
};


