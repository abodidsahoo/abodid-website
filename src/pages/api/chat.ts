import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({ request }) => {
    try {
        const { messages } = await request.json();

        if (!messages || !Array.isArray(messages)) {
            return new Response(
                JSON.stringify({ error: 'Invalid request. Expected messages array.' }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
        }

        const apiKey = import.meta.env.OPENROUTER_API_KEY;

        if (!apiKey) {
            return new Response(
                JSON.stringify({ error: 'OpenRouter API key not configured' }),
                { status: 500, headers: { 'Content-Type': 'application/json' } }
            );
        }

        // Add system message
        const enhancedMessages = [
            {
                role: 'system',
                content: `You are a helpful AI assistant in LLM Testing mode. 
Be conversational and helpful.
Note: You do not have internet access and can only provide information from your training data.
If asked about current events or real-time information, politely mention this limitation.`,
            },
            ...messages,
        ];

        // Call OpenRouter API directly
        const startTime = Date.now();
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': import.meta.env.PUBLIC_SITE_URL || 'https://abodidsahoo.com',
                'X-Title': import.meta.env.PUBLIC_SITE_NAME || 'Abodid Sahoo'
            },
            body: JSON.stringify({
                model: 'meta-llama/llama-3.3-70b-instruct:free',
                messages: enhancedMessages,
                temperature: 0.7,
                max_tokens: 1000
            })
        });

        const latency = Date.now() - startTime;
        const data = await response.json();

        if (!response.ok) {
            console.error('[CHAT API] OpenRouter error:', data);
            return new Response(
                JSON.stringify({
                    error: data.error?.message || 'OpenRouter API error',
                    details: data
                }),
                {
                    status: 500,
                    headers: { 'Content-Type': 'application/json' }
                }
            );
        }

        const assistantMessage = data.choices?.[0]?.message?.content || 'No response generated';

        // Return simplified response
        return new Response(
            JSON.stringify({
                message: assistantMessage,
                metadata: {
                    model: data.model,
                    is_free: data.model.includes(':free'),
                    latency_ms: latency,
                    internet_access: false,
                    quota: {
                        used_this_minute: 0, // Simplified for now
                        max_per_minute: 20,
                        used_today: 0,
                        max_per_day: 1000,
                    },
                },
            }),
            {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            }
        );
    } catch (error) {
        console.error('[CHAT API] ERROR:', error);
        return new Response(
            JSON.stringify({
                error: error instanceof Error ? error.message : 'Unknown error occurred',
                stack: error instanceof Error ? error.stack : undefined
            }),
            {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            }
        );
    }
};
