export const prerender = false;

import type { APIRoute } from 'astro';
import { authorizeAdminRequest, jsonResponse } from '../../../../lib/admin/serverAuth';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const safeExternalUrl = (value: unknown) => {
    if (typeof value !== 'string') return null;
    try {
        const url = new URL(value);
        return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null;
    } catch {
        return null;
    }
};

export const GET: APIRoute = async ({ request, params }) => {
    const authorization = await authorizeAdminRequest(request);
    if (!authorization.ok) return authorization.response;

    const userId = String(params.id || '');
    if (!UUID_PATTERN.test(userId)) return jsonResponse({ error: 'User not found.' }, 404);

    try {
        const { supabase } = authorization;
        const [membershipResult, profileResult, authResult, opportunitiesResult] = await Promise.all([
            supabase
                .from('opportunity_memberships')
                .select('user_id, first_seen_at')
                .eq('user_id', userId)
                .maybeSingle(),
            supabase
                .from('profiles')
                .select('id, username, full_name, avatar_url, is_public')
                .eq('id', userId)
                .maybeSingle(),
            supabase.auth.admin.getUserById(userId),
            supabase
                .from('saved_opportunities')
                .select('id, title, source_url, deadline_at, status, content, created_at, updated_at')
                .eq('user_id', userId)
                .order('created_at', { ascending: false }),
        ]);

        if (membershipResult.error || !membershipResult.data) {
            return jsonResponse({ error: 'Opportunity Tracker user not found.' }, 404);
        }

        const queryError = profileResult.error || authResult.error || opportunitiesResult.error;
        if (queryError) throw queryError;

        const authUser = authResult.data.user;
        const profile = profileResult.data;
        return jsonResponse({
            user: {
                id: userId,
                displayName: profile?.full_name || profile?.username || authUser?.email?.split('@')[0] || 'Unnamed user',
                username: profile?.username || null,
                email: authUser?.email || null,
                avatarUrl: profile?.avatar_url || null,
                isPublic: Boolean(profile?.is_public),
                onboardedAt: membershipResult.data.first_seen_at,
            },
            opportunities: (opportunitiesResult.data || []).map((opportunity) => ({
                id: opportunity.id,
                title: opportunity.title,
                sourceUrl: safeExternalUrl(opportunity.source_url),
                deadlineAt: opportunity.deadline_at,
                status: opportunity.status,
                organisation: opportunity.content?.organisation || null,
                category: opportunity.content?.category || null,
                createdAt: opportunity.created_at,
                updatedAt: opportunity.updated_at,
            })),
        });
    } catch (error) {
        console.error('Failed to load Opportunity Tracker collection:', error);
        return jsonResponse({ error: 'Could not load this collection.' }, 500);
    }
};
