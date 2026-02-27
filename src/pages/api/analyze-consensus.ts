import type { APIRoute } from 'astro';
const OPENROUTER_API_KEY = import.meta.env.OPENROUTER_API_KEY;
const SITE_URL = import.meta.env.SITE || 'https://abodid.com';
const SITE_NAME = 'Abodid Personal Site';

// Priority 0: OpenRouter Auto Router (preferred)
const AUTO_CONSENSUS_MODELS = [
    'openrouter/auto'
];

// Priority 1: OpenRouter Paid Models (preferred)
const PAID_CONSENSUS_MODELS = parseModelEnv(
    import.meta.env.OPENROUTER_PAID_MODELS,
    [
        // Sensible paid defaults (override via OPENROUTER_PAID_MODELS)
        'openai/gpt-4o-mini',
        'anthropic/claude-3.5-sonnet',
        'google/gemini-1.5-pro',
    ]
);

// Priority 2: OpenRouter Free Models (fallback)
const FREE_CONSENSUS_MODELS = parseModelEnv(
    import.meta.env.OPENROUTER_FREE_MODELS,
    [
        'openrouter/free', // Verified working
        'google/gemma-3-27b-it:free',
        'mistralai/mistral-small-24b-instruct-2501:free',
        'meta-llama/llama-3.3-70b-instruct:free',
    ]
);

const CONSENSUS_MODELS = Array.from(new Set([
    ...AUTO_CONSENSUS_MODELS,
    ...PAID_CONSENSUS_MODELS,
    ...FREE_CONSENSUS_MODELS,
]));

const MODEL_TIERS: Record<string, 'auto' | 'paid' | 'free'> = {};
AUTO_CONSENSUS_MODELS.forEach(m => MODEL_TIERS[m] = 'auto');
PAID_CONSENSUS_MODELS.forEach(m => MODEL_TIERS[m] = 'paid');
FREE_CONSENSUS_MODELS.forEach(m => {
    if (!MODEL_TIERS[m]) MODEL_TIERS[m] = 'free';
});

// Internal Scoreboard for Model Reliability
const MODEL_SCORES: Record<string, number> = {};
CONSENSUS_MODELS.forEach(m => MODEL_SCORES[m] = 0);

export const POST: APIRoute = async ({ request }) => {
    try {
        const payload = await request.json();
        const { aiEmotions, humanEmotions } = coerceConsensusInputs(payload);
        const modelMode = parseModelMode(payload?.modelMode);

        if (!aiEmotions.length || !humanEmotions.length) {
            return new Response(JSON.stringify({ error: "Invalid input. Requires emotion data." }), { status: 400 });
        }

        // SIMPLIFIED PROMPT FOR TROUBLESHOOTING
        const systemPrompt = `
You are a helpful AI.
AI Keywords: ${JSON.stringify(aiEmotions)}
Human Keywords: ${JSON.stringify(humanEmotions)}

Task: Write a simple 2-line summary of how these feelings relate. 
Also provide a "consensus_percentage" (an integer 0-100) based on their similarity.

Output strictly valid JSON:
{
    "consensus_percentage": number,
    "context_explanation": "Your 2-line summary here."
}
`;

        const userPrompt = `
AI: [${aiEmotions.join(', ')}]
HUMAN: [${humanEmotions.join(', ')}]

Compare.
`;

        // STRATEGY 1: OpenRouter Models with auto-retry
        if (OPENROUTER_API_KEY) {
            const maxPasses = Number(import.meta.env.CONSENSUS_MAX_PASSES || 2);
            const passDelayMs = Number(import.meta.env.CONSENSUS_PASS_DELAY_MS || 1500);

            for (let pass = 1; pass <= maxPasses; pass++) {
                const sortedModels = getOrderedModels(modelMode);
                console.log(`[Consensus Analysis] Mode ${modelMode.toUpperCase()} Pass ${pass}/${maxPasses} Model Priority:`, sortedModels.map(m => `${m} (${MODEL_SCORES[m]})`));

                let paidExhausted = false;

                for (const model of sortedModels) {
                    const tier = MODEL_TIERS[model] || 'free';
                    if (paidExhausted && (tier === 'auto' || tier === 'paid')) continue;

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
                        }, {
                            retries: 2,
                            baseDelayMs: 800,
                            timeoutMs: 20000
                        });

                        if (!response.ok) {
                            const errorInfo = await parseOpenRouterError(response);
                            console.warn(`[Consensus Analysis] OpenRouter ${model} failed: ${errorInfo.status} - ${errorInfo.message}`);
                            if (errorInfo.status === 402 && (tier === 'auto' || tier === 'paid')) {
                                paidExhausted = true; // Skip remaining paid models
                            }
                            continue;
                        }

                        const data = await response.json();
                        if (!data.choices?.length || !data.choices[0]?.message?.content) {
                            console.warn(`[Consensus Analysis] Invalid format from ${model}`);
                            continue;
                        }

                        const content = data.choices[0].message.content;
                        const parsed = parseJSON(content);
                        const usedModel = data.model || model;

                        console.log(`[Consensus Analysis] Success with OpenRouter model: ${usedModel}`);
                        // Increment Score
                        MODEL_SCORES[model] = (MODEL_SCORES[model] || 0) + 1;

                        return new Response(JSON.stringify({
                            success: true,
                            model_used: usedModel,
                            model_tier: MODEL_TIERS[model] || 'free',
                            ...parsed
                        }), { status: 200 });

                    } catch (err) {
                        console.warn(`[Consensus Analysis] Error with ${model}:`, err);
                    }
                }

                if (pass < maxPasses) {
                    await sleep(passDelayMs * pass);
                }
            }

            console.warn("[Consensus Analysis] All OpenRouter models failed. Falling back to heuristic consensus.");
        } else {
            console.warn("[Consensus Analysis] No OPENROUTER_API_KEY, skipping analysis. Using heuristic consensus.");
        }

        const fallback = heuristicConsensus(aiEmotions, humanEmotions);
        return new Response(JSON.stringify({
            success: false,
            fallback_used: true,
            model_used: "fallback/heuristic",
            model_tier: "local",
            ...fallback
        }), { status: 200 });

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
        const jsonMatch = text.match(/\{.*\}/);
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

    // Defaults for Consensus (Refined 3v3)
    if (parsed.consensus_percentage === undefined) parsed.consensus_percentage = 50;
    if (!parsed.context_explanation) parsed.context_explanation = "More social context is needed for the AI to understand.";

    // Remove old fields
    delete parsed.consensus_score;
    delete parsed.gap_analysis;

    return parsed;
}

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
            ...sortByScore(AUTO_CONSENSUS_MODELS),
            ...sortByScore(PAID_CONSENSUS_MODELS),
        ];
    }

    return [
        ...sortByScore(FREE_CONSENSUS_MODELS),
        ...sortByScore(AUTO_CONSENSUS_MODELS),
        ...sortByScore(PAID_CONSENSUS_MODELS),
    ];
}

