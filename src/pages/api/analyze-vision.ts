import type { APIRoute } from 'astro';

export const prerender = false;

const OPENROUTER_API_KEY = import.meta.env.OPENROUTER_API_KEY;
const SITE_URL = import.meta.env.SITE || 'https://abodid.com';
const SITE_NAME = 'Abodid Personal Site';

// Priority: Vision capable, Free/Low-cost, Reliable (Verified 2024-02-07)
const VISION_MODELS = [
    'nvidia/nemotron-nano-12b-v2-vl:free', // Confirmed Free + Vision
    'google/gemma-3-27b-it:free',          // Confirmed Free + Vision
    'mistralai/mistral-small-3.1-24b-instruct:free', // Confirmed Free + Vision
    'openrouter/free'                       // Ultimate fallback
];

export const POST: APIRoute = async ({ request }) => {
    try {
        if (!OPENROUTER_API_KEY) {
            console.error("Missing OPENROUTER_API_KEY in environment variables.");
            return new Response(JSON.stringify({ error: "Server Configuration Error: Missing API Key" }), { status: 500 });
        }

        const { imageUrl, userContext } = await request.json();

        if (!imageUrl) {
            return new Response(JSON.stringify({ error: "Image URL is required" }), { status: 400 });
        }

        const systemPrompt = `
You are an expert in visual analysis and Roland Barthes' concept of "punctum".
Your goal is to analyze the image and identify:
1. visual_summary: A single concise sentence (one line) explaining exactly what you see in the image (the subjects, colors, setting).
2. ai_feeling: A poetic sentence describing the specific emotion or mood that YOU, as an AI, perceive or "feel" when looking at this image.
3. studium_description: The general cultural, linguistic, and political interpretation.
4. punctum_element: The detail that pricks, bruises, or pierces the viewer.
5. emotional_atmosphere: A poetic but precise description of the mood.

Output strictly valid JSON with this structure:
{
    "visual_summary": "...",
    "ai_feeling": "...",
    "studium_description": "...",
    "punctum_element": "...",
    "emotional_keywords": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5"],
    "emotional_atmosphere": "...",
    "dominant_emotion": "..."
}
`;

        const userPrompt = userContext
            ? `Analyze this image. The user also noted: "${userContext}". Consider this but form your own independent visual analysis.`
            : `Analyze this image. Focus on the emotional and psychological impact.`;

        let lastError = null;

        for (const model of VISION_MODELS) {
            console.log(`[Vision Analysis] Attempting model: ${model}`);
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
                            {
                                role: "user",
                                content: [
                                    { type: "text", text: userPrompt },
                                    { type: "image_url", image_url: { url: imageUrl } }
                                ]
                            }
                        ]
                        // Removed response_format to improve compatibility with Llama/Free models
                    })
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    console.error(`[Vision Analysis] Model ${model} failed with status ${response.status}: ${errorText}`);
                    lastError = new Error(`Provider error: ${response.status} - ${errorText}`);
                    continue; // Try next model
                }

                const data = await response.json();

                if (!data.choices || !data.choices[0] || !data.choices[0].message) {
                    console.error(`[Vision Analysis] Invalid response format from ${model}:`, JSON.stringify(data));
                    throw new Error("Invalid response format from provider");
                }

                const content = data.choices[0].message.content;
                let parsed;
                try {
                    parsed = JSON.parse(content);
                } catch (e) {
                    // Fallback if model didn't return pure JSON
                    const jsonMatch = content.match(/\{[\s\S]*\}/);
                    if (jsonMatch) {
                        try {
                            parsed = JSON.parse(jsonMatch[0]);
                        } catch (e2) {
                            console.error(`[Vision Analysis] JSON parse failed for ${model}. Content:`, content);
                            throw new Error("Could not parse JSON from model response");
                        }
                    } else {
                        console.error(`[Vision Analysis] No JSON found in response from ${model}. Content:`, content);
                        throw new Error("Could not parse JSON from model response");
                    }
                }

                console.log(`[Vision Analysis] Success with model: ${model}`);
                return new Response(JSON.stringify({
                    success: true,
                    model_used: model,
                    ...parsed
                }), { status: 200 });

            } catch (err) {
                console.warn(`[Vision Analysis] Model ${model} execution error:`, err);
                lastError = err;
            }
        }

        console.error("[Vision Analysis] All models failed.");
        throw lastError || new Error("All vision models failed to respond.");

    } catch (error) {
        console.error("Analysis API Error:", error);
        return new Response(JSON.stringify({
            error: error instanceof Error ? error.message : "Internal Server Error"
        }), { status: 500 });
    }
};
