export const prerender = false;

import type { APIRoute } from 'astro';
import { authorizeAdminRequest, jsonResponse } from '../../../../lib/admin/serverAuth';
import { buildOpportunityUserDirectory } from '../../../../lib/admin/opportunityUsers.js';

const listAllAuthUsers = async (supabase: any): Promise<any[]> => {
    const users: any[] = [];

    for (let page = 1; ; page += 1) {
        const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
        if (error) throw error;
        users.push(...data.users);
        if (data.users.length < 1000) return users;
    }
};

export const GET: APIRoute = async ({ request }) => {
    const authorization = await authorizeAdminRequest(request);
    if (!authorization.ok) return authorization.response;

    try {
        const { supabase } = authorization;
        const [authUsers, membershipsResult, profilesResult, opportunitiesResult] = await Promise.all([
            listAllAuthUsers(supabase),
            supabase
                .from('opportunity_memberships')
                .select('user_id, first_seen_at, signup_notification_status, signup_notification_sent_at')
                .order('first_seen_at', { ascending: false }),
            supabase
                .from('profiles')
                .select('id, email, username, full_name, avatar_url, is_public'),
            supabase
                .from('saved_opportunities')
                .select('user_id'),
        ]);

        const queryError = [membershipsResult, profilesResult, opportunitiesResult]
            .find((result) => result.error)?.error;
        if (queryError) throw queryError;

        return jsonResponse(buildOpportunityUserDirectory({
            memberships: membershipsResult.data || [],
            authUsers,
            profiles: profilesResult.data || [],
            opportunities: opportunitiesResult.data || [],
        }));
    } catch (error) {
        console.error('Failed to load Opportunity Tracker users:', error);
        return jsonResponse({ error: 'Could not load Opportunity Tracker users.' }, 500);
    }
};
