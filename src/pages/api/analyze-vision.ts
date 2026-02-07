import type { APIRoute } from 'astro';
import { GoogleGenerativeAI } from '@google/generative-ai';

export const prerender = false;

const OPENROUTER_API_KEY = import.meta.env.OPENROUTER_API_KEY;
const GOOGLE_API_KEY = import.meta.env.GOOGLE_API_KEY;
const SITE_URL = import.meta.env.SITE || 'https://abodid.com';
const SITE_NAME = 'Abodid Personal Site';

// Priority 1: OpenRouter Free Models
const VISION_MODELS = [
    'nvidia/nemotron-nano-12b-v2-vl:free', // Confirmed Free + Vision
    'google/gemma-3-27b-it:free',          // Confirmed Free + Vision
    'mistralai/mistral-small-3.1-24b-instruct:free', // Confirmed Free + Vision
    'openrouter/free'                       // Ultimate fallback
];

// Priority 2: Google SDK Direct (Fallback)
const GOOGLE_FALLBACK_MODEL = 'gemini-1.5-pro';

export const POST: APIRoute = async ({ request }) => {
    try {
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
    "ai_emotions": ["emotion1", "emotion2", "emotion3"],
    "emotional_keywords": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5"],
    "emotional_atmosphere": "...",
    "dominant_emotion": "..."
}
`;

        const userPrompt = userContext
            ? `Analyze this image. The user also noted: "${userContext}". Consider this but form your own independent visual analysis.`
            : `Analyze this image. Focus on the emotional and psychological impact.`;

        // STRATEGY 1: Try OpenRouter Models
        if (OPENROUTER_API_KEY) {
            for (const model of VISION_MODELS) {
                console.log(`[Vision Analysis] Attempting OpenRouter model: ${model}`);
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
                        })
                    });

                    if (!response.ok) {
                        const errorText = await response.text();
                        console.warn(`[Vision Analysis] OpenRouter ${model} failed: ${response.status} - ${errorText}`);
                        continue; // Try next OpenRouter model
                    }

                    const data = await response.json();
                    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
                        console.warn(`[Vision Analysis] Invalid format from ${model}`);
                        continue;
                    }

                    const content = data.choices[0].message.content;
                    const parsed = parseJSON(content); // Helper function

                    console.log(`[Vision Analysis] Success with OpenRouter model: ${model}`);
                    return new Response(JSON.stringify({
                        success: true,
                        model_used: model,
                        ...parsed
                    }), { status: 200 });

                } catch (err) {
                    console.warn(`[Vision Analysis] Error with ${model}:`, err);
                    // Continue to next model
                }
            }
            console.warn("[Vision Analysis] All OpenRouter models failed. Attempting Google Fallback...");
        } else {
            console.warn("[Vision Analysis] No OPENROUTER_API_KEY found, skipping directly to Google fallback.");
        }


        // STRATEGY 2: Google SDK Fallback
        if (GOOGLE_API_KEY) {
            console.log(`[Vision Analysis] Attempting Google Gemini Fallback (${GOOGLE_FALLBACK_MODEL})...`);

            try {
                const genAI = new GoogleGenerativeAI(GOOGLE_API_KEY);
                const model = genAI.getGenerativeModel({ model: GOOGLE_FALLBACK_MODEL });

                // Fetch image and convert to base64 for Gemini SDK
                const imageResponse = await fetch(imageUrl);
                if (!imageResponse.ok) throw new Error(`Failed to fetch image: ${imageResponse.statusText}`);
                const imageArrayBuffer = await imageResponse.arrayBuffer();
                const imageBase64 = Buffer.from(imageArrayBuffer).toString('base64');
                const mimeType = imageResponse.headers.get('content-type') || 'image/jpeg';

                const result = await model.generateContent([
                    systemPrompt,
                    userPrompt,
                    { inlineData: { data: imageBase64, mimeType: mimeType } }
                ]);

                const response = await result.response;
                const text = response.text();
                const parsed = parseJSON(text);

                console.log(`[Vision Analysis] Success with Google Fallback: ${GOOGLE_FALLBACK_MODEL}`);
                return new Response(JSON.stringify({
                    success: true,
                    model_used: `google/${GOOGLE_FALLBACK_MODEL} (fallback)`,
                    ...parsed
                }), { status: 200 });

            } catch (googleErr) {
                console.error("[Vision Analysis] Google Fallback failed:", googleErr);
                throw new Error("All analysis strategies (OpenRouter + Google) failed.");
            }
        } else {
            console.error("[Vision Analysis] No GOOGLE_API_KEY provided for fallback.");
            throw new Error("Analysis failed: all providers exhausted.");
        }

    } catch (error) {
        console.error("Analysis API Error:", error);
        return new Response(JSON.stringify({
            error: error instanceof Error ? error.message : "Internal Server Error"
        }), { status: 500 });
    }
};


// Robust JSON Parsing Helper
function parseJSON(text: string) {
    try {
        const cleanedText = text.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(cleanedText);
    } catch (e) {
        // Fallback: Try to find JSON object structure
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            try {
                return JSON.parse(jsonMatch[0]);
            } catch (e2) {
                throw new Error("Could not parse JSON from model response");
            }
        }
        throw new Error("Could not parse JSON from model response");
    }
}
