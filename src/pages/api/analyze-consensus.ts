import type { APIRoute } from 'astro';

export const prerender = false;

const OPENROUTER_API_KEY = import.meta.env.OPENROUTER_API_KEY;
const SITE_URL = import.meta.env.SITE || 'https://abodid.com';
const SITE_NAME = 'Abodid Personal Site';

// Priority: Fast, Smart, Free (Verified 2024-02-07)
const CONSENSUS_MODELS = [
    'google/gemini-2.0-flash-lite-preview-02-05:free', // Attempting to keep if it comes back
    'nvidia/llama-3.1-nemotron-70b-instruct-hf:free', // Very smart, free
    'mistralai/mistral-small-3.1-24b-instruct:free', // Reliable fallback
    'google/gemma-3-27b-it:free',          // Backup
    'openrouter/free'                       // Ultimate fallback
];

export const POST: APIRoute = async ({ request }) => {
    try {
        if (!OPENROUTER_API_KEY) {
            console.error("Missing OPENROUTER_API_KEY in environment variables.");
            return new Response(JSON.stringify({ error: "Server Configuration Error: Missing API Key" }), { status: 500 });
        }

        const { aiAnalysis, humanComments } = await request.json();

        if (!aiAnalysis || !humanComments || !Array.isArray(humanComments)) {
            return new Response(JSON.stringify({ error: "Invalid input. Requires aiAnalysis and humanComments array." }), { status: 400 });
        }

        const commentsText = humanComments.map(c => `"${c}"`).join("\n- ");

        const systemPrompt = `
You are a data scientist analyzing the "Invisible Punctum" - the gap between machine vision and human emotion.
You will be given:
1. An AI's visual and emotional analysis of an image.
2. A list of actual human responses/feelings about the same image.

Your task is to:
1. Calculate a "Consensus Score" (0-100): How much do the humans agree with *each other*? (High = everyone feels the same, Low = chaos).
2. Calculate a "Trainability Score" (0-100): How well does the AI's analysis align with the *human consensus*? (High = AI understands the human feeling, Low = AI is completely missing the subtle emotional context).
3. Write a "Gap Analysis": A concise, sophisticated paragraph explaining *why* the AI succeeded or failed to capture the human feeling.

Output strictly valid JSON:
{
    "consensus_score": 0,
    "trainability_score": 0,
    "gap_analysis": "...",
    "human_consensus_keywords": ["keyword1", "keyword2"]
}
`;

        const userPrompt = `
AI ANALYSIS:
${JSON.stringify(aiAnalysis, null, 2)}

HUMAN RESPONSES:
- ${commentsText}
`;

        let lastError = null;

        for (const model of CONSENSUS_MODELS) {
            console.log(`[Consensus Analysis] Attempting model: ${model}`);
            try {
                const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
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
                        ]
                        // Removed response_format
                    })
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    console.error(`[Consensus Analysis] Model ${model} failed with status ${response.status}: ${errorText}`);
                    lastError = new Error(`Provider error: ${response.status} - ${errorText}`);
                    continue;
                }

                const data = await response.json();

                if (!data.choices || !data.choices[0] || !data.choices[0].message) {
                    console.error(`[Consensus Analysis] Invalid response format from ${model}:`, JSON.stringify(data));
                    throw new Error("Invalid response format");
                }

                const content = data.choices[0].message.content;
                let parsed;
                try {
                    parsed = JSON.parse(content);
                } catch (e) {
                    const jsonMatch = content.match(/\{[\s\S]*\}/);
                    if (jsonMatch) {
                        try {
                            parsed = JSON.parse(jsonMatch[0]);
                        } catch (e2) {
                            console.error(`[Consensus Analysis] JSON parse failed for ${model}. Content:`, content);
                            throw new Error("Could not parse JSON");
                        }
                    } else {
                        console.error(`[Consensus Analysis] No JSON found in response from ${model}. Content:`, content);
                        throw new Error("Could not parse JSON");
                    }
                }

                console.log(`[Consensus Analysis] Success with model: ${model}`);
                return new Response(JSON.stringify({
                    success: true,
                    model_used: model,
                    ...parsed
                }), { status: 200 });

            } catch (err) {
                console.warn(`[Consensus Analysis] Model ${model} execution error:`, err);
                lastError = err;
            }
        }

        console.error("[Consensus Analysis] All models failed.");
        throw lastError || new Error("All consensus models failed.");

    } catch (error) {
        console.error("Consensus API Error:", error);
        return new Response(JSON.stringify({
            error: error instanceof Error ? error.message : "Internal Server Error"
        }), { status: 500 });
    }
};
