import {
    DEFAULT_MOODBOARD_TAGGING_MODEL,
    MASTER_TAG_HARD_MAX,
    MASTER_TAG_SYSTEM_PROMPT,
    MASTER_TAGGING_VERSION,
    buildMasterTagUserPrompt,
    parseMasterTagResponse,
} from "./tagging";

type MasterTagRequest = {
    imageUrl: string;
    title?: unknown;
    artistName?: unknown;
    existingTags?: unknown;
    vocabularyHints?: unknown;
};

const runtimeEnv = (name: string) => (
    (typeof import.meta !== "undefined" && import.meta.env?.[name]) ||
    process.env[name] ||
    ""
).trim();

const safeImageUrl = (value: string) => {
    try {
        const url = new URL(value);
        if (url.protocol !== "https:" && url.protocol !== "http:") return "";
        return url.href;
    } catch {
        return "";
    }
};

const tagsResponseSchema = {
    type: "object",
    additionalProperties: false,
    required: ["tags"],
    properties: {
        tags: {
            type: "array",
            maxItems: MASTER_TAG_HARD_MAX,
            items: {
                type: "string",
                minLength: 1,
                maxLength: 80,
            },
        },
    },
};

export const requestMasterTags = async (input: MasterTagRequest) => {
    const apiKey = runtimeEnv("OPENROUTER_API_KEY");
    if (!apiKey) throw new Error("OPENROUTER_API_KEY is not configured.");

    const imageUrl = safeImageUrl(input.imageUrl);
    if (!imageUrl) throw new Error("The moodboard image URL is invalid.");

    const model = runtimeEnv("MOODBOARD_TAGGING_MODEL") || DEFAULT_MOODBOARD_TAGGING_MODEL;
    const siteUrl = runtimeEnv("PUBLIC_SITE_URL") || "https://abodid.com";
    const startedAt = performance.now();
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": siteUrl,
            "X-Title": "Abodid Master Tag Builder",
        },
        body: JSON.stringify({
            model,
            temperature: 0.2,
            max_tokens: 500,
            reasoning: { max_tokens: 0 },
            response_format: {
                type: "json_schema",
                json_schema: {
                    name: "master_moodboard_tags",
                    strict: true,
                    schema: tagsResponseSchema,
                },
            },
            messages: [
                { role: "system", content: MASTER_TAG_SYSTEM_PROMPT },
                {
                    role: "user",
                    content: [
                        {
                            type: "text",
                            text: buildMasterTagUserPrompt({
                                title: input.title,
                                artistName: input.artistName,
                                existingTags: input.existingTags,
                                vocabularyHints: input.vocabularyHints,
                            }),
                        },
                        { type: "image_url", image_url: { url: imageUrl } },
                    ],
                },
            ],
        }),
        signal: AbortSignal.timeout(45_000),
    });

    if (!response.ok) {
        const details = (await response.text()).slice(0, 500);
        console.error("Master Tag Builder request failed:", response.status, details);
        throw new Error(`The tagging model failed (HTTP ${response.status}).`);
    }

    const payload = await response.json() as Record<string, unknown>;
    const usage = payload.usage && typeof payload.usage === "object"
        ? payload.usage as Record<string, unknown>
        : {};

    return {
        tags: parseMasterTagResponse(payload),
        model: typeof payload.model === "string" ? payload.model : model,
        version: MASTER_TAGGING_VERSION,
        latencyMs: Math.round(performance.now() - startedAt),
        usage: {
            promptTokens: Number(usage.prompt_tokens) || 0,
            completionTokens: Number(usage.completion_tokens) || 0,
            totalTokens: Number(usage.total_tokens) || 0,
            costUsd: Number(usage.cost) || null,
        },
    };
};
