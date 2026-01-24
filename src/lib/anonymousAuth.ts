/**
 * Anonymous Session Helpers
 * Utilities for managing anonymous and real user sessions
 */

import { supabase } from './supabaseClient';

/**
 * Ensure user has a session (anonymous or real)
 * Auto-creates anonymous session if needed
 */
export async function ensureSession() {
    if (!supabase) return null;

    const { data: { session } } = await supabase.auth.getSession();

    if (session) {
        return session;
    }

    // No session - create anonymous user
    console.log('Creating anonymous session...');
    const { data, error } = await supabase.auth.signInAnonymously();

    if (error) {
        console.error('Failed to create anonymous session:', error);
        return null;
    }

    return data.session;
}

/**
 * Check if current session is anonymous
 */
export async function isAnonymousSession(): Promise<boolean> {
    if (!supabase) return false;

    const { data: { session } } = await supabase.auth.getSession();

    if (!session) return false;

    // Check if is_anonymous flag is set
    return session.user.is_anonymous || false;
}

/**
 * Get bookmark count for current user
 */
export async function getUserBookmarkCount(): Promise<number> {
    if (!supabase) return 0;

    const { data: { session } } = await supabase.auth.getSession();

    if (!session) return 0;

    const { data, error } = await supabase
        .from('hub_resource_bookmarks')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', session.user.id);

    if (error) {
        console.error('Error getting bookmark count:', error);
        return 0;
    }

    return data?.length || 0;
}

/**
 * Migrate anonymous user data to real account
 * Called after successful signup from anonymous session
 */
export async function migrateAnonymousData(anonymousUserId: string, newUserId: string) {
    if (!supabase) return { success: false, error: 'No supabase client' };

    try {
        // Migrate bookmarks
        const { error: bookmarkError } = await supabase
            .from('hub_resource_bookmarks')
            .update({ user_id: newUserId })
            .eq('user_id', anonymousUserId);

        if (bookmarkError) throw bookmarkError;

        // Migrate upvotes
        const { error: upvoteError } = await supabase
            .from('hub_resource_upvotes')
            .update({ user_id: newUserId })
            .eq('user_id', anonymousUserId);

        if (upvoteError) throw upvoteError;

        console.log('Successfully migrated anonymous data');
        return { success: true };
    } catch (error) {
        console.error('Error migrating anonymous data:', error);
        return { success: false, error: String(error) };
    }
}
