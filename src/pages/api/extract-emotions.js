
import { createClient } from "@supabase/supabase-js";

export const prerender = false;

// We use this model because it detects 28 diverse emotions (e.g. "curiosity", "admiration", "confusion") 
// which is perfect for the "specific unique keywords" requirement.
const HF_MODEL = "SamLowe/roberta-base-go_emotions";
const HF_API_URL = `https://router.huggingface.co/hf-inference/models/${HF_MODEL}`;

export async function POST({ request }) {
    try {
        const { comments } = await request.json();

        if (!comments || !Array.isArray(comments) || comments.length === 0) {
            return new Response(JSON.stringify({ keywords: [] }), { status: 200 });
        }

        const apiKey = import.meta.env.HUGGINGFACE_API_KEY;
        if (!apiKey) {
            console.warn("Missing HUGGINGFACE_API_KEY");
            // Fallback: Return empty or mock if key is missing to prevent crash
            return new Response(JSON.stringify({ keywords: ["CONFIG_MISSING"] }), { status: 200 });
        }

        // HF Inference API accepts array of strings. 
        // We truncate to last 10 comments to ensure speed/limits.
        const inputs = comments.slice(-10);

        const response = await fetch(HF_API_URL, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${apiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ inputs }),
        });

        if (!response.ok) {
            const err = await response.text();
            throw new Error(`HF API Error: ${err}`);
        }

        const result = await response.json();

        // Result is an array (per input) of arrays (scores for labels)
        // [ [ { label: 'neutral', score: 0.9 }, ... ], ... ]

        // Aggregate scores
        const emotionScores = {};

        // Flatten checks (HF API can sometimes return errors as object instead of array)
        if (Array.isArray(result) && Array.isArray(result[0])) {
            result.forEach(commentResult => {
                // For each comment, take the top prediction OR sum all weights?
                // Let's sum weights for a "Vibe Consensus"
                commentResult.forEach(({ label, score }) => {
                    if (label === 'neutral') return; // Skip neutral
                    emotionScores[label] = (emotionScores[label] || 0) + score;
                });
            });
        }

        // Sort and pick Top 3
        const top3 = Object.entries(emotionScores)
            .sort((a, b) => b[1] - a[1]) // Descending score
            .slice(0, 3)
            .map(e => e[0]); // Get Label

        return new Response(JSON.stringify({ keywords: top3 }), {
            status: 200,
            headers: { "Content-Type": "application/json" }
        });

    } catch (err) {
        console.error("HF Extraction Error:", err);
        return new Response(JSON.stringify({ error: err.message, keywords: [] }), { status: 500 });
    }
}
