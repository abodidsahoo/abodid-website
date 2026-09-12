import { defineMiddleware } from 'astro:middleware';
import type { APIContext, MiddlewareNext } from 'astro';
import { rewrite as vercelRewrite } from '@vercel/functions';
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

const rewriteInternalRoute = (context: APIContext, next: MiddlewareNext, pathname: string) => {
    const destination = new URL(context.request.url);
    destination.pathname = pathname;

    // The Vercel adapter's edge wrapper runs before filesystem resolution, but
    // Astro 5's edge context does not implement context.rewrite(). Emit Vercel's
    // native rewrite response there and use next(target) locally so this
    // middleware is not re-entered with the private /lab prefix.
    const edgeContext = (context.locals as { vercel?: { edge?: unknown } }).vercel?.edge;
    return edgeContext ? vercelRewrite(destination) : next(destination);
};

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

    // --- Curation subdomain (curation.abodid.com) fallback redirect to main site ---
    if (isCurationHostname(requestUrl.hostname)) {
        const destPath = requestUrl.pathname === '/' ? '/resources' : (requestUrl.pathname.startsWith('/resources') ? requestUrl.pathname : `/resources${requestUrl.pathname}`);
        return permanentRedirect(`https://abodid.com${destPath}${requestUrl.search}`);
    }

    // --- Lab subdomain (lab.abodid.com) fallback redirect to main site ---
    if (isLabHostname(requestUrl.hostname)) {
        const dest = getLabSubdomainRedirect(requestUrl);
        if (dest) return permanentRedirect(dest);
        const destPath = requestUrl.pathname === '/' ? '/lab' : (requestUrl.pathname.startsWith('/lab') ? requestUrl.pathname : `/lab${requestUrl.pathname}`);
        return permanentRedirect(`https://abodid.com${destPath}${requestUrl.search}`);
    }

    // --- Photography subdomain (photos.abodid.com) ---
    if (isPhotographyHostname(requestUrl.hostname)) {
        // Internal rewrite: map public paths to /photography-portfolio/* pages
        const internalPath = photographyDestination(requestUrl);
        if (internalPath) {
            return rewriteInternalRoute(context, next, internalPath);
        }

        // External redirect: paths not part of photography go to main site
        const externalRedirect = getPhotosSubdomainRedirect(requestUrl);
        if (externalRedirect) return permanentRedirect(externalRedirect);
    }

    // Redirect legacy experiment routes (/research/punctum, /punctum, etc.) to /lab/...
    if (!context.isPrerendered) {
        const labRedirect = legacyLabRedirectLocation(requestUrl);
        if (labRedirect) return permanentRedirect(labRedirect);
    }

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
