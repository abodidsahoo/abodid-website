/**
 * Admin User Management Functions
 * These functions use the service role key for privileged operations
 */

import { createClient } from '@supabase/supabase-js';

// Create admin client with service role key
const getAdminClient = () => {
    if (typeof window !== 'undefined') {
        // Client-side: use regular client but require admin privileges
        return null;
    }

    const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
    const serviceRoleKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
        throw new Error('Missing Supabase credentials');
    }

    return createClient(supabaseUrl, serviceRoleKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    });
};

export interface AdminUser {
    id: string;
    email: string;
    email_confirmed_at: string | null;
    created_at: string;
    profile: {
        username: string | null;
        full_name: string | null;
        avatar_url: string | null;
        role: 'user' | 'curator' | 'admin';
    } | null;
}

/**
 * Get all users with their profiles and auth status
 */
export async function getAllUsers(): Promise<{ users: AdminUser[]; error?: string }> {
    try {
        const adminClient = getAdminClient();
        if (!adminClient) {
            return { users: [], error: 'Server-side only' };
        }

        // Fetch all auth users
        const { data: authData, error: authError } = await adminClient.auth.admin.listUsers();

        if (authError) {
            return { users: [], error: authError.message };
        }

        // Fetch all profiles
        const { data: profiles, error: profileError } = await adminClient
            .from('profiles')
            .select('id, username, full_name, avatar_url, role');

        if (profileError) {
            return { users: [], error: profileError.message };
        }

        // Merge auth data with profiles
        const users: AdminUser[] = authData.users.map(authUser => {
            const profile = profiles?.find(p => p.id === authUser.id);
            return {
                id: authUser.id,
                email: authUser.email || '',
                email_confirmed_at: authUser.email_confirmed_at,
                created_at: authUser.created_at,
                profile: profile || null
            };
        });

        // Sort by most recent first
        users.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

        return { users };
    } catch (error) {
        console.error('Error fetching users:', error);
        return { users: [], error: 'Failed to fetch users' };
    }
}

/**
 * Manually confirm a user's email
 */
export async function confirmUser(userId: string): Promise<{ success: boolean; error?: string }> {
    try {
        const adminClient = getAdminClient();
        if (!adminClient) {
            return { success: false, error: 'Server-side only' };
        }

        const { error } = await adminClient.auth.admin.updateUserById(userId, {
            email_confirm: true
        });

        if (error) {
            return { success: false, error: error.message };
        }

        return { success: true };
    } catch (error) {
        console.error('Error confirming user:', error);
        return { success: false, error: 'Failed to confirm user' };
    }
}

/**
 * Update a user's role
 */
export async function updateUserRole(
    userId: string,
    newRole: 'user' | 'curator' | 'admin'
): Promise<{ success: boolean; error?: string }> {
    try {
        const adminClient = getAdminClient();
        if (!adminClient) {
            return { success: false, error: 'Server-side only' };
        }

        const { error } = await adminClient
            .from('profiles')
            .update({ role: newRole, updated_at: new Date().toISOString() })
            .eq('id', userId);

        if (error) {
            return { success: false, error: error.message };
        }

        return { success: true };
    } catch (error) {
        console.error('Error updating user role:', error);
        return { success: false, error: 'Failed to update role' };
    }
}

/**
 * Delete a user completely (auth + profile + related data)
 */
export async function deleteUser(userId: string): Promise<{ success: boolean; error?: string }> {
    try {
        const adminClient = getAdminClient();
        if (!adminClient) {
            return { success: false, error: 'Server-side only' };
        }

        // Delete auth user (this will cascade delete profile due to FK constraints)
        const { error } = await adminClient.auth.admin.deleteUser(userId);

        if (error) {
            return { success: false, error: error.message };
        }

        return { success: true };
    } catch (error) {
        console.error('Error deleting user:', error);
        return { success: false, error: 'Failed to delete user' };
    }
}

/**
 * Verify if current user is an admin
 */
export async function isAdmin(currentUserId: string): Promise<boolean> {
    try {
        const adminClient = getAdminClient();
        if (!adminClient) {
            return false;
        }

        const { data, error } = await adminClient
            .from('profiles')
            .select('role')
            .eq('id', currentUserId)
            .single();

        if (error || !data) {
            return false;
        }

        return data.role === 'admin';
    } catch (error) {
        console.error('Error checking admin status:', error);
        return false;
    }
}
