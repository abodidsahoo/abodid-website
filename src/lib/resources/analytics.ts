import { createClient } from '@supabase/supabase-js';

// Create admin client with service role key (Server-side only)
const getAdminClient = () => {
    if (typeof window !== 'undefined') {
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

export interface SystemStats {
    totalUsers: number;
    activeUsers24h: number; // Users who logged in or acted in last 24h
    totalResources: number;
    totalBookmarks: number;
    totalUpvotes: number;
    anonymousUsers: number;
}

export interface TopResource {
    id: string;
    title: string;
    url: string;
    count: number;
    type: 'upvote' | 'bookmark';
}

export interface ActivityItem {
    id: string;
    user_id: string;
    user_email?: string; // If available/applicable
    username?: string;
    action: 'bookmark' | 'upvote' | 'submit' | 'signup';
    resource_title?: string;
    created_at: string;
    is_anonymous: boolean;
}

/**
 * Fetch high-level system statistics
 */
export async function getSystemStats(): Promise<SystemStats> {
    const admin = getAdminClient();
    if (!admin) throw new Error('Server side only');

    // 1. User Stats
    const { data: { users }, error: userError } = await admin.auth.admin.listUsers();

    if (userError) throw userError;

    const totalUsers = users.length;
    // Fix: Supabase Auth user object doesn't have is_anonymous directly exposed in some versions of the types,
    // but it is in the data. We'll check carefully.
    // Usually stored in raw_user_meta_data or app_metadata if created anonymously? 
    // Actually, for listUsers, we might not easily distinguish anonymous unless we check factors.
    // However, typically anonymous users might have is_anonymous in user_metadata or similar.
    // Let's rely on profiles count for "Real" users vs Auth users.

    // Fetch profiles (Real registered users usually have a profile)
    const { count: profileCount } = await admin.from('profiles').select('*', { count: 'exact', head: true });

    // If we assume every registered user has a profile (due to our trigger), 
    // then (Total Auth Users - Profiles) roughly equals Anonymous (or unconfirmed without profile).
    // But our anonymous users DO NOT have profiles yet? 
    // Correct: Our trigger only runs on SIGNUP? Anonymous signin is different.
    // Let's assume anonymous users don't have a profile entry.
    const anonymousUsers = Math.max(0, totalUsers - (profileCount || 0));

    // Active Users (approximate by recent sign in)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const activeUsers24h = users.filter(u => new Date(u.last_sign_in_at || 0) > yesterday).length;

    // 2. Resource Stats
    const { count: resourceCount } = await admin.from('hub_resources').select('*', { count: 'exact', head: true });

    // 3. Engagement Stats
    const { count: bookmarkCount } = await admin.from('hub_resource_bookmarks').select('*', { count: 'exact', head: true });
    const { count: upvoteCount } = await admin.from('hub_resource_upvotes').select('*', { count: 'exact', head: true });

    return {
        totalUsers,
        activeUsers24h,
        totalResources: resourceCount || 0,
        totalBookmarks: bookmarkCount || 0,
        totalUpvotes: upvoteCount || 0,
        anonymousUsers
    };
}

/**
 * Get top 5 most bookmarked resources
 */
export async function getTopBookmarkedResources(): Promise<TopResource[]> {
    const admin = getAdminClient();
    if (!admin) throw new Error('Server side only');

    // Use RPC or raw query if possible, but for simplicity with JS client:
    // We'll fetch all bookmarks and aggregate (fine for small scale).
    // For larger scale, this should be a DB view or RPC.

    const { data: bookmarks } = await admin
        .from('hub_resource_bookmarks')
        .select('resource_id, hub_resources(title, url)');

    if (!bookmarks) return [];

    const counts: Record<string, { count: number, title: string, url: string }> = {};

    bookmarks.forEach((b: any) => {
        if (!b.hub_resources) return; // Deleted resource?
        const id = b.resource_id;
        if (!counts[id]) {
            counts[id] = { count: 0, title: b.hub_resources.title, url: b.hub_resources.url };
        }
        counts[id].count++;
    });

    return Object.entries(counts)
        .map(([id, info]) => ({ id, ...info, type: 'bookmark' as const }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);
}

/**
 * Get top 5 most upvoted resources
 */
export async function getTopUpvotedResources(): Promise<TopResource[]> {
    const admin = getAdminClient();
    if (!admin) throw new Error('Server side only');

    const { data: upvotes } = await admin
        .from('hub_resource_upvotes')
        .select('resource_id, hub_resources(title, url)');

    if (!upvotes) return [];

    const counts: Record<string, { count: number, title: string, url: string }> = {};

    upvotes.forEach((u: any) => {
        if (!u.hub_resources) return;
        const id = u.resource_id;
        if (!counts[id]) {
            counts[id] = { count: 0, title: u.hub_resources.title, url: u.hub_resources.url };
        }
        counts[id].count++;
    });

    return Object.entries(counts)
        .map(([id, info]) => ({ id, ...info, type: 'upvote' as const }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);
}

/**
 * Get recent activity feed (Signups, Bookmarks, Upvotes)
 */
export async function getRecentActivity(limit = 20): Promise<ActivityItem[]> {
    const admin = getAdminClient();
    if (!admin) throw new Error('Server side only');

    const activity: ActivityItem[] = [];

    // 1. Recent Signups
    // We can't query auth.users by date easily via JS client in all versions, 
    // but we can list and filter or use profiles created_at.
    const { data: profiles } = await admin
        .from('profiles')
        .select('id, username, created_at')
        .order('created_at', { ascending: false })
        .limit(limit);

    profiles?.forEach(p => activity.push({
        id: `signup-${p.id}`,
        user_id: p.id,
        username: p.username || 'Unknown',
        action: 'signup',
        created_at: p.created_at,
        is_anonymous: false
    }));

    // 2. Recent Bookmarks
    const { data: bookmarks } = await admin
        .from('hub_resource_bookmarks')
        .select('id, user_id, created_at, resource_id, hub_resources(title)')
        .order('created_at', { ascending: false })
        .limit(limit);

    // Need to map user_ids to usernames/emails if possible.
    // We'll do a bulk fetch of profiles for these users later.

    if (bookmarks) {
        bookmarks.forEach((b: any) => activity.push({
            id: `bookmark-${b.id}`,
            user_id: b.user_id,
            action: 'bookmark',
            resource_title: b.hub_resources?.title,
            created_at: b.created_at,
            is_anonymous: false // Default, will check against profile map
        }));
    }

    // 3. Recent Upvotes
    const { data: upvotes } = await admin
        .from('hub_resource_upvotes')
        .select('id, user_id, created_at, resource_id, hub_resources(title)')
        .order('created_at', { ascending: false })
        .limit(limit);

    if (upvotes) {
        upvotes.forEach((u: any) => activity.push({
            id: `upvote-${u.id}`,
            user_id: u.user_id,
            action: 'upvote',
            resource_title: u.hub_resources?.title,
            created_at: u.created_at,
            is_anonymous: false
        }));
    }

    // Sort combined list
    activity.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    const recent = activity.slice(0, limit);

    // Enrich with User info
    // Collect unique user IDs
    const userIds = [...new Set(recent.map(a => a.user_id))];

    if (userIds.length > 0) {
        const { data: userProfiles } = await admin
            .from('profiles')
            .select('id, username')
            .in('id', userIds);

        const profileMap = new Map(userProfiles?.map(p => [p.id, p.username]));

        recent.forEach(item => {
            if (item.action === 'signup') return; // Already has info

            const username = profileMap.get(item.user_id);
            if (username) {
                item.username = username;
                item.is_anonymous = false;
            } else {
                item.username = 'Anonymous User';
                item.is_anonymous = true;
            }
        });
    }

    return recent;
}
