import type { APIRoute } from 'astro';
const OPENROUTER_API_KEY = import.meta.env.OPENROUTER_API_KEY;
const SITE_URL = import.meta.env.SITE || 'https://abodid.com';
const SITE_NAME = 'Abodid Personal Site';

const AUTO_VISION_MODELS = [
    'openrouter/auto'
];

const PAID_VISION_MODELS = parseModelEnv(
    import.meta.env.OPENROUTER_PAID_VISION_MODELS,
    [
        'openai/gpt-4o-mini',
        'openai/gpt-4o',
        'anthropic/claude-3.5-sonnet',
        'google/gemini-1.5-pro',
    ]
);

const FREE_VISION_MODELS = parseModelEnv(
    import.meta.env.OPENROUTER_FREE_VISION_MODELS,
    [
        'nvidia/nemotron-nano-12b-v2-vl:free',            // Priority 1: Nvidia (Vision)
        'meta-llama/llama-3.2-11b-vision-instruct:free',  // Priority 2: Llama 3.2 Vision (Small)
        'meta-llama/llama-3.2-90b-vision-instruct:free',  // Priority 3: Llama 3.2 Vision (Large)
        'qwen/qwen-2-vl-7b-instruct:free',                // Priority 4: Qwen Vision
        'openrouter/free'                                  // Priority 5: Fallback Router
    ]
);

const VISION_MODELS = Array.from(new Set([
    ...AUTO_VISION_MODELS,
    ...PAID_VISION_MODELS,
    ...FREE_VISION_MODELS,
]));

const MODEL_TIERS: Record<string, 'auto' | 'paid' | 'free'> = {};
AUTO_VISION_MODELS.forEach(m => MODEL_TIERS[m] = 'auto');
PAID_VISION_MODELS.forEach(m => MODEL_TIERS[m] = 'paid');
FREE_VISION_MODELS.forEach(m => {
    if (!MODEL_TIERS[m]) MODEL_TIERS[m] = 'free';
});

// Internal Scoreboard for Model Reliability (In-Memory Hot Cache)
const MODEL_SCORES: Record<string, number> = {};
VISION_MODELS.forEach(m => MODEL_SCORES[m] = 0);

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

function sortByScore(models: string[]) {
    return [...models].sort((a, b) => (MODEL_SCORES[b] || 0) - (MODEL_SCORES[a] || 0));
}

function getOrderedModels(mode: 'free' | 'paid') {
    if (mode === 'paid') {
        return [
            ...sortByScore(AUTO_VISION_MODELS),
            ...sortByScore(PAID_VISION_MODELS),
        ];
    }

    return [
        ...sortByScore(FREE_VISION_MODELS),
        ...sortByScore(AUTO_VISION_MODELS),
        ...sortByScore(PAID_VISION_MODELS),
    ];
}

