export const isSupabaseConfigured = (): boolean => {
    return !!(import.meta.env.PUBLIC_SUPABASE_URL && import.meta.env.PUBLIC_SUPABASE_ANON_KEY);
};
