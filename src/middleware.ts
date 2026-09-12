import { defineMiddleware } from 'astro:middleware';
import { normalizePagePath } from './lib/urlNormalization.js';

// ---------------------------------------------------------------------------
// Subdomain routing helpers
// ---------------------------------------------------------------------------
// These were previously in the root middleware.js (Vercel Routing Middleware),
// but Vercel ignores that file for Astro projects because @astrojs/vercel
// builds its own routing config. The logic now lives here in Astro's own
// middleware so it actually executes.
// ---------------------------------------------------------------------------
import {
    curationPathToInternalPath,
    getCurationCanonicalRedirect,
    getCurationSubdomainRedirect,
    getLegacyResourceRedirect,
    isCurationHostname,
} from './lib/curationRoutes.js';
import {
    getLabCanonicalRedirect,
    getLabSubdomainRedirect,
    isLabHostname,
    labDestination,
    legacyLabRedirectLocation,
} from './lib/labRoutes.js';
import {
    getPhotosSubdomainRedirect,
    isPhotographyHostname,
    photographyDestination,
} from './lib/photography/routing.mjs';

const privatePagePatterns = [
    /^\/admin(?:\/|$)/,
    /^\/api(?:\/|$)/,
    /^\/login\/?$/,
    /^\/unauthorized\/?$/,
    /^\/unsubscribe\/?$/,
    /^\/payments\/?$/,
    /^\/club\/(?:payment-|welcome)/,
    /^\/collaboration\/measurements\/?$/,
    /^\/du-workshop-responses\/?$/,
    /^\/feedback\/?$/,
    /^\/paper-renamer\/insights(?:\/|$)/,
    /^\/research\/admin(?:\/|$)/,
    /^\/obsidian-vault(?:\/|$)/,
    /^\/resources\/(?:admin|auth|curator|dashboard|saved|submit)(?:\/|$)/,
    /^\/resources\/.*\/edit\/?$/,
];

type PublicCacheContext = {
    isPrerendered: boolean;
    request: Request;
    url: URL;
};

const canCachePublicPage = (context: PublicCacheContext, response: Response) => {
    if (context.isPrerendered) return false;
    if (!['GET', 'HEAD'].includes(context.request.method)) return false;
    if (privatePagePatterns.some((pattern) => pattern.test(context.url.pathname))) return false;
    if (context.request.headers.has('authorization')) return false;
    if (response.status !== 200 || response.headers.has('set-cookie')) return false;

    return response.headers.get('content-type')?.includes('text/html') ?? false;
};

const permanentRedirect = (location: string) =>
    new Response(null, { status: 308, headers: { Location: location } });

