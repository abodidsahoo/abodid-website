import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({ request }) => {
    try {
        const { token } = await request.json();

        if (!token) {
            return new Response(JSON.stringify({ success: false, error: 'Missing token' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const secretKey = import.meta.env.TURNSTILE_SECRET_KEY;

        if (!secretKey) {
            console.error("Missing TURNSTILE_SECRET_KEY");
            return new Response(JSON.stringify({ success: false, error: 'Server configuration error' }), {
                status: 500
            });
        }

        const formData = new FormData();
        formData.append("secret", secretKey);
        formData.append("response", token);

        // Get IP from request headers
        const ip = request.headers.get("cf-connecting-ip") ||
            request.headers.get("x-forwarded-for") ||
            "";

        if (ip) formData.append("remoteip", ip);

        const response = await fetch(
            "https://challenges.cloudflare.com/turnstile/v0/siteverify",
            { method: "POST", body: formData }
        );

        const result = await response.json();

        return new Response(JSON.stringify(result), {
            status: response.ok ? 200 : 400,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Turnstile verification error:', error);
        return new Response(JSON.stringify({ success: false, error: 'Internal server error' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
