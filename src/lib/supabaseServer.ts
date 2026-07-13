import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Creates a server-only Supabase client with elevated database access.
 * Never import this helper into browser components: the service-role key bypasses RLS.
 */
export const createSupabaseServiceClient = (): SupabaseClient | null => {
    const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL || process.env.PUBLIC_SUPABASE_URL;
    const serviceRoleKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) return null;

    return createClient(supabaseUrl, serviceRoleKey, {
        auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false,
        },
    });
};
