import type { APIRoute } from 'astro';
import {
    authorizeOpportunityRequest,
    isValidOpportunityUsername,
    normalizeOpportunityUsername,
    opportunityJson,
} from '../../../lib/opportunities/userAuth';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
    const authorization = await authorizeOpportunityRequest(request);
    if (!authorization.ok) return authorization.response;
    return opportunityJson({ profile: authorization.profile });
};

export const PATCH: APIRoute = async ({ request }) => {
    const authorization = await authorizeOpportunityRequest(request);
    if (!authorization.ok) return authorization.response;

    const body = await request.json().catch(() => ({}));
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

    if (body.username !== undefined) {
        const username = normalizeOpportunityUsername(body.username);
        if (!isValidOpportunityUsername(username)) {
            return opportunityJson({ error: 'Use 3–24 lowercase letters, numbers or underscores. This name may be reserved.' }, 400);
        }
        updates.username = username;
    }

    if (body.display_name !== undefined) {
        const displayName = String(body.display_name || '').trim().slice(0, 120);
        if (!displayName) return opportunityJson({ error: 'Display name cannot be empty' }, 400);
        updates.full_name = displayName;
    }

    if (body.is_public !== undefined) {
        if (typeof body.is_public !== 'boolean') {
            return opportunityJson({ error: 'Sharing preference must be true or false' }, 400);
        }
        updates.is_public = body.is_public;
    }

    const { data, error } = await authorization.userClient
        .from('profiles')
        .update(updates)
        .eq('id', authorization.user.id)
        .select('id, username, full_name, avatar_url, is_public, role')
        .single();

    if (error) {
        if (error.code === '23505') return opportunityJson({ error: 'That username is already taken' }, 409);
        if (error.code === '23514') return opportunityJson({ error: 'That username is not available' }, 400);
        return opportunityJson({ error: 'Could not update your profile' }, 500);
    }

    return opportunityJson({
        profile: {
            id: data.id,
            username: data.username,
            display_name: data.full_name || data.username,
            avatar_url: data.avatar_url || null,
            is_public: Boolean(data.is_public),
            role: data.role || 'user',
        },
    });
};
