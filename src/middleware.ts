import { defineMiddleware } from 'astro:middleware';
import { normalizePagePath } from './lib/urlNormalization.js';
import { photographyDestination } from './lib/photography/routing.mjs';
import { legacyVaultRedirectLocation } from './lib/vault-paths.js';
import { legacyLabRedirectLocation } from './lib/labRoutes.js';
import {
    curationPathToInternalPath,
    getCurationCanonicalRedirect,
    getLegacyResourceRedirect,
    isCurationHostname,
} from './lib/curationRoutes.js';

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

export const onRequest = defineMiddleware(async (context, next) => {
    const requestUrl = new URL(context.request.url);
    const legacyResourceRedirect = getLegacyResourceRedirect(requestUrl);
    if (legacyResourceRedirect) {
        return new Response(null, {
            status: 308,
            headers: { Location: legacyResourceRedirect },
        });
    }
    const curationCanonicalRedirect = getCurationCanonicalRedirect(requestUrl);
    if (curationCanonicalRedirect) {
        return new Response(null, {
            status: 308,
            headers: { Location: curationCanonicalRedirect },
        });
    }
    const labRedirect = legacyLabRedirectLocation(requestUrl);
    if (labRedirect) {
        return new Response(null, {
            status: 308,
            headers: { Location: labRedirect },
        });
    }
    const photographyPath = photographyDestination(requestUrl);
    if (photographyPath) {
        const target = new URL(photographyPath, requestUrl);
        target.search = requestUrl.search;
        // next(url) rewrites once without re-entering domain middleware.
        const response = await next(target);
        if (response.status === 200) {
            response.headers.set('Cache-Control', 'public, max-age=0, must-revalidate');
            response.headers.set('Vercel-CDN-Cache-Control', 's-maxage=300, stale-while-revalidate=86400');
        }
        return response;
    }
    const vaultRedirect = legacyVaultRedirectLocation(requestUrl);
    if (vaultRedirect) {
        return new Response(null, {
            status: 308,
            headers: { Location: vaultRedirect },
        });
    }
    if (requestUrl.pathname !== '/' && requestUrl.pathname.endsWith('/')) {
        const destination = `${normalizePagePath(requestUrl.pathname)}${requestUrl.search}`;
        return new Response(null, {
            status: 308,
            headers: { Location: destination },
        });
    }

    const curationInternalPath = isCurationHostname(requestUrl.hostname)
        ? curationPathToInternalPath(requestUrl.pathname)
        : null;
    const routedUrl = curationInternalPath
        ? new URL(`${curationInternalPath}${requestUrl.search}`, requestUrl)
        : requestUrl;

    const nextWithPublicCache = async () => {
        // Keep browser-visible curation URLs clean while reusing the existing
        // resource implementation internally.
        const response = curationInternalPath ? await next(routedUrl) : await next();

        if (canCachePublicPage({
            isPrerendered: context.isPrerendered,
            request: context.request,
            url: routedUrl,
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
