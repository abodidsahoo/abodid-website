import type { APIRoute } from 'astro';
import { GoogleGenerativeAI } from '@google/generative-ai';

export const prerender = false;

const OPENROUTER_API_KEY = import.meta.env.OPENROUTER_API_KEY;
const GOOGLE_API_KEY = import.meta.env.GOOGLE_API_KEY;
const SITE_URL = import.meta.env.SITE || 'https://abodid.com';
const SITE_NAME = 'Abodid Personal Site';

// Priority 1: OpenRouter Free Models
const CONSENSUS_MODELS = [
    'google/gemini-2.0-flash-lite-preview-02-05:free', // Attempting to keep if it works
    'nvidia/llama-3.1-nemotron-70b-instruct-hf:free', // Very smart, free
    'mistralai/mistral-small-3.1-24b-instruct:free', // Reliable fallback
    'google/gemma-3-27b-it:free',          // Backup
    'openrouter/free'                       // Ultimate fallback
];

// Priority 2: Google SDK Direct (Fallback)
const GOOGLE_FALLBACK_MODEL = 'gemini-1.5-pro';

export const POST: APIRoute = async ({ request }) => {
    try {
        const { aiAnalysis, humanComments, humanKeywords } = await request.json();

        if (!aiAnalysis || !humanComments || !Array.isArray(humanComments)) {
            return new Response(JSON.stringify({ error: "Invalid input. Requires aiAnalysis and humanComments array." }), { status: 400 });
        }

        const commentsText = humanComments.map(c => `"${c}"`).join("\n- ");
        const humanEmotionsSource = humanKeywords && humanKeywords.length > 0 ? humanKeywords : humanComments;
        const humanSourceLabel = humanKeywords && humanKeywords.length > 0 ? "HUMAN EMOTIONS (Extracted Keywords)" : "HUMAN RESPONSES (Raw Text)";

        const systemPrompt = `
You are a data scientist analyzing the "Invisible Punctum" - the gap between machine vision and human emotion.
You will be given:
1. An AI's visual and emotional analysis of an image.
2. A list of actual human responses/feelings about the same image.

Your task is to:
1. Calculate a "Consensus Score" (0-100): REALISTICALLY assess agreement. (100 = Identical words, 50 = Some overlap, 0 = Chaos). DO NOT DEFAULT TO 100.
2. Write a "Consensus Summary": A single sentence description of the human agreement level (e.g. "Humans were unanimous in their feeling of joy." or "Human responses were highly fragmented.").
3. Calculate a "Trainability Score" (0-100): How well does the AI's analysis align with the *human consensus*? (High = AI understands the human feeling, Low = AI is completely missing the subtle emotional context).
4. Write a "Gap Analysis": A concise, sophisticated paragraph explaining *why* the AI succeeded or failed to capture the human feeling.

Output strictly valid JSON:
{
    "consensus_score": 72,
    "consensus_summary": "...",
    "trainability_score": 45,
    "gap_analysis": "...",
    "human_consensus_keywords": ["keyword1", "keyword2"]
}
`;

        const userPrompt = `
AI EMOTIONS (Machine Vision):
${JSON.stringify(aiAnalysis.ai_emotions || [], null, 2)}

${humanSourceLabel}:
${JSON.stringify(humanEmotionsSource, null, 2)}

GAP ANALYSIS:
Compare the "AI Emotions" with the "Human Emotions".
- If they share similar meaning (e.g. "Joy" vs "Happiness"), the Consensus Score is HIGH.
- If they are opposites (e.g. "Joy" vs "Sadness"), the Consensus Score is LOW.
`;

        // STRATEGY 1: OpenRouter Models
        if (OPENROUTER_API_KEY) {
            for (const model of CONSENSUS_MODELS) {
                console.log(`[Consensus Analysis] Attempting OpenRouter model: ${model}`);
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
                        })
                    });

                    if (!response.ok) {
                        const errorText = await response.text();
                        console.warn(`[Consensus Analysis] OpenRouter ${model} failed: ${response.status} - ${errorText}`);
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
                    return new Response(JSON.stringify({
                        success: true,
                        model_used: model,
                        ...parsed
                    }), { status: 200 });

                } catch (err) {
                    console.warn(`[Consensus Analysis] Error with ${model}:`, err);
                }
            }
            console.warn("[Consensus Analysis] All OpenRouter models failed. Attempting Google Fallback...");
        } else {
            console.warn("[Consensus Analysis] No OPENROUTER_API_KEY, skipping to Google fallback.");
        }


        // STRATEGY 2: Google SDK Fallback
        if (GOOGLE_API_KEY) {
            console.log(`[Consensus Analysis] Attempting Google Gemini Fallback (${GOOGLE_FALLBACK_MODEL})...`);

            try {
                const genAI = new GoogleGenerativeAI(GOOGLE_API_KEY);
                const model = genAI.getGenerativeModel({ model: GOOGLE_FALLBACK_MODEL });

                const result = await model.generateContent([
                    systemPrompt,
                    userPrompt
                ]);

                const response = await result.response;
                const text = response.text();
                const parsed = parseJSON(text);

                console.log(`[Consensus Analysis] Success with Google Fallback: ${GOOGLE_FALLBACK_MODEL}`);
                return new Response(JSON.stringify({
                    success: true,
                    model_used: `google/${GOOGLE_FALLBACK_MODEL} (fallback)`,
                    ...parsed
                }), { status: 200 });

            } catch (googleErr) {
                console.error("[Consensus Analysis] Google Fallback failed:", googleErr);
                throw new Error("All analysis strategies (OpenRouter + Google) failed.");
            }
        } else {
            console.error("[Consensus Analysis] No GOOGLE_API_KEY provided for fallback.");
            throw new Error("Analysis failed: all providers exhausted.");
        }

    } catch (error) {
        console.error("Consensus API Error:", error);
        return new Response(JSON.stringify({
            error: error instanceof Error ? error.message : "Internal Server Error"
        }), { status: 500 });
    }
};

function parseJSON(text: string) {
    try {
        const cleanedText = text.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(cleanedText);
    } catch (e) {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) return JSON.parse(jsonMatch[0]);
        throw new Error("Parsing failed");
    }
}
