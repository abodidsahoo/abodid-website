import type { APIRoute } from 'astro';
import {
    verifyPassword,
    createSessionToken,
    setAuthCookie,
    clearAuthCookie,
    isRequestAuthenticated,
} from '../../../lib/opportunities/auth';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies }) => {
    try {
        const body = await request.json().catch(() => ({}));
        const { password } = body;

        if (!password || typeof password !== 'string') {
            return new Response(JSON.stringify({ error: 'Password is required' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        if (!verifyPassword(password)) {
            return new Response(JSON.stringify({ error: 'Invalid password' }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const token = createSessionToken();
        setAuthCookie(cookies, token);

        return new Response(JSON.stringify({ success: true, token }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (err: any) {
        return new Response(JSON.stringify({ error: err?.message || 'Server authentication error' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
};

export const GET: APIRoute = async ({ request, cookies }) => {
    const authenticated = isRequestAuthenticated(request, cookies);
    return new Response(JSON.stringify({ authenticated }), {
        status: authenticated ? 200 : 401,
        headers: { 'Content-Type': 'application/json' },
    });
};

export const DELETE: APIRoute = async ({ cookies }) => {
    clearAuthCookie(cookies);
    return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
    });
};
