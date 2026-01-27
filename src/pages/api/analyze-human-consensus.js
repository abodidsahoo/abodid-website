
export const prerender = false;

// We use the same powerful emotion model
const HF_MODEL = "SamLowe/roberta-base-go_emotions";
const HF_API_URL = `https://router.huggingface.co/hf-inference/models/${HF_MODEL}`;

export async function POST({ request }) {
    try {
        const { comments } = await request.json();

        if (!comments || comments.length === 0) {
            return new Response(JSON.stringify({
                consensus_score: 0,
                label: "NO DATA",
                summary: "Not enough voices to form a consensus."
            }));
        }

        const apiKey = import.meta.env.HUGGINGFACE_API_KEY;
        const inputs = comments.slice(-15); // Analyze last 15 for consensus

        const response = await fetch(HF_API_URL, {
            method: "POST",
            headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({ inputs }),
        });

        if (!response.ok) throw new Error("HF API Error");

        const result = await response.json();

        // --- LOGIC: Sentiment Grouping Consensus ---
        const SENTIMENTS = {
            POSITIVE: ['admiration', 'amusement', 'excitement', 'joy', 'love', 'optimism', 'pride', 'relief', 'gratitude', 'desire'],
            NEGATIVE: ['anger', 'annoyance', 'disappointment', 'disapproval', 'disgust', 'embarrassment', 'fear', 'grief', 'nervousness', 'remorse', 'sadness'],
            AMBIGUOUS: ['confusion', 'curiosity', 'realization', 'surprise', 'neutral', 'caring']
        };

        const allLabels = [];
        const sentimentCounts = { POSITIVE: 0, NEGATIVE: 0, AMBIGUOUS: 0 };

        result.forEach(r => {
            // Take top label
            r.sort((a, b) => b.score - a.score);
            const label = r[0].label;
            allLabels.push(label);

            // Categorize
            if (SENTIMENTS.POSITIVE.includes(label)) sentimentCounts.POSITIVE++;
            else if (SENTIMENTS.NEGATIVE.includes(label)) sentimentCounts.NEGATIVE++;
            else sentimentCounts.AMBIGUOUS++;
        });

        const totalVotes = allLabels.length;

        // 1. Strict Consensus (Exact label match)
        const labelCounts = {};
        allLabels.forEach(l => labelCounts[l] = (labelCounts[l] || 0) + 1);
        const topStrictCount = Object.values(labelCounts).sort((a, b) => b - a)[0] || 0;
        const strictScore = totalVotes > 0 ? (topStrictCount / totalVotes) * 100 : 0;
        const topStrictLabel = Object.keys(labelCounts).find(k => labelCounts[k] === topStrictCount);

        // 2. Broad Consensus (Sentiment category match)
        const topSentimentCount = Math.max(...Object.values(sentimentCounts));
        const broadScore = totalVotes > 0 ? (topSentimentCount / totalVotes) * 100 : 0;
        const topSentimentCategory = Object.keys(sentimentCounts).find(k => sentimentCounts[k] === topSentimentCount);

        // 3. Final Score Calculation
        // We favor Strict Score if it's high (>40%), otherwise we lean on Broad Score
        let finalScore = 0;
        let label = "CHAOTIC DIVERGENCE";
        let summary = "";

        // Customize curve
        if (strictScore > 40) {
            // High specific agreement
            finalScore = Math.min(100, Math.round(strictScore * 1.5)); // Boost it
            label = finalScore > 80 ? "UNIFIED RESONANCE" : "STRONG CONSENSUS";
            summary = `A precise alignment: ${Math.round(strictScore)}% of voices specifically felt '${topStrictLabel}'.`;
        } else if (broadScore > 60) {
            // High broad agreement but low specific
            finalScore = Math.min(90, Math.round(broadScore * 1.2));
            label = "THEMATIC HARMONY";
            summary = `While words differed, ${Math.round(broadScore)}% of voices shared a ${topSentimentCategory} sentiment.`;
        } else {
            // Low agreement overall
            finalScore = Math.round(broadScore);
            label = finalScore < 30 ? "FRACTURED PERCEPTION" : "LOOSE ASSOCIATION";
            summary = "Perceptions are scattered across the emotional spectrum.";
        }

        return new Response(JSON.stringify({
            consensus_score: finalScore,
            label,
            summary
        }));

    } catch (err) {
        return new Response(JSON.stringify({ error: err.message, consensus_score: 50, label: "ANALYSIS_FAILED" }));
    }
}
