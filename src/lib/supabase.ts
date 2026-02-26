
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;
const hasSupabaseEnv = Boolean(supabaseUrl && supabaseAnonKey);

const FALLBACK_SUPABASE_URL = 'https://placeholder.supabase.co';
const FALLBACK_SUPABASE_ANON_KEY = 'placeholder-anon-key';

if (!hasSupabaseEnv) {
    console.warn(
        '[supabase] Missing PUBLIC_SUPABASE_URL or PUBLIC_SUPABASE_ANON_KEY. ' +
        'Using a placeholder client so the app can keep rendering with graceful fallbacks.',
    );
}

export const supabase = createClient(
    hasSupabaseEnv ? supabaseUrl : FALLBACK_SUPABASE_URL,
    hasSupabaseEnv ? supabaseAnonKey : FALLBACK_SUPABASE_ANON_KEY,
);
