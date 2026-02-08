import type { APIRoute } from 'astro';
const OPENROUTER_API_KEY = import.meta.env.OPENROUTER_API_KEY;
const SITE_URL = import.meta.env.SITE || 'https://abodid.com';
const SITE_NAME = 'Abodid Personal Site';

// Priority 1: OpenRouter Free Models
const CONSENSUS_MODELS = [
    'openrouter/free', // Verified working
    'google/gemma-3-27b-it:free',
    'mistralai/mistral-small-24b-instruct-2501:free',
    'meta-llama/llama-3.3-70b-instruct:free',
];

// Internal Scoreboard for Model Reliability
const MODEL_SCORES: Record<string, number> = {};
CONSENSUS_MODELS.forEach(m => MODEL_SCORES[m] = 0);

export const POST: APIRoute = async ({ request }) => {
    try {
        const { aiEmotions, humanEmotions, aiDescription, humanText } = await request.json();

        if (!aiEmotions || !humanEmotions) {
            return new Response(JSON.stringify({ error: "Invalid input. Requires emotion data." }), { status: 400 });
        }

        const systemPrompt = `
You are a precise semantic analyst. 
Task: Compare two perspectives on an image (AI vs Human) to determine their "Consensus Score".

INPUTS:
1. AI Keywords: ${JSON.stringify(aiEmotions)}
2. Human Keywords: ${JSON.stringify(humanEmotions)}
3. AI Description: "${aiDescription || 'N/A'}"
4. Human Text: "${humanText || 'N/A'}"

RULES:
1. Consensus Score (0-100): 
   - Compare BOTH the keywords AND the descriptive text.
   - NEVER 0 or 100. Always a realistic midway number (e.g., 15-85).
   - High Score (>60): AI meaning is very close to Human feeling. Emotions are universally understood.
   - Low Score (<60): AI meaning is different. Emotions are culturally complex.
2. Gap Analysis:
   - Explain *why* the score is what it is, citing specific differences or similarities in the text/keywords.
3. Recommendation:
   - If Low Score: State clearly that "Significant social data is needed to train the AI on this context."
   - If High Score: State that "The visual semantics are universally aligned."

Output strictly valid JSON:
{
    "consensus_score": 0,
    "social_context_score": 0,
    "gap_analysis": "string (Two sentences max)",
    "trainability_score": 0
}
`;

        const userPrompt = `
AI FELT: "${aiDescription || aiEmotions.join(', ')}"
HUMANS FELT: "${humanText || humanEmotions.join(', ')}"

Compare these two emotional reactions.
`;

        // STRATEGY 1: OpenRouter Models (Optimized for Speed)
        if (OPENROUTER_API_KEY) {
            // Dynamic Sort
            const sortedModels = [...CONSENSUS_MODELS].sort((a, b) => (MODEL_SCORES[b] || 0) - (MODEL_SCORES[a] || 0));
            console.log("[Consensus Analysis] Model Priority:", sortedModels.map(m => `${m} (${MODEL_SCORES[m]})`));

            for (const model of sortedModels) {
                console.log(`[Consensus Analysis] Attempting OpenRouter model: ${model}`);
                try {
                    const response = await fetchWithRetry("https://openrouter.ai/api/v1/chat/completions", {
                        method: "POST",
                        headers: {
                            "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
                            "Content-Type": "application/json",
                            "HTTP-Referer": SITE_URL,
                            "X-Title": SITE_NAME,
                        },
                        body: JSON.stringify({
                            model: model,
                            messages: [
                                { role: "system", content: systemPrompt },
                                { role: "user", content: userPrompt }
                            ],
                            temperature: 0.1, // Near zero for strict analysis
                            max_tokens: 200
                        })
                    }, 2, 4000); // 2 Retries, 4s Delay

                    if (!response.ok) {
                        const errorText = await response.text();
                        console.warn(`[Consensus Analysis] OpenRouter ${model} failed: ${response.status} - ${errorText.substring(0, 100)}`);
                        continue;
                    }

                    const data = await response.json();
                    if (!data.choices?.length || !data.choices[0]?.message?.content) {
                        console.warn(`[Consensus Analysis] Invalid format from ${model}`);
                        continue;
                    }

                    const content = data.choices[0].message.content;
                    const parsed = parseJSON(content);

                    console.log(`[Consensus Analysis] Success with OpenRouter model: ${model}`);
                    // Increment Score
                    MODEL_SCORES[model] = (MODEL_SCORES[model] || 0) + 1;

                    return new Response(JSON.stringify({
                        success: true,
                        model_used: model,
                        ...parsed
                    }), { status: 200 });

                } catch (err) {
                    console.warn(`[Consensus Analysis] Error with ${model}:`, err);
                }
            }
            console.warn("[Consensus Analysis] All OpenRouter models failed.");
        } else {
            console.warn("[Consensus Analysis] No OPENROUTER_API_KEY, skipping analysis.");
        }

        return new Response(JSON.stringify({ error: "All providers exhausted." }), { status: 500 });

    } catch (error) {
        console.error("Consensus API Error:", error);
        return new Response(JSON.stringify({
            error: error instanceof Error ? error.message : "Internal Server Error"
        }), { status: 500 });
    }
};

// Robust JSON Parsing Helper
function parseJSON(text: string) {
    let parsed: any = {};
    try {
        const cleanedText = text.replace(/```json/g, '').replace(/```/g, '').trim();
        parsed = JSON.parse(cleanedText);
    } catch (e) {
        // Fallback: Try to find JSON object structure
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            try {
                parsed = JSON.parse(jsonMatch[0]);
            } catch (e2) {
                console.error("JSON Parse Error (Inner):", e2);
            }
        } else {
            console.error("JSON Parse Error (Outer):", e);
        }
    }

    // Defaults for Consensus
    if (parsed.consensus_score === undefined) parsed.consensus_score = 50;
    if (!parsed.gap_analysis) parsed.gap_analysis = "Analysis incomplete. Social context required.";
    if (!parsed.social_context_score) parsed.social_context_score = 100 - parsed.consensus_score;

    return parsed;
}

// Helper: Fetch with Retry
async function fetchWithRetry(url: string, options: RequestInit, retries = 1, delay = 1000): Promise<Response> {
    for (let i = 0; i <= retries; i++) {
        try {
            const res = await fetch(url, options);
            if (!res.ok && i < retries && res.status >= 500) {
                // Only retry on server errors
                throw new Error(`Status ${res.status}`);
            }
            return res;
        } catch (err) {
            if (i === retries) throw err;
            console.warn(`[Fetch Retry] Attempt ${i + 1} failed. Retrying in ${delay}ms...`);
            await new Promise(r => setTimeout(r, delay));
        }
    }
    throw new Error("Fetch failed after retries");
}
