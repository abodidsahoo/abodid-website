import { defineMiddleware } from 'astro:middleware';
import { createClient } from '@supabase/supabase-js';
import { normalizePagePath } from './lib/urlNormalization.js';

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
    /^\/research\/obsidian-vault(?:\/|$)/,
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
    if (requestUrl.pathname !== '/' && requestUrl.pathname.endsWith('/')) {
        const destination = `${normalizePagePath(requestUrl.pathname)}${requestUrl.search}`;
        return new Response(null, {
            status: 308,
            headers: { Location: destination },
        });
    }

    const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

    const nextWithPublicCache = async () => {
        const response = await next();

        if (canCachePublicPage(context, response)) {
            response.headers.set('Cache-Control', 'public, max-age=0, must-revalidate');
            response.headers.set(
                'Vercel-CDN-Cache-Control',
                's-maxage=300, stale-while-revalidate=86400'
            );
        }

        return response;
    };

    if (!supabaseUrl || !supabaseAnonKey) {
        console.error('Missing Supabase credentials in middleware');
        return nextWithPublicCache();
    }

    // Protect /resources/curator route (curators and admins only)
    if (context.url.pathname === '/resources/curator') {
        const authToken = context.cookies.get('sb-access-token')?.value;

        if (!authToken) {
            return context.redirect('/login');
        }

        const supabase = createClient(supabaseUrl, supabaseAnonKey, {
            auth: { persistSession: false },
            global: { headers: { Authorization: `Bearer ${authToken}` } }
        });

        const { data: { session } } = await supabase.auth.getSession();

        if (!session) {
            return context.redirect('/login');
        }

        const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', session.user.id)
            .single();

        if (!profile || (profile.role !== 'curator' && profile.role !== 'admin')) {
            return context.redirect('/resources');
        }
    }

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