function normalizeKeywords(value: unknown, max = 3): string[] {
    const raw = Array.isArray(value)
        ? value
        : typeof value === 'string'
            ? value.split(/[\s,]+/)
            : [];
    const clean = raw
        .map(v => String(v).trim())
        .filter(v => v.length > 0 && v.length < 50);
    const unique: string[] = [];
    for (const item of clean) {
        const normalized = item.toLowerCase();
        if (!unique.find(u => u.toLowerCase() === normalized)) {
            unique.push(item);
        }
        if (unique.length >= max) break;
    }
    return unique;
}

function coerceConsensusInputs(payload: any): { aiEmotions: string[]; humanEmotions: string[] } {
    // Current contract: { aiEmotions, humanEmotions }
    if (payload?.aiEmotions || payload?.humanEmotions) {
        return {
            aiEmotions: normalizeKeywords(payload.aiEmotions),
            humanEmotions: normalizeKeywords(payload.humanEmotions),
        };
    }

    // Legacy contract: { aiAnalysis, humanComments }
    const aiFromLegacy = payload?.aiAnalysis?.emotional_keywords
        || payload?.aiAnalysis?.ai_emotions
        || payload?.aiAnalysis?.dominant_emotion
        || payload?.aiAnalysis?.emotion
        || [];

    const humanFromLegacy = payload?.humanComments || payload?.comments || [];

    return {
        aiEmotions: normalizeKeywords(aiFromLegacy),
        humanEmotions: normalizeKeywords(humanFromLegacy),
    };
}

function heuristicConsensus(aiEmotions: string[], humanEmotions: string[]) {
    const ai = normalizeKeywords(aiEmotions, 3);
    const human = normalizeKeywords(humanEmotions, 3);

    const aiSet = new Set(ai.map(v => v.toLowerCase()));
    const humanSet = new Set(human.map(v => v.toLowerCase()));

    const union = new Set([...aiSet, ...humanSet]);
    let overlap = 0;
    for (const v of aiSet) {
        if (humanSet.has(v)) overlap += 1;
    }

    const consensus_percentage = union.size > 0
        ? Math.round((overlap / union.size) * 100)
        : 50;

    const shared = [...aiSet].filter(v => humanSet.has(v));
    const context_explanation = shared.length > 0
        ? `Both AI and humans align on ${shared.join(', ')}. The overlap suggests a clear emotional convergence.`
        : `AI and human emotions diverge in this round. Similarity is low, indicating a split interpretation.`;

    return {
        consensus_percentage,
        context_explanation,
    };
}

async function parseOpenRouterError(response: Response): Promise<{ status: number; message: string }> {
    const status = response.status;
    let message = `HTTP ${status}`;
    try {
        const text = await response.text();
        if (!text) return { status, message };
        try {
            const json = JSON.parse(text);
            message = json?.error?.message || json?.message || text;
        } catch {
            message = text;
        }
    } catch {
        // Ignore parse failure
    }
    return { status, message: message.slice(0, 200) };
}

function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Helper: Fetch with Retry + Timeout
async function fetchWithRetry(
    url: string,
    options: RequestInit,
    config: { retries: number; baseDelayMs: number; timeoutMs: number }
): Promise<Response> {
    const { retries, baseDelayMs, timeoutMs } = config;

    for (let i = 0; i <= retries; i++) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        try {
            const res = await fetch(url, {
                ...options,
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            if (!res.ok && i < retries && shouldRetryStatus(res.status)) {
                const backoff = calculateBackoff(baseDelayMs, i);
                console.warn(`[Fetch Retry] Status ${res.status}. Retrying in ${backoff}ms...`);
                await sleep(backoff);
                continue;
            }

            return res;
        } catch (err) {
            clearTimeout(timeoutId);
            if (i === retries) throw err;
            const backoff = calculateBackoff(baseDelayMs, i);
            console.warn(`[Fetch Retry] Attempt ${i + 1} failed. Retrying in ${backoff}ms...`);
            await sleep(backoff);
        }
    }

    throw new Error("Fetch failed after retries");
}

function shouldRetryStatus(status: number) {
    return status === 429 || status === 408 || status === 409 || (status >= 500 && status < 600);
}

function calculateBackoff(baseDelayMs: number, attempt: number) {
    const jitter = Math.floor(Math.random() * 250);
    const delay = Math.min(8000, baseDelayMs * Math.pow(2, attempt));
    return delay + jitter;
}
