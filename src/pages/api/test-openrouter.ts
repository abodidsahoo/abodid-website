
import type { APIRoute } from 'astro';

export const prerender = false;

const FREE_MODELS = [
    'google/gemini-2.0-flash-lite-preview-02-05:free',
    'meta-llama/llama-3.3-70b-instruct:free',
    'meta-llama/llama-3.2-11b-vision-instruct:free',
    'mistralai/mistral-7b-instruct:free'
];

export const GET: APIRoute = async ({ request }) => {
    const apiKey = import.meta.env.OPENROUTER_API_KEY;
    const results = [];

    if (!apiKey) {
        return new Response(JSON.stringify({ error: "Missing API Key" }), { status: 500 });
    }

    for (const model of FREE_MODELS) {
        try {
            const start = Date.now();
            const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                    'HTTP-Referer': 'https://test.com',
                    'X-Title': 'Test Script'
                },
                body: JSON.stringify({
                    model,
                    messages: [{ role: 'user', content: 'Say "Test OK" if you hear me.' }]
                })
            });

            const data = await response.json();
            const time = Date.now() - start;

            results.push({
                model,
                status: response.status,
                success: response.ok,
                time: `${time}ms`,
                response: data
            });

        } catch (err) {
            results.push({
                model,
                success: false,
                error: err.message
            });
        }
    }

    return new Response(JSON.stringify(results, null, 2), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
    });
};
