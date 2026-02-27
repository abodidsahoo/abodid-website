import type { APIRoute } from 'astro';

export const prerender = false;

const AUTO_MODELS = [
    'openrouter/auto'
];

const PAID_MODELS = parseModelEnv(
    import.meta.env.OPENROUTER_PAID_TEXT_MODELS,
    [
        'openai/gpt-4o-mini',
        'anthropic/claude-3.5-sonnet',
        'google/gemini-1.5-pro',
    ]
);

const FREE_MODELS = parseModelEnv(
    import.meta.env.OPENROUTER_FREE_TEXT_MODELS,
    [
        'google/gemini-2.0-flash-lite-preview-02-05:free', // Keep high priority if available
        'mistralai/mistral-small-3.1-24b-instruct:free', // Verified free text model
        'google/gemma-3-27b-it:free', // Verified free text model
        'openrouter/free'
    ]
);

function parseModelEnv(value: string | undefined, fallback: string[]): string[] {
    if (!value) return fallback;
    return value
        .split(',')
        .map(v => v.trim())
        .filter(Boolean);
}

function parseModelMode(value: any): 'free' | 'paid' {
    return value === 'paid' ? 'paid' : 'free';
}

async function delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function callOpenRouter(
    apiKey: string,
    prompt: string,
    models: string[],
    modelIndex: number = 0,
    retryCount: number = 0,
    logs: string[] = []
): Promise<{ content: string, model: string, logs: string[] }> {
    if (modelIndex >= models.length) {
        logs.push(`[Error] All ${models.length} models exhausted.`);
        throw new Error('All models exhausted');
    }

    const model = models[modelIndex];
    const attemptLabel = retryCount > 0 ? `(Retry ${retryCount})` : '';
    const startMsg = `Attempting model ${modelIndex + 1}/${models.length}: ${model} ${attemptLabel}`;
    console.log(`[EXTRACT-EMOTIONS] ${startMsg}`);
    logs.push(startMsg);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            signal: controller.signal,
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': import.meta.env.PUBLIC_SITE_URL || 'https://abodidsahoo.com',
                'X-Title': import.meta.env.PUBLIC_SITE_NAME || 'Abodid Sahoo'
            },
            body: JSON.stringify({
                model,
                messages: [{ role: 'user', content: prompt }]
            })
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            const failMsg = `[FAILURE] ${model}: Status ${response.status} (${errorData.error?.message || 'AI Grid Error'})`;
            console.warn(`[EXTRACT-EMOTIONS] ${failMsg}`);
            logs.push(failMsg);

            if ((response.status === 429 || response.status >= 500) && retryCount < 2) {
                const retryMsg = `Self-healing: Retrying ${model} in 2s...`;
                logs.push(retryMsg);
                await delay(2000);
                return await callOpenRouter(apiKey, prompt, models, modelIndex, retryCount + 1, logs);
            }

            const nextMsg = `Switching to fallback model...`;
            logs.push(nextMsg);
            return await callOpenRouter(apiKey, prompt, models, modelIndex + 1, 0, logs);
        }

        const data = await response.json();
        const usedModel = data.model || model;
        const content = data.choices?.[0]?.message?.content || '';

        logs.push(`Success with ${usedModel}!`);
        return { content, model: usedModel, logs };

    } catch (err: any) {
        clearTimeout(timeoutId);
        const isTimeout = err.name === 'AbortError';
        const errorMsg = isTimeout ? 'Timeout (15s limit)' : (err.message || String(err));

        console.warn(`[EXTRACT-EMOTIONS] Model ${model} error: ${errorMsg}`);
        logs.push(`Error: ${errorMsg}`);

        if (retryCount < 1) {
            logs.push(`Retrying once...`);
            await delay(1000);
            return await callOpenRouter(apiKey, prompt, models, modelIndex, retryCount + 1, logs);
        }
        logs.push(`Moving to next model...`);
        return await callOpenRouter(apiKey, prompt, models, modelIndex + 1, 0, logs);
    }
}

export const POST: APIRoute = async ({ request }) => {
    try {
        const { comments, modelMode } = await request.json();
        const mode = parseModelMode(modelMode);

        // Return empty keywords if no comments
        if (!comments || !Array.isArray(comments) || comments.length === 0) {
            return new Response(JSON.stringify({ keywords: [], model: "None" }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const apiKey = import.meta.env.OPENROUTER_API_KEY;
        if (!apiKey) {
            return new Response(JSON.stringify({
                error: 'Server Config Error: Missing API Key',
                keywords: ["System", "Config", "Error"]
            }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Create analysis prompt
        const commentList = comments
            .filter(Boolean)
            .map((c: string, i: number) => `${i + 1}. "${c}"`)
            .join('\n');

        const prompt = `Analyze these human responses:\n${commentList}\n\nReturn EXACTLY 3 simple, clean human emotions capturing the core feeling (e.g., "Sadness, Joy, Anger").\nAvoid complex or evocative poetry.\nOutput ONLY the 3 words, comma-separated.`;

        console.log('[EXTRACT-EMOTIONS] Searching for keywords from', comments.length, 'inputs...');
        console.log('[EXTRACT-EMOTIONS] Generated Prompt:\n', prompt);

        const logs: string[] = [];
        let content = '';
        let model = '';

        if (mode === 'paid') {
            logs.push('[Mode] PAID (Auto Router)');
            try {
                ({ content, model } = await callOpenRouter(apiKey, prompt, AUTO_MODELS, 0, 0, logs));
            } catch (err) {
                logs.push('Auto router failed. Switching to paid model list...');
                ({ content, model } = await callOpenRouter(apiKey, prompt, PAID_MODELS, 0, 0, logs));
            }
        } else {
            logs.push('[Mode] FREE (Paid Fallback)');
            try {
                ({ content, model } = await callOpenRouter(apiKey, prompt, FREE_MODELS, 0, 0, logs));
            } catch (err) {
                logs.push('Free models exhausted. Switching to paid fallback...');
                try {
                    ({ content, model } = await callOpenRouter(apiKey, prompt, AUTO_MODELS, 0, 0, logs));
                } catch (err2) {
                    ({ content, model } = await callOpenRouter(apiKey, prompt, PAID_MODELS, 0, 0, logs));
                }
            }
        }

        // Parse the response
        const keywords = content
            .replace(/["\.]/g, '') // Remove quotes/periods
            .split(',')
            .map(k => k.trim())
            .filter(k => k.length > 0 && k.length < 50)
            .slice(0, 3);

        // Ensure we always have 3 for UI consistency
        while (keywords.length < 3) keywords.push("Undefined");

        console.log('[EXTRACT-EMOTIONS] Extracted:', keywords, 'Algorithm:', model);

        return new Response(JSON.stringify({
            keywords,
            model_used: model,
            logs, // Return the execution logs
            prompt: prompt // Expose prompt for debugging/user visibility
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (err) {
        console.error('[EXTRACT-EMOTIONS] Critical Error:', err);
        return new Response(JSON.stringify({
            keywords: ['Signal', 'Lost', 'Entropy'],
            model_used: "Fallback System",
            error: err instanceof Error ? err.message : "Unknown Error"
        }), {
            status: 200, // Return 200 so UI doesn't crash, just shows fallback
            headers: { 'Content-Type': 'application/json' }
        });
    }
};
