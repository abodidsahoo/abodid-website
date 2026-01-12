import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

let client = null;
try {
    if (supabaseUrl && supabaseKey) {
        client = createClient(supabaseUrl, supabaseKey);
    }
} catch (e) {
    console.warn('Supabase client failed to initialize:', e);
}

export const supabase = client;
