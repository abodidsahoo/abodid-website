import { z } from 'zod';
import {
    buildCleanFilename,
    compressText,
    normalizeWhitespace,
    sanitizeFilename
} from './paper-utils';

const MODEL_CANDIDATES = parseModelEnv(
    import.meta.env.OPENROUTER_PAPER_RENAMER_MODELS ||
        import.meta.env.OPENROUTER_RESEARCH_MODELS,
    [
        'openai/gpt-5.2',
        'anthropic/claude-3.5-sonnet',
        'google/gemini-1.5-pro',
        'openrouter/auto',
        'openai/gpt-4o-mini'
    ]
);

const renameResponseSchema = z.object({
    displayTitle: z.string().min(3)
});

export type PaperRenameInput = {
    originalFileName: string;
    fallbackDisplayTitle: string;
    fallbackCleanFileName: string;
    authors: string[];
    year: number | null;
    doi: string | null;
    journal: string | null;
    abstract: string | null;
    extractedPaper: Record<string, unknown>;
};

export type PaperRenameResult = {
    displayTitle: string;
    cleanFileName: string;
    usedOpenRouter: boolean;
    fallbackUsed: boolean;
    modelLabel: string | null;
};

export async function generatePaperRename(
    input: PaperRenameInput
): Promise<PaperRenameResult> {
    const apiKey = import.meta.env.OPENROUTER_API_KEY;

    if (!apiKey) {
        return buildFallbackRename(input);
    }

    const context = [
        `Original filename: ${input.originalFileName}`,
        `Fallback display title: ${input.fallbackDisplayTitle}`,
        `Fallback clean filename: ${input.fallbackCleanFileName}`,
        `Authors: ${input.authors.join(', ') || 'Unknown'}`,
        `Year: ${input.year ?? 'Unknown'}`,
        `DOI: ${input.doi ?? 'Unknown'}`,
        `Journal: ${input.journal ?? 'Unknown'}`,
        `Abstract: ${input.abstract ?? 'Not clearly found'}`,
        `Structured extraction: ${JSON.stringify(input.extractedPaper)}`
    ].join('\n');

    for (const model of MODEL_CANDIDATES) {
        try {
            const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                    'HTTP-Referer':
                        import.meta.env.PUBLIC_SITE_URL ||
                        import.meta.env.SITE ||
                        'https://abodidsahoo.com',
                    'X-Title':
                        import.meta.env.PUBLIC_SITE_NAME ||
                        'Abodid Paper Renamer'
                },
                body: JSON.stringify({
                    model,
                    response_format: { type: 'json_object' },
                    temperature: 0.05,
                    max_tokens: 260,
                    messages: [
                        {
                            role: 'system',
                            content:
                                'You normalize academic paper titles using only the provided metadata. Return a concise human-readable display title only. Do not return filenames. Never turn a DOI, URL, journal name, or author list into the title. Never invent authors, years, or claims.'
                        },
                        {
                            role: 'user',
                            content: `${context}\n\nReturn valid JSON like ${JSON.stringify({
                                displayTitle: 'Readable Paper Title'
                            })}`
                        }
                    ]
                })
            });

            if (!response.ok) {
                continue;
            }

            const payload = await response.json();
            const content = payload?.choices?.[0]?.message?.content;

            if (!content || typeof content !== 'string') {
                continue;
            }

            const cleaned = content.replace(/```json|```/g, '').trim();
            const parsed = renameResponseSchema.parse(JSON.parse(cleaned));

            return {
                displayTitle: normalizeDisplayTitle(
                    parsed.displayTitle,
                    input.fallbackDisplayTitle
                ),
                cleanFileName: buildCleanFilename(
                    {
                        title: normalizeDisplayTitle(
                            parsed.displayTitle,
                            input.fallbackDisplayTitle
                        ),
                        authors: input.authors,
                        year: input.year
                    },
                    input.fallbackDisplayTitle
                ),
                usedOpenRouter: true,
                fallbackUsed: false,
                modelLabel: model
            };
        } catch (_error) {
            continue;
        }
    }

    return buildFallbackRename(input);
}

function buildFallbackRename(input: PaperRenameInput): PaperRenameResult {
    return {
        displayTitle: normalizeDisplayTitle(input.fallbackDisplayTitle),
        cleanFileName:
            sanitizeFilename(input.fallbackCleanFileName) ||
            buildCleanFilename(
                {
                    title: normalizeDisplayTitle(input.fallbackDisplayTitle),
                    authors: input.authors,
                    year: input.year
                },
                input.fallbackDisplayTitle
            ),
        usedOpenRouter: false,
        fallbackUsed: true,
        modelLabel: null
    };
}

function normalizeDisplayTitle(value: string, fallback?: string): string {
    const normalized = normalizeWhitespace(
        value
            .replace(/\.pdf$/i, '')
            .replace(/^["'“”]+|["'“”]+$/g, '')
    );

    if (
        normalized.length < 6 ||
        /^10\.\d{4,9}\//i.test(normalized) ||
        /^https?:\/\//i.test(normalized) ||
        /\b(doi|volume|issue|journal)\b/i.test(normalized)
    ) {
        return compressText(normalizeWhitespace(fallback || 'Paper'), 180);
    }

    return compressText(normalized, 180);
}

function parseModelEnv(value: string | undefined, fallback: string[]): string[] {
    if (!value) {
        return fallback;
    }

    return value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
}
