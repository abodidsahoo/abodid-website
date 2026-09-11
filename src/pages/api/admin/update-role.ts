export const prerender = false;

import type { APIRoute } from 'astro';
import { authorizeAdminRequest, jsonResponse } from '../../../lib/admin/serverAuth';

export const POST: APIRoute = async ({ request }) => {
    try {
        const authorization = await authorizeAdminRequest(request);
        if (!authorization.ok) return authorization.response;

        const { userId, role } = await request.json();

        if (!userId || !role) {
            return jsonResponse({ success: false, error: 'Missing parameters' }, 400);
        }

        if (!['user', 'curator', 'admin'].includes(role)) {
            return jsonResponse({ success: false, error: 'Invalid role' }, 400);
        }

        if (userId === authorization.user.id && role !== 'admin') {
            return jsonResponse({ success: false, error: 'You cannot remove your own admin access.' }, 400);
        }

        const { error } = await authorization.supabase
            .from('profiles')
            .update({ role, updated_at: new Date().toISOString() })
            .eq('id', userId);
        if (error) return jsonResponse({ success: false, error: error.message }, 400);
        return jsonResponse({ success: true });
    } catch (error) {
        return jsonResponse({ success: false, error: 'Server error' }, 500);
    }
};
