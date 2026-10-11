import type { APIRoute } from 'astro';

export const prerender = false;

const retired = () => new Response(JSON.stringify({
    error: 'Curator passcode access has been retired. Sign in with Google instead.',
    login_url: '/opportunities',
}), {
    status: 410,
    headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
    },
});

export const GET: APIRoute = retired;
export const POST: APIRoute = retired;
export const DELETE: APIRoute = retired;
