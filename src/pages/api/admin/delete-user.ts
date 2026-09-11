export const prerender = false;

import type { APIRoute } from 'astro';
import { authorizeAdminRequest, jsonResponse } from '../../../lib/admin/serverAuth';

export const POST: APIRoute = async ({ request }) => {
    try {
        const authorization = await authorizeAdminRequest(request);
        if (!authorization.ok) return authorization.response;

        const { userId } = await request.json();

        if (!userId) {
            return jsonResponse({ success: false, error: 'Missing userId' }, 400);
        }

        if (userId === authorization.user.id) {
            return jsonResponse({ success: false, error: 'You cannot delete your own admin account.' }, 400);
        }

        const { error } = await authorization.supabase.auth.admin.deleteUser(userId);
        if (error) return jsonResponse({ success: false, error: error.message }, 400);
        return jsonResponse({ success: true });
    } catch (error) {
        return jsonResponse({ success: false, error: 'Server error' }, 500);
    }
};
