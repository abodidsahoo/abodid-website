import type { APIRoute } from 'astro';

export const prerender = false;

// Free-tier models to try in order
const FREE_MODELS = [
    'meta-llama/llama-3.3-70b-instruct:free',
    'google/gemini-2.0-flash-exp:free',
    'meta-llama/llama-3.1-8b-instruct:free',
    'google/gemini-flash-1.5:free'
];

async function callOpenRouter(apiKey: string, prompt: string, modelIndex: number = 0): Promise<string> {
    if (modelIndex >= FREE_MODELS.length) {
        throw new Error('All models exhausted');
    }

    const model = FREE_MODELS[modelIndex];
    console.log(`[EXTRACT-EMOTIONS] Trying model ${modelIndex + 1}/${FREE_MODELS.length}: ${model}`);

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': import.meta.env.PUBLIC_SITE_URL || 'https://abodid.com',
            'X-Title': 'Invisible Punctum - Emotion Analysis'
        },
        body: JSON.stringify({
            model,
            messages: [
                {
                    role: 'user',
                    content: prompt
                }
            ]
        })
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));

        // If rate limited (402 or 429), try next model
        if (response.status === 402 || response.status === 429) {
            console.warn(`[EXTRACT-EMOTIONS] Model ${model} is rate-limited, trying next...`);
            return await callOpenRouter(apiKey, prompt, modelIndex + 1);
        }

        throw new Error(`OpenRouter API error: ${response.status} - ${JSON.stringify(errorData)}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
}

export const POST: APIRoute = async ({ request }) => {
    try {
        const { comments } = await request.json();

        // Return empty keywords if no comments
        if (!comments || !Array.isArray(comments) || comments.length === 0) {
            return new Response(JSON.stringify({ keywords: [] }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const apiKey = import.meta.env.OPENROUTER_API_KEY;
        if (!apiKey) {
            console.warn('[EXTRACT-EMOTIONS] Missing OPENROUTER_API_KEY');
            return new Response(JSON.stringify({
                error: 'API key not configured',
                keywords: []
            }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Create analysis prompt
        const commentList = comments
            .filter(Boolean)
            .map((c, i) => `${i + 1}. "${c}"`)
            .join('\n');

        const prompt = `You are analyzing human emotional responses to a photograph in the "Invisible Punctum" experiment.

Below are all the comments people shared about what they feel when looking at a specific photograph:

${commentList}

Analyze these comments deeply. Look for patterns, recurring themes, and the collective emotional essence they express.

Respond with EXACTLY THREE WORDS that best capture the emotional themes in these comments. These should be evocative, specific, and poetic—not generic emotions like "happy" or "sad".

Examples of good keywords: "Nostalgic Longing", "Fractured Peace", "Quiet Chaos", "Melancholic Joy"

Return ONLY the three words, separated by commas, with no explanations or additional text.`;

        console.log('[EXTRACT-EMOTIONS] Analyzing', comments.length, 'comments');

        // Call OpenRouter API with fallback logic
        const content = await callOpenRouter(apiKey, prompt);

        console.log('[EXTRACT-EMOTIONS] LLM Response:', content);

        // Parse the response (expecting 3 keywords separated by commas)
        const keywords = content
            .split(',')
            .map(k => k.trim())
            .filter(k => k.length > 0 && k.length < 50) // Basic sanitation
            .slice(0, 3); // Ensure we only get 3

        console.log('[EXTRACT-EMOTIONS] Extracted keywords:', keywords);

        return new Response(JSON.stringify({ keywords }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (err) {
        console.error('[EXTRACT-EMOTIONS] Error:', err);

        // Fallback to simple analysis if LLM fails
        const fallbackKeywords = ['Emotional', 'Reflective', 'Human'];

        return new Response(JSON.stringify({
            keywords: fallbackKeywords,
            fallback: true
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};