export const POST: APIRoute = async ({ request }) => {
    try {
        const { imageUrl, userContext, modelMode } = await request.json();
        const mode = parseModelMode(modelMode);

        if (!imageUrl) {
            return new Response(JSON.stringify({ error: "Image URL is required" }), { status: 400 });
        }

        const systemPrompt = `
You are an expert in visual analysis.
Your goal is to analyze the image and identify:
1. visual_summary: A single concise sentence (MAX 15 WORDS) explaining exactly what you see.
2. ai_feeling: A poetic sentence (MAX 10 WORDS) describing the specific emotion or mood you perceive.
3. ai_feeling_keywords: EXACTLY 3 distinct single words that capture the core emotion (e.g., ["Solitude", "Cold", "Silence"]).
4. studium_description: The general interpretation (MAX 15 WORDS).
5. punctum_element: The specific detail that pricks the viewer (MAX 5 WORDS).
6. dominant_emotion: One single word representing the mood.

Output strictly valid JSON:
{
    "visual_summary": "...",
    "ai_feeling": "...",
    "ai_feeling_keywords": ["Word1", "Word2", "Word3"],
    "studium_description": "...",
    "punctum_element": "...",
    "dominant_emotion": "..."
}
`;

        // ... (rest of the file until parseJSON)

        // Robust JSON Parsing Helper
        function parseJSON(text: string) {
            let parsed: any = {};

            // 1. Try Standard JSON Parse
            try {
                const cleanedText = text.replace(/```json/g, '').replace(/```/g, '').trim();
                parsed = JSON.parse(cleanedText);
            } catch (e) {
                // 2. Try Regex Extraction for JSON blocks
                const jsonMatch = text.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    try {
                        parsed = JSON.parse(jsonMatch[0]);
                    } catch (e2) {
                        console.warn("JSON Parse (Inner) Failed. Falling back to text extraction.");
                    }
                }
            }

            // 3. Fallback: If parsing failed completely, treat raw text as content
            if (Object.keys(parsed).length === 0) {
                console.warn("Parsing completely failed. Using raw text as fallback.");
                const cleanRaw = text.replace(/```/g, '').trim().substring(0, 300); // Limit length

                parsed = {
                    visual_summary: cleanRaw,
                    ai_feeling: "Analysis requires data refinement.",
                    dominant_emotion: "Abstract",
                    ai_feeling_keywords: ["Abstract", "Complex", "Undefined"]
                };
            }

            // 4. Defaults & Cleanup (Relaxed Validation)
            if (!parsed.visual_summary) parsed.visual_summary = "Visual data processing...";
            if (!parsed.ai_feeling) parsed.ai_feeling = "Complex emotional resonance.";
            if (!parsed.dominant_emotion) parsed.dominant_emotion = "Ambiguous";
            if (!parsed.punctum_element) parsed.punctum_element = "The overall composition";

            // Ensure arrays are arrays
            if (!Array.isArray(parsed.ai_emotions)) parsed.ai_emotions = [parsed.dominant_emotion];

            // STRICTLY FORCE 3 KEYWORDS
            if (!Array.isArray(parsed.ai_feeling_keywords) || parsed.ai_feeling_keywords.length < 3) {
                // Try to split dominant emotion or ai_feeling if available
                const candidates = [parsed.dominant_emotion, ...(parsed.ai_feeling || "").split(" ")].filter(w => w && w.length > 3);
                parsed.ai_feeling_keywords = candidates.slice(0, 3);

                // Pad with generic terms if still not enough. More unique/poetic defaults.
                const fallbacks = ["Mystery", "Depth", "Silence", "Light", "Shadow", "Void"];
                while (parsed.ai_feeling_keywords.length < 3) {
                    parsed.ai_feeling_keywords.push(fallbacks.pop() || "Unknown");
                }
            }
            // Limit to 3
            parsed.ai_feeling_keywords = parsed.ai_feeling_keywords.slice(0, 3);

            if (!Array.isArray(parsed.emotional_keywords)) parsed.emotional_keywords = parsed.ai_feeling_keywords;

            return parsed;
        }

        const userPrompt = userContext
            ? `Analyze this image. The user also noted: "${userContext}". Consider this but form your own independent visual analysis.`
            : `Analyze this image. Focus on the emotional and psychological impact.`;

        let openRouterErrors: string[] = [];

        // STRATEGY 1: Try OpenRouter Models
        if (OPENROUTER_API_KEY) {
            const sortedModels = getOrderedModels(mode);
            console.log(`[Vision Analysis] Mode ${mode.toUpperCase()} Model Priority:`, sortedModels.map(m => `${m} (${MODEL_SCORES[m]})`));

            for (const model of sortedModels) {
                console.log(`[Vision Analysis] Attempting OpenRouter model: ${model}`);
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
                                {
                                    role: "user",
                                    content: [
                                        { type: "text", text: userPrompt },
                                        { type: "image_url", image_url: { url: imageUrl } }
                                    ]
                                }
                            ]
                        })
                    }, 2, 4000); // 2 Retries, 4s Delay per retry (Giving it time)

                    if (!response.ok) {
                        const errorText = await response.text();
                        const msg = `OpenRouter ${model} failed: ${response.status} - ${errorText.substring(0, 100)}`;
                        console.warn(`[Vision Analysis] ${msg}`);
                        openRouterErrors.push(msg);
                        continue;
                    }

                    const data = await response.json();
                    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
                        const msg = `Invalid format from ${model}`;
                        console.warn(`[Vision Analysis] ${msg}`, JSON.stringify(data).substring(0, 200));
                        openRouterErrors.push(msg);
                        continue;
                    }

                    const content = data.choices[0].message.content;
                    if (!content) {
                        const msg = `Empty content from ${model}`;
                        console.warn(`[Vision Analysis] ${msg}`);
                        openRouterErrors.push(msg);
                        continue;
                    }

                    try {
                        const usedModel = data.model || model;
                        const parsed = parseJSON(content);
                        console.log(`[Vision Analysis] Success with OpenRouter model: ${usedModel}`);
                        // Increment Score for Reliability
                        MODEL_SCORES[model] = (MODEL_SCORES[model] || 0) + 1;

                        return new Response(JSON.stringify({
                            success: true,
                            model_used: usedModel,
                            model_tier: MODEL_TIERS[model] || 'free',
                            ...parsed
                        }), { status: 200 });
                    } catch (parseErr) {
                        const msg = `JSON Parse Error from ${model}: ${parseErr instanceof Error ? parseErr.message : String(parseErr)}`;
                        console.warn(`[Vision Analysis] ${msg}`);
                        console.warn(`[Vision Analysis] Raw content:`, content.substring(0, 500));
                        openRouterErrors.push(msg);
                        continue;
                    }

                } catch (err) {
                    const msg = `Network/Unknown Error with ${model}: ${err instanceof Error ? err.message : String(err)}`;
                    console.warn(`[Vision Analysis] ${msg}`);
                    openRouterErrors.push(msg);
                }
            }
            console.warn("[Vision Analysis] All OpenRouter models failed.");
            openRouterErrors.push("All OpenRouter models failed.");
        } else {
            console.warn("[Vision Analysis] No OPENROUTER_API_KEY found.");
            openRouterErrors.push("No OPENROUTER_API_KEY configured");
        }

        // Analyze errors to return a specific reason if possible
        let specificError = "Analysis failed. AI models unreachable.";
        let statusCode = 500;

        // Check for common critical errors in the logs
        const errorString = openRouterErrors.join(" ");
        if (errorString.includes("401")) {
            specificError = "Authentication Failed (401). Check API Key.";
            statusCode = 401;
        } else if (errorString.includes("402") || errorString.includes("insufficient_quota")) {
            specificError = "Insufficient Credit (402). OpenRouter balance exhausted.";
            statusCode = 402;
        } else if (errorString.includes("429")) {
            specificError = "Rate Limit Exceeded (429). System busy.";
            statusCode = 429;
        }

        return new Response(JSON.stringify({
            error: specificError,
            details: openRouterErrors
        }), { status: statusCode });

    } catch (error) {
        console.error("Analysis API Error:", error);
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

    // Default Fallbacks for critical fields (Relaxed Validation)
    if (!parsed.visual_summary) parsed.visual_summary = "A complex visual scene.";
    if (!parsed.ai_feeling) parsed.ai_feeling = "Intricate and undefined.";
    if (!parsed.dominant_emotion) parsed.dominant_emotion = "Ambiguous";

    // Ensure arrays are arrays
    if (!Array.isArray(parsed.ai_emotions)) parsed.ai_emotions = [parsed.dominant_emotion || "Complex"];
    if (!Array.isArray(parsed.emotional_keywords)) parsed.emotional_keywords = [];

    return parsed;
}

// Helper: Fetch with Retry with Timeout
async function fetchWithRetry(url: string, options: RequestInit, retries = 1, delay = 1000, timeoutMs = 25000): Promise<Response> {
    for (let i = 0; i <= retries; i++) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        try {
            const res = await fetch(url, {
                ...options,
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!res.ok && i < retries && res.status >= 500) {
                // Only retry on server errors
                throw new Error(`Status ${res.status}`);
            }
            return res;
        } catch (err) {
            clearTimeout(timeoutId);
            if (i === retries) throw err;
            const isTimeout = err instanceof Error && err.name === 'AbortError';
            console.warn(`[Fetch Retry] Attempt ${i + 1} failed (${isTimeout ? 'Timeout' : 'Error'}). Retrying in ${delay}ms...`);
            await new Promise(r => setTimeout(r, delay));
        }
    }
    throw new Error("Fetch failed after retries");
}
