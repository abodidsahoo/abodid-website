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

        const { error } = await authorization.supabase.auth.admin.updateUserById(userId, { email_confirm: true });
        if (error) return jsonResponse({ success: false, error: error.message }, 400);
        return jsonResponse({ success: true });
    } catch (error) {
        return jsonResponse({ success: false, error: 'Server error' }, 500);
    }
};
