import { defineMiddleware } from 'astro:middleware';
import { createClient } from '@supabase/supabase-js';

export const onRequest = defineMiddleware(async (context, next) => {
    const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
        console.error('Missing Supabase credentials in middleware');
        return next();
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

    return next();
});