export const onRequest = defineMiddleware(async (context, next) => {
    const rawHost = context.request.headers.get('x-forwarded-host') || context.request.headers.get('host');
    const requestUrl = new URL(context.request.url);
    if (rawHost) {
        const primaryHost = rawHost.split(',')[0].trim();
        requestUrl.host = primaryHost;
        requestUrl.hostname = primaryHost.split(':')[0].toLowerCase();
    }

    // -----------------------------------------------------------------------
    // Subdomain routing — rewrite subdomain requests to internal Astro pages
    // -----------------------------------------------------------------------

    // --- Curation subdomain (curation.abodid.com) ---
    if (isCurationHostname(requestUrl.hostname)) {
        // Canonical redirect: e.g. curation.abodid.com/resources/admin → curation.abodid.com/admin
        const canonicalRedirect = getCurationCanonicalRedirect(requestUrl);
        if (canonicalRedirect) return permanentRedirect(canonicalRedirect);

        // Internal rewrite: map public curation paths to /resources/* pages
        const internalPath = curationPathToInternalPath(requestUrl.pathname);
        if (internalPath) {
            return context.rewrite(`${internalPath}${requestUrl.search}`);
        }

        // External redirect: paths not part of curation go to main site
        const externalRedirect = getCurationSubdomainRedirect(requestUrl);
        if (externalRedirect) return permanentRedirect(externalRedirect);
    }

    // --- Lab subdomain (lab.abodid.com) ---
    if (isLabHostname(requestUrl.hostname)) {
        // Canonical redirect: e.g. lab.abodid.com/lab → lab.abodid.com/
        const canonicalRedirect = getLabCanonicalRedirect(requestUrl);
        if (canonicalRedirect) return permanentRedirect(canonicalRedirect);

        // Internal rewrite: map public lab paths to /lab/* pages
        const internalPath = labDestination(requestUrl);
        if (internalPath) {
            return context.rewrite(`${internalPath}${requestUrl.search}`);
        }

        // External redirect: paths not part of lab go to main site
        const externalRedirect = getLabSubdomainRedirect(requestUrl);
        if (externalRedirect) return permanentRedirect(externalRedirect);
    }

    // --- Photography subdomain (photos.abodid.com) ---
    if (isPhotographyHostname(requestUrl.hostname)) {
        // Internal rewrite: map public paths to /photography-portfolio/* pages
        const internalPath = photographyDestination(requestUrl);
        if (internalPath) {
            return context.rewrite(`${internalPath}${requestUrl.search}`);
        }

        // External redirect: paths not part of photography go to main site
        const externalRedirect = getPhotosSubdomainRedirect(requestUrl);
        if (externalRedirect) return permanentRedirect(externalRedirect);
    }

    // --- Legacy redirects on main site ---
    // abodid.com/resources/* → curation.abodid.com/*
    const resourceRedirect = getLegacyResourceRedirect(requestUrl);
    if (resourceRedirect) return permanentRedirect(resourceRedirect);

    // abodid.com/lab, abodid.com/punctum, etc. → lab.abodid.com/*
    const labRedirect = legacyLabRedirectLocation(requestUrl);
    if (labRedirect) return permanentRedirect(labRedirect);

    // -----------------------------------------------------------------------
    // Trailing-slash normalization
    // -----------------------------------------------------------------------

    if (requestUrl.pathname !== '/' && requestUrl.pathname.endsWith('/')) {
        const destination = `${normalizePagePath(requestUrl.pathname)}${requestUrl.search}`;
        return new Response(null, {
            status: 308,
            headers: { Location: destination },
        });
    }

    const nextWithPublicCache = async () => {
        const response = await next();

        if (privatePagePatterns.some((pattern) => pattern.test(requestUrl.pathname))) {
            response.headers.set('Cache-Control', 'private, no-store');
            response.headers.set('Vercel-CDN-Cache-Control', 'no-store');
            return response;
        }

        if (canCachePublicPage({
            isPrerendered: context.isPrerendered,
            request: context.request,
            url: requestUrl,
        }, response)) {
            response.headers.set('Cache-Control', 'public, max-age=0, must-revalidate');
            response.headers.set(
                'Vercel-CDN-Cache-Control',
                's-maxage=300, stale-while-revalidate=86400'
            );
        }

        return response;
    };

    // Only protect /admin routes (except /admin/login)
    // DISABLED: Client-side auth in AdminDashboard.jsx handles this. 
    // Middleware cookie check conflicts with localStorage session.
    /*
    if (context.url.pathname.startsWith('/admin') &&
        !context.url.pathname.startsWith('/admin/login')) {

        // Get session from cookies
        const authToken = context.cookies.get('sb-access-token')?.value;

        if (!authToken) {
            // No session, redirect to login
            return context.redirect('/admin/login');
        }

        const supabase = createClient(supabaseUrl, supabaseAnonKey, {
            auth: {
                persistSession: false
            },
            global: {
                headers: {
                    Authorization: `Bearer ${authToken}`
                }
            }
        });

        // Get current session
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError || !session) {
            // Invalid session, redirect to login
            return context.redirect('/admin/login');
        }

        // Check admin role
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', session.user.id)
            .single();

        if (profileError || !profile || profile.role !== 'admin') {
            // Not an admin, redirect to unauthorized page
            return context.redirect('/unauthorized');
        }

        // User is authenticated and has admin role, proceed
        console.log(`Admin access granted for ${session.user.email} to ${context.url.pathname}`);
    }
    */

    return nextWithPublicCache();
});
