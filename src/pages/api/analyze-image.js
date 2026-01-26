export const prerender = false;

export async function POST({ request }) {
    try {
        const { imageUrl, comments } = await request.json();

        if (!import.meta.env.OPENAI_API_KEY) {
            return new Response(JSON.stringify({ error: "OpenAI API Key not configured" }), {
                status: 500,
                headers: { "Content-Type": "application/json" },
            });
        }

        const systemPrompt = `You are a visual semiotician and aesthetic analyst. Your task is to analyze a photograph and determine its "Punctum" - the accident which pricks, bruises me (Barthes).

    You will be provided with:
    1. The image itself.
    2. A list of human comments/reactions to this image (the "Human Context").

    Your Goal is to perform a comparative analysis between your own visual analysis and the human feedback.

    Output Format (JSON strictly):
    {
      "punctum_analysis": "Short paragraph analyzing the visual impact and the hidden detail (approx 50 words).",
      "human_context_analysis": "Short observation on how humans reacted. Did they agree? (approx 30 words).",
      "trainability_score": number (0-100),
      "verdict": "UNTRAINABLE" | "MIXED" | "TRAINABLE",
      "reasoning": "One sentence summary of why this score was given.",
      "primary_emotion": "The single most dominant emotion perceived by both AI and Humans.",
      "top_secondary_emotions": ["List", "of", "3-5", "secondary", "emotions", "detected"],
      "keywords": ["List", "of", "5", "aesthetic", "keywords"]
    }
    
    Trainability Score Guide:
    - UNTRAINABLE (0-30): Highly subjective, deeper meaning, divergent human responses.
    - TRAINABLE (70-100): Generic, obvious, uniform human responses.
    - MIXED (31-69): Somewhere in between.
    `;

        // Prepare messages for GPT-4o
        const messages = [
            {
                role: "system",
                content: systemPrompt,
            },
            {
                role: "user",
                content: [
                    {
                        type: "text",
                        text: `Here are the human comments associated with this image:\n${JSON.stringify(comments)}\n\nPlease analyze the image and these comments.`,
                    },
                    {
                        type: "image_url",
                        image_url: {
                            url: imageUrl,
                        },
                    },
                ],
            },
        ];

        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${import.meta.env.OPENAI_API_KEY}`,
            },
            body: JSON.stringify({
                model: "gpt-4o",
                messages: messages,
                max_tokens: 300,
                response_format: { type: "json_object" },
            }),
        });

        if (!response.ok) {
            const err = await response.text();
            console.error("OpenAI API Error:", err);
            return new Response(JSON.stringify({ error: "Failed to fetch analysis from OpenAI" }), {
                status: 500,
                headers: { "Content-Type": "application/json" },
            });
        }

        const data = await response.json();
        const analysis = JSON.parse(data.choices[0].message.content);

        return new Response(JSON.stringify(analysis), {
            status: 200,
            headers: { "Content-Type": "application/json" },
        });

    } catch (err) {
        console.error("Server Error:", err);
        return new Response(JSON.stringify({ error: "Internal Server Error" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
        });
    }
}
