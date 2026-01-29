import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({ request }) => {
    try {
        console.log('[TEST API] Request received');

        const { messages } = await request.json();
        console.log('[TEST API] Messages:', messages);

        const apiKey = import.meta.env.OPENROUTER_API_KEY;
        console.log('[TEST API] API Key exists:', !!apiKey);
        console.log('[TEST API] API Key length:', apiKey?.length);

        // Direct test of OpenRouter API
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'https://abodidsahoo.com',
                'X-Title': 'Abodid Sahoo Test'
            },
            body: JSON.stringify({
                model: 'meta-llama/llama-3.3-70b-instruct:free',
                messages: [
                    { role: 'user', content: 'Say hello in one word' }
                ]
            })
        });

        console.log('[TEST API] OpenRouter status:', response.status);
        const data = await response.json();
        console.log('[TEST API] OpenRouter full response:', JSON.stringify(data, null, 2));

        if (!response.ok) {
            return new Response(
                JSON.stringify({
                    error: 'OpenRouter API error',
                    status: response.status,
                    response: data
                }),
                {
                    status: 500,
                    headers: { 'Content-Type': 'application/json' }
                }
            );
        }

        const message = data.choices?.[0]?.message?.content || 'No response';

        return new Response(
            JSON.stringify({
                success: true,
                message,
                model: data.model,
                status: response.status,
                fullResponse: data
            }),
            {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            }
        );
    } catch (error) {
        console.error('[TEST API] Error:', error);
        return new Response(
            JSON.stringify({
                error: error instanceof Error ? error.message : 'Unknown error',
                stack: error instanceof Error ? error.stack : undefined
            }),
            {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            }
        );
    }
};
