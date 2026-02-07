import type { APIRoute } from 'astro';

export const prerender = false;

// Free-tier models to try in order
// Free-tier models to try in order
const FREE_MODELS = [
    'google/gemini-2.0-flash-lite-preview-02-05:free', // Keep high priority if available
    'mistralai/mistral-small-3.1-24b-instruct:free', // Verified free text model
    'google/gemma-3-27b-it:free', // Verified free text model
    'openrouter/free'
];

async function delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function callOpenRouter(apiKey: string, prompt: string, modelIndex: number = 0, retryCount: number = 0, logs: string[] = []): Promise<{ content: string, model: string, logs: string[] }> {
    if (modelIndex >= FREE_MODELS.length) {
        logs.push(`[Error] All ${FREE_MODELS.length} models exhausted.`);
        throw new Error('All models exhausted');
    }

    const model = FREE_MODELS[modelIndex];
    const attemptLabel = retryCount > 0 ? `(Retry ${retryCount})` : '';
    const startMsg = `Attempting model ${modelIndex + 1}/${FREE_MODELS.length}: ${model} ${attemptLabel}`;
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
                return await callOpenRouter(apiKey, prompt, modelIndex, retryCount + 1, logs);
            }

            const nextMsg = `Switching to fallback model...`;
            logs.push(nextMsg);
            return await callOpenRouter(apiKey, prompt, modelIndex + 1, 0, logs);
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
            return await callOpenRouter(apiKey, prompt, modelIndex, retryCount + 1, logs);
        }
        logs.push(`Moving to next model...`);
        return await callOpenRouter(apiKey, prompt, modelIndex + 1, 0, logs);
    }
}

export const POST: APIRoute = async ({ request }) => {
    try {
        const { comments } = await request.json();

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

        const prompt = `Analyze these human responses:\n${commentList}\n\nReturn EXACTLY 3 evocative, texture-rich words capturing the collective mood (e.g., "Fractured, Solitude, Decay").\nAvoid generic terms.\nOutput ONLY the 3 words, comma-separated.`;

        console.log('[EXTRACT-EMOTIONS] Searching for keywords from', comments.length, 'inputs...');
        console.log('[EXTRACT-EMOTIONS] Generated Prompt:\n', prompt);

        // Call OpenRouter API with fallback logic
        const { content, model, logs } = await callOpenRouter(apiKey, prompt);

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
