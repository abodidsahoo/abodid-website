import type { APIRoute } from 'astro';

const MODELS = [
    'google/gemma-3-27b-it:free',      // Confirmed Free + High Quality
    'mistralai/mistral-small-3.1-24b-instruct:free', // Confirmed Free
    'openrouter/free'
];

export const POST: APIRoute = async ({ request }) => {
    let processLogs: string[] = []; // Trace log
    const log = (msg: string) => processLogs.push(`[${new Date().toISOString().split('T')[1].slice(0, 8)}] ${msg}`);

    try {
        log('Received request.');
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
                content: `You are a helpful AI assistant. Be conversational and helpful.`,
            },
            ...messages,
        ];
        log('Context prepared.');

        let lastError = null;
        let successfulResponse = null;
        let usedModel = '';

        const startTime = Date.now();

        // Fallback Loop
        for (const model of MODELS) {
            try {
                log(`Attempting model: ${model.split('/')[1].split(':')[0]}...`);
                const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${apiKey}`,
                        'Content-Type': 'application/json',
                        'HTTP-Referer': import.meta.env.PUBLIC_SITE_URL || 'https://abodidsahoo.com',
                        'X-Title': import.meta.env.PUBLIC_SITE_NAME || 'Abodid Sahoo'
                    },
                    body: JSON.stringify({
                        model: model,
                        messages: enhancedMessages,
                        temperature: 0.7,
                        max_tokens: 1000,
                    })
                });

                const data = await response.json();

                if (response.ok) {
                    successfulResponse = data;
                    usedModel = model;
                    log(`Success with ${model.split('/')[1].split(':')[0]}!`);
                    break; // Success! Exit loop.
                } else {
                    log(`Failed: ${data.error?.message || 'Unknown error'}`);
                    console.warn(`[CHAT API] Model ${model} failed:`, data.error?.message);
                    lastError = data;
                    // Continue to next model
                }
            } catch (err) {
                const errorMessage = err instanceof Error ? err.message : String(err);
                log(`Network Error for ${model}: ${errorMessage}`);
                console.error(`[CHAT API] Error calling model ${model}:`, err);
                lastError = err;
            }
        }

        if (!successfulResponse) {
            return new Response(
                JSON.stringify({
                    error: 'All models failed to respond.',
                    lastError: lastError,
                    logs: processLogs
                }),
                {
                    status: 503,
                    headers: { 'Content-Type': 'application/json' }
                }
            );
        }

        const latency = Date.now() - startTime;
        const assistantMessage = successfulResponse.choices?.[0]?.message?.content || 'No response generated';
        const actualModel = successfulResponse.model || usedModel;
        log(`Response generated in ${latency}ms.`);

        // Return response with logs
        return new Response(
            JSON.stringify({
                message: assistantMessage,
                logs: processLogs,
                metadata: {
                    model: actualModel,
                    is_free: actualModel.includes(':free') || actualModel.includes('/free'),
                    latency_ms: latency,
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
                logs: processLogs,
                stack: error instanceof Error ? error.stack : undefined
            }),
            {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            }
        );
    }
};
