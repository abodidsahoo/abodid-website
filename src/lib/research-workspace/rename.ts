import { z } from 'zod';
import {
    buildCleanFilename,
    sanitizeFilename
} from './paper-utils';

const MODEL_CANDIDATES = parseModelEnv(
    import.meta.env.OPENROUTER_RESEARCH_MODELS,
    [
        'openrouter/auto',
        'openai/gpt-4o-mini',
        'google/gemini-2.0-flash-lite-preview-02-05:free'
    ]
);

const renameResponseSchema = z.object({
    displayTitle: z.string().min(3),
    cleanedFileName: z.string().min(3)
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
                        'Abodid Research Workspace'
                },
                body: JSON.stringify({
                    model,
                    response_format: { type: 'json_object' },
                    temperature: 0.1,
                    max_tokens: 350,
                    messages: [
                        {
                            role: 'system',
                            content:
                                'You rename academic PDFs using only the provided metadata. Return a concise human-readable display title and a cleaned filename in the format first-author-last-name-year-short-title.pdf. Never invent authors, years, or claims.'
                        },
                        {
                            role: 'user',
                            content: `${context}\n\nReturn valid JSON like ${JSON.stringify({
                                displayTitle: 'Readable Paper Title',
                                cleanedFileName: 'author-2024-short-title.pdf'
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
                displayTitle: parsed.displayTitle.trim(),
                cleanFileName: normalizeReturnedFilename(
                    parsed.cleanedFileName,
                    input
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

function normalizeReturnedFilename(value: string, input: PaperRenameInput): string {
    const fallback = buildFallbackRename(input).cleanFileName;
    const safe = sanitizeFilename(value);

    if (!safe || safe === 'paper.pdf') {
        return fallback;
    }

    return safe;
}

function buildFallbackRename(input: PaperRenameInput): PaperRenameResult {
    return {
        displayTitle: input.fallbackDisplayTitle,
        cleanFileName:
            sanitizeFilename(input.fallbackCleanFileName) ||
            buildCleanFilename(
                {
                    title: input.fallbackDisplayTitle,
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

function parseModelEnv(value: string | undefined, fallback: string[]): string[] {
    if (!value) {
        return fallback;
    }

    return value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
}
