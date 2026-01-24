import type { APIRoute } from 'astro';
import { updateUserRole } from '../../../lib/resources/admin';

export const POST: APIRoute = async ({ request, locals }) => {
    try {
        // Check if user is authenticated and admin
        const session = await locals.runtime.env.supabase.auth.getSession();
        if (!session?.data?.session) {
            return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const { userId, role } = await request.json();

        if (!userId || !role) {
            return new Response(JSON.stringify({ success: false, error: 'Missing parameters' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        if (!['user', 'curator', 'admin'].includes(role)) {
            return new Response(JSON.stringify({ success: false, error: 'Invalid role' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const result = await updateUserRole(userId, role);

        return new Response(JSON.stringify(result), {
            status: result.success ? 200 : 400,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        return new Response(JSON.stringify({ success: false, error: 'Server error' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};
