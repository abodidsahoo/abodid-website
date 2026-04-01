import { z } from 'zod';
import type {
    ExtractedPage,
    InsightQuote,
    InsightSection,
    InsightSectionId,
    InsightSnapshotField,
    InsightSnapshotFieldId,
    InsightSnapshotGroup,
    PageProvenance,
    PaperInsightSummary
} from './contracts';
import {
    compressText,
    mergeProvenance,
    normalizeWhitespace,
    pickBestSnippet
} from './paper-utils';

const SECTION_ORDER: InsightSectionId[] = [
    'about',
    'objective',
    'methods',
    'findings',
    'conclusion',
    'quotes',
    'human-detail'
];

const SNAPSHOT_FIELD_ORDER: InsightSnapshotFieldId[] = [
    'paper-about',
    'construct',
    'research-focus',
    'people',
    'participants',
    'location',
    'conducted-by',
    'conclusion'
];

const SNAPSHOT_GROUPS = [
    {
        id: 'paper',
        heading: 'Paper',
        fieldIds: ['paper-about', 'construct']
    },
    {
        id: 'study',
        heading: 'Study',
        fieldIds: ['research-focus', 'people', 'participants']
    },
    {
        id: 'context',
        heading: 'Context',
        fieldIds: ['location', 'conducted-by']
    },
    {
        id: 'outcome',
        heading: 'Outcome',
        fieldIds: ['conclusion']
    }
] as const;

const MODEL_CANDIDATES = parseModelEnv(
    import.meta.env.OPENROUTER_PAPER_INSIGHT_MODELS ||
        import.meta.env.OPENROUTER_RESEARCH_MODELS,
    [
        'openai/gpt-5.2',
        'anthropic/claude-3.5-sonnet',
        'google/gemini-1.5-pro',
        'openrouter/auto',
        'openai/gpt-4o-mini'
    ]
);

const openRouterResponseSchema = z.object({
    sections: z.array(
        z.object({
            id: z.enum(SECTION_ORDER),
            summary: z.string(),
            detail: z.string().nullable().default(null),
            status: z.enum(['found', 'partial', 'missing']),
            provenancePageNumbers: z.array(z.number().int().positive()).default([]),
            quotes: z.array(
                z.object({
                    text: z.string(),
                    note: z.string(),
                    pageNumber: z.number().int().positive()
                })
            ).default([])
        })
    ).length(7),
    snapshot: z.array(
        z.object({
            id: z.enum(SNAPSHOT_FIELD_ORDER),
            value: z.string(),
            evidence: z.string().nullable().default(null),
            status: z.enum(['found', 'partial', 'missing']),
            provenancePageNumbers: z.array(z.number().int().positive()).default([])
        })
    ).length(8),
    extractionNotes: z.array(z.string()).default([])
});

const structuredPaperSchema = z.object({
    title: z.string().nullable().optional(),
    abstract: z.string().nullable().optional(),
    objective: z.object({
        summary: z.string(),
        pageNumbers: z.array(z.number().int().positive()).default([])
    }).nullable().optional(),
    methods: z.object({
        summary: z.string(),
        pageNumbers: z.array(z.number().int().positive()).default([])
    }).nullable().optional(),
    sample: z.object({
        summary: z.string(),
        pageNumbers: z.array(z.number().int().positive()).default([])
    }).nullable().optional(),
    results: z.object({
        summary: z.string(),
        pageNumbers: z.array(z.number().int().positive()).default([])
    }).nullable().optional(),
    conclusion: z.object({
        summary: z.string(),
        pageNumbers: z.array(z.number().int().positive()).default([])
    }).nullable().optional(),
    quoteCandidates: z.array(
        z.object({
            text: z.string(),
            pageNumber: z.number().int().positive()
        })
    ).default([]),
    pages: z.array(
        z.object({
            pageNumber: z.number().int().positive(),
            extractionType: z.enum(['native', 'ocr', 'mixed']),
            confidence: z.number().nullable(),
            weak: z.boolean().optional()
        })
    ).default([])
});

export type InsightGenerationInput = {
    displayTitle: string;
    authors: string[];
    year: number | null;
    journal: string | null;
    doi: string | null;
    abstract: string | null;
    pageMap: ExtractedPage[];
    warnings: string[];
    structuredPaper?: Record<string, unknown> | null;
};

export type InsightGenerationResult = {
    insights: PaperInsightSummary;
    usedOpenRouter: boolean;
    fallbackUsed: boolean;
};

type SectionCandidate = {
    id: InsightSectionId;
    heading: string;
    text: string;
    provenance: PageProvenance[];
};

type SnapshotCandidate = {
    id: InsightSnapshotFieldId;
    label: string;
    value: string;
    evidence: string | null;
    status: 'found' | 'partial' | 'missing';
    provenance: PageProvenance[];
};

type StructuredPaper = z.infer<typeof structuredPaperSchema>;

export async function generatePaperInsights(
    input: InsightGenerationInput
): Promise<InsightGenerationResult> {
    const structuredPaper = coerceStructuredPaper(input.structuredPaper);
    const heuristics = buildHeuristicSections(input, structuredPaper);
    const snapshotHeuristics = buildHeuristicSnapshot(input, heuristics);
    const apiKey = import.meta.env.OPENROUTER_API_KEY;

    if (!apiKey) {
        throw new Error(
            'OPENROUTER_API_KEY is missing. Add it to generate structured paper insights.'
        );
    }

    const context = buildModelContext(input, structuredPaper);

    for (const model of MODEL_CANDIDATES) {
        try {
            const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                    'HTTP-Referer': import.meta.env.PUBLIC_SITE_URL || import.meta.env.SITE || 'https://abodidsahoo.com',
                    'X-Title': import.meta.env.PUBLIC_SITE_NAME || 'Abodid Paper Renamer'
                },
                body: JSON.stringify({
                    model,
                    response_format: { type: 'json_object' },
                    temperature: 0.05,
                    max_tokens: 1800,
                    messages: [
                        {
                            role: 'system',
                            content:
                                'You summarize research papers using only the supplied structured extraction. Never invent claims, institutions, locations, people, quotes, page numbers, or participant counts. If a detail is not clearly supported, return "Not clearly found" and mark it missing. The "about" section must read like a short paper summary in 2 to 4 sentences. Keep every other section to 1 or 2 short sentences only, and use detail only when it adds a clearly supported specific point. Keep the compact snapshot extremely short: each value must stay within 5 to 10 words. Evidence must be a short exact phrase or a tightly faithful excerpt from supplied text.'
                        },
                        {
                            role: 'user',
                            content: `${context}\n\nReturn valid JSON with this exact structure:\n${JSON.stringify({
                                sections: SECTION_ORDER.map((id) => ({
                                    id,
                                    summary: 'string',
                                    detail: 'string | null',
                                    status: 'found | partial | missing',
                                    provenancePageNumbers: [1],
                                    quotes: [
                                        {
                                            text: 'short quote',
                                            note: 'why it matters',
                                            pageNumber: 1
                                        }
                                    ]
                                })),
                                snapshot: SNAPSHOT_FIELD_ORDER.map((id) => ({
                                    id,
                                    value: '5 to 10 words max',
                                    evidence: 'short exact excerpt or null',
                                    status: 'found | partial | missing',
                                    provenancePageNumbers: [1]
                                })),
                                extractionNotes: ['string']
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
            const parsed = openRouterResponseSchema.parse(JSON.parse(cleaned));
            const insights = materializeModelSummary(
                parsed,
                heuristics,
                snapshotHeuristics,
                model,
                input.warnings
            );

            return {
                insights,
                usedOpenRouter: true,
                fallbackUsed: false
            };
        } catch (_error) {
            continue;
        }
    }

    return {
        insights: buildFallbackSummary(heuristics, snapshotHeuristics, input.warnings),
        usedOpenRouter: false,
        fallbackUsed: true
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

function buildModelContext(
    input: InsightGenerationInput,
    structuredPaper: StructuredPaper | null
): string {
    if (structuredPaper) {
        const structuredSections = [
            {
                heading: 'Paper title',
                text: structuredPaper.title || input.displayTitle,
                pageNumbers: []
            },
            {
                heading: 'Abstract',
                text: structuredPaper.abstract || input.abstract || 'Not clearly found',
                pageNumbers: []
            },
            {
                heading: 'Research objective',
                text: structuredPaper.objective?.summary || 'Not clearly found',
                pageNumbers: structuredPaper.objective?.pageNumbers || []
            },
            {
                heading: 'Methods',
                text: structuredPaper.methods?.summary || 'Not clearly found',
                pageNumbers: structuredPaper.methods?.pageNumbers || []
            },
            {
                heading: 'Sample or participants',
                text: structuredPaper.sample?.summary || 'Not clearly found',
                pageNumbers: structuredPaper.sample?.pageNumbers || []
            },
            {
                heading: 'Main findings',
                text: structuredPaper.results?.summary || 'Not clearly found',
                pageNumbers: structuredPaper.results?.pageNumbers || []
            },
            {
                heading: 'Conclusion',
                text: structuredPaper.conclusion?.summary || 'Not clearly found',
                pageNumbers: structuredPaper.conclusion?.pageNumbers || []
            },
            {
                heading: 'Useful direct quotes',
                text:
                    structuredPaper.quoteCandidates.length > 0
                        ? structuredPaper.quoteCandidates
                            .slice(0, 3)
                            .map(
                                (quote) =>
                                    `[Page ${quote.pageNumber}] ${normalizeWhitespace(quote.text)}`
                            )
                            .join('\n')
                        : 'Not clearly found',
                pageNumbers: structuredPaper.quoteCandidates
                    .slice(0, 3)
                    .map((quote) => quote.pageNumber)
            }
        ];

        const weakPages = structuredPaper.pages
            .filter((page) => page.weak)
            .map((page) => page.pageNumber);

        return [
            `Paper title: ${structuredPaper.title || input.displayTitle}`,
            `Authors: ${input.authors.join(', ') || 'Unknown'}`,
            `Year: ${input.year ?? 'Unknown'}`,
            `Journal: ${input.journal ?? 'Unknown'}`,
            `DOI: ${input.doi ?? 'Unknown'}`,
            '',
            'Compact snapshot rules:',
            '- Use only supported facts from the supplied structured extraction.',
            '- Every snapshot value must stay within 5 to 10 words.',
            '- Use "Not clearly found" when a field is unsupported.',
            '- Evidence should be a short exact phrase or close excerpt, not a new interpretation.',
            '- If participant count is missing, do not infer one.',
            '- Make the about section a short 2 to 4 sentence paper summary.',
            '- Keep every other user-facing section to 1 or 2 short sentences.',
            '- Keep the user-facing sections limited to summary, objective, methods, findings, conclusion, and useful quotes.',
            weakPages.length > 0
                ? `Weak pages to treat cautiously: ${weakPages.join(', ')}`
                : 'Weak pages to treat cautiously: none flagged',
            '',
            'Structured paper extraction:',
            ...structuredSections.map((section) => {
                const pages = section.pageNumbers.join(', ');
                return [
                    `## ${section.heading} [pages ${pages || 'n/a'}]`,
                    section.text || 'Not clearly found'
                ].join('\n');
            }),
            '',
            'Quote rules:',
            '- Only include a quote if it appears verbatim in the supplied structured extraction.',
            '- Keep quotes short.',
            '- If no safe quote is available, return an empty quotes array for that section.'
        ].join('\n');
    }

    const candidates = buildSectionCandidates(input, null);

    return [
        `Paper title: ${input.displayTitle}`,
        `Authors: ${input.authors.join(', ') || 'Unknown'}`,
        `Year: ${input.year ?? 'Unknown'}`,
        `Journal: ${input.journal ?? 'Unknown'}`,
        `DOI: ${input.doi ?? 'Unknown'}`,
        `Abstract: ${input.abstract ? compressText(input.abstract, 1200) : 'Not clearly found'}`,
        '',
        'Compact snapshot rules:',
        '- Use only supported facts from the supplied excerpts.',
        '- Every snapshot value must stay within 5 to 10 words.',
        '- Use "Not clearly found" when a field is unsupported.',
        '- Evidence should be a short exact phrase or close excerpt, not a new interpretation.',
        '- If participant count is missing, do not infer one.',
        '- Make the about section a short 2 to 4 sentence paper summary.',
        '- Keep every other user-facing section to 1 or 2 short sentences.',
        '',
        'Page-aware excerpts:',
        ...candidates.map((candidate) => {
            const pages = candidate.provenance.map((item) => item.pageNumber).join(', ');
            return [
                `## ${candidate.heading} [pages ${pages || 'n/a'}]`,
                candidate.text || 'Not clearly found'
            ].join('\n');
        }),
        '',
        'Quote rules:',
        '- Only include a quote if it appears verbatim in the supplied excerpts.',
        '- Keep quotes short.',
        '- If no safe quote is available, return an empty quotes array for that section.'
    ].join('\n');
}

function buildHeuristicSections(
    input: InsightGenerationInput,
    structuredPaper: StructuredPaper | null
): InsightSection[] {
    return buildSectionCandidates(input, structuredPaper).map((candidate) => {
        const text = candidate.text.trim();
        const hasContent = text.length > 0 && text !== 'Not clearly found';

        return {
            id: candidate.id,
            heading: candidate.heading,
            summary: hasContent ? pickBestSnippet(text, 220) : 'Not clearly found',
            detail: hasContent ? compressText(text, 520) : null,
            status: hasContent ? (text.length > 140 ? 'found' : 'partial') : 'missing',
            provenance: candidate.provenance,
            quotes: candidate.id === 'quotes' ? collectQuoteCandidates(candidate) : undefined
        };
    });
}

function buildSectionCandidates(
    input: InsightGenerationInput,
    structuredPaper: StructuredPaper | null
): SectionCandidate[] {
    const allText = input.pageMap
        .map((page) => page.text)
        .join('\n\n');

    const aboutPages = selectPages(input.pageMap, /\b(abstract|introduction|study|paper|research)\b/i, 3, [1, 2]);
    const objectivePages = selectPages(input.pageMap, /\b(objective|aim|purpose|research question|we ask|this study examines)\b/i, 3);
    const methodsPages = selectPages(input.pageMap, /\b(method|participants|sample|interview|survey|ethnograph|ethnographic|fieldwork|procedure|dataset)\b/i, 4);
    const findingsPages = selectPages(input.pageMap, /\b(results|findings|found that|suggests that|reveals|shows that)\b/i, 4);
    const conclusionPages = selectPages(input.pageMap, /\b(conclusion|conclude|in summary|implications|we argue)\b/i, 3, [input.pageMap.length - 1, input.pageMap.length]);
    const quotePages = selectPages(input.pageMap, /["“”']|\b(participant|field note|interview)\b/i, 4);
    const humanPages = selectPages(input.pageMap, /\b(ethnograph|ethnographic|field note|participant|interview|observation|narrative|lived experience|diary)\b/i, 4);
    const structuredAboutText = structuredPaper?.abstract || null;
    const structuredObjective = structuredPaper?.objective || null;
    const structuredMethodsText = joinStructuredSummaries(
        structuredPaper?.methods?.summary || null,
        structuredPaper?.sample?.summary || null
    );
    const structuredFindings = structuredPaper?.results || null;
    const structuredConclusion = structuredPaper?.conclusion || null;
    const structuredQuotes = structuredPaper?.quoteCandidates || [];

    return [
        {
            id: 'about',
            heading: 'Paper Summary',
            text:
                structuredAboutText ||
                input.abstract ||
                joinPageTexts(aboutPages) ||
                pickBestSnippet(allText, 320) ||
                'Not clearly found',
            provenance:
                structuredPaper && structuredAboutText
                    ? mapPageNumbersToProvenance(
                        structuredPaper.pages,
                        aboutPages.map((page) => page.pageNumber)
                    )
                    : aboutPages.map(toProvenance)
        },
        {
            id: 'objective',
            heading: 'Research Objective',
            text: structuredObjective?.summary || joinPageTexts(objectivePages) || 'Not clearly found',
            provenance:
                structuredObjective
                    ? mapPageNumbersToProvenance(structuredPaper?.pages || [], structuredObjective.pageNumbers)
                    : objectivePages.map(toProvenance)
        },
        {
            id: 'methods',
            heading: 'Method',
            text: structuredMethodsText || joinPageTexts(methodsPages) || 'Not clearly found',
            provenance:
                structuredPaper
                    ? mapPageNumbersToProvenance(
                        structuredPaper.pages,
                        dedupeNumbers([
                            ...(structuredPaper.methods?.pageNumbers || []),
                            ...(structuredPaper.sample?.pageNumbers || [])
                        ])
                    )
                    : methodsPages.map(toProvenance)
        },
        {
            id: 'findings',
            heading: 'Key Findings',
            text: structuredFindings?.summary || joinPageTexts(findingsPages) || 'Not clearly found',
            provenance:
                structuredFindings
                    ? mapPageNumbersToProvenance(structuredPaper?.pages || [], structuredFindings.pageNumbers)
                    : findingsPages.map(toProvenance)
        },
        {
            id: 'conclusion',
            heading: 'Conclusion',
            text: structuredConclusion?.summary || joinPageTexts(conclusionPages) || 'Not clearly found',
            provenance:
                structuredConclusion
                    ? mapPageNumbersToProvenance(structuredPaper?.pages || [], structuredConclusion.pageNumbers)
                    : conclusionPages.map(toProvenance)
        },
        {
            id: 'quotes',
            heading: 'Notable Quote',
            text:
                structuredQuotes.length > 0
                    ? structuredQuotes
                        .slice(0, 3)
                        .map((quote) => `[Page ${quote.pageNumber}] ${normalizeWhitespace(quote.text)}`)
                        .join('\n\n')
                    : joinPageTexts(quotePages) || 'Not clearly found',
            provenance:
                structuredQuotes.length > 0
                    ? mapPageNumbersToProvenance(
                        structuredPaper?.pages || [],
                        structuredQuotes.map((quote) => quote.pageNumber)
                    )
                    : quotePages.map(toProvenance)
        },
        {
            id: 'human-detail',
            heading: 'Additional Detail',
            text: joinPageTexts(humanPages) || 'Not clearly found',
            provenance: humanPages.map(toProvenance)
        }
    ];
}

function buildHeuristicSnapshot(
    input: InsightGenerationInput,
    sections: InsightSection[]
): InsightSnapshotGroup[] {
    const sectionMap = new Map(sections.map((section) => [section.id, section]));
    const aboutSection = sectionMap.get('about') || null;
    const objectiveSection = sectionMap.get('objective') || null;
    const methodsSection = sectionMap.get('methods') || null;
    const conclusionSection = sectionMap.get('conclusion') || null;
    const humanSection = sectionMap.get('human-detail') || null;

    const constructPages = selectPages(
        input.pageMap,
        /\b(construct|concept|framework|theory|model|phenomenon|trust|identity|capital|variable)\b/i,
        3,
        [1, 2]
    );
    const peoplePages = selectPages(
        input.pageMap,
        /\b(participants?|students?|teachers?|workers?|patients?|families?|caregivers?|respondents?|children|adults|women|men|mothers|fathers)\b/i,
        3
    );
    const participantPages = selectPages(
        input.pageMap,
        /\b(n\s*=\s*\d+|\d+\s+(participants?|students?|teachers?|workers?|patients?|respondents?|families?|households?|interviews?|cases))\b/i,
        3
    );
    const locationPages = selectPages(
        input.pageMap,
        /\b(city|country|village|school|schools|university|hospital|clinic|community|communities|district|region|state|province)\b/i,
        3
    );

    const participantRawText =
        joinPageTexts(participantPages) ||
        methodsSection?.detail ||
        methodsSection?.summary ||
        '';
    const locationRawText =
        joinPageTexts(locationPages) ||
        humanSection?.detail ||
        methodsSection?.detail ||
        '';
    const peopleRawText =
        joinPageTexts(peoplePages) ||
        humanSection?.detail ||
        methodsSection?.detail ||
        methodsSection?.summary ||
        '';
    const constructRawText =
        joinPageTexts(constructPages) ||
        objectiveSection?.detail ||
        aboutSection?.detail ||
        objectiveSection?.summary ||
        '';

    const fields: SnapshotCandidate[] = [
        createSnapshotCandidate({
            id: 'paper-about',
            label: 'What It Is About',
            text: aboutSection?.summary || input.abstract || '',
            evidence: aboutSection?.detail || input.abstract || null,
            provenance: aboutSection?.provenance || []
        }),
        createSnapshotCandidate({
            id: 'construct',
            label: 'Construct',
            text: extractConstructText(constructRawText),
            evidence: extractConstructEvidence(constructRawText),
            provenance: constructPages.map(toProvenance)
        }),
        createSnapshotCandidate({
            id: 'research-focus',
            label: 'Research Done On',
            text: methodsSection?.summary || objectiveSection?.summary || '',
            evidence: methodsSection?.detail || objectiveSection?.detail || null,
            provenance: methodsSection?.provenance || objectiveSection?.provenance || []
        }),
        createSnapshotCandidate({
            id: 'people',
            label: 'People Involved',
            text: extractPeopleText(peopleRawText),
            evidence: extractPeopleEvidence(peopleRawText),
            provenance: peoplePages.map(toProvenance)
        }),
        createSnapshotCandidate({
            id: 'participants',
            label: 'Participant Count',
            text: extractParticipantCountText(participantRawText),
            evidence: extractParticipantCountEvidence(participantRawText),
            provenance: participantPages.map(toProvenance)
        }),
        createSnapshotCandidate({
            id: 'location',
            label: 'Location',
            text: extractLocationText(locationRawText),
            evidence: extractLocationEvidence(locationRawText),
            provenance: locationPages.map(toProvenance)
        }),
        createSnapshotCandidate({
            id: 'conducted-by',
            label: 'Done By',
            text: buildConductedByText(input.authors),
            evidence: input.authors.length > 0 ? input.authors.join(', ') : null,
            provenance: []
        }),
        createSnapshotCandidate({
            id: 'conclusion',
            label: 'Final Conclusion',
            text: conclusionSection?.summary || '',
            evidence: conclusionSection?.detail || null,
            provenance: conclusionSection?.provenance || []
        })
    ];

    return buildSnapshotGroups(fields);
}

function selectPages(
    pages: ExtractedPage[],
    pattern: RegExp,
    limit: number,
    preferredPages: number[] = []
): ExtractedPage[] {
    const preferred = preferredPages
        .filter((pageNumber) => pageNumber > 0)
        .flatMap((pageNumber) => pages.find((page) => page.pageNumber === pageNumber) ?? []);

    const matching = pages.filter((page) => pattern.test(page.text));
    const ranked = [...preferred, ...matching]
        .filter((page, index, collection) => collection.findIndex((item) => item.pageNumber === page.pageNumber) === index)
        .sort((left, right) => {
            const leftScore = scorePageMatch(left.text, pattern);
            const rightScore = scorePageMatch(right.text, pattern);
            return rightScore - leftScore;
        });

    return ranked.slice(0, limit);
}

function scorePageMatch(text: string, pattern: RegExp): number {
    const matches = text.match(new RegExp(pattern.source, `${pattern.flags.replace('g', '')}g`));
    return (matches?.length || 0) + Math.min(text.length / 600, 1);
}

function joinPageTexts(pages: ExtractedPage[]): string {
    return pages
        .map((page) => `[Page ${page.pageNumber}] ${compressText(normalizeWhitespace(page.text), 900)}`)
        .join('\n\n');
}

function toProvenance(page: ExtractedPage): PageProvenance {
    return {
        pageNumber: page.pageNumber,
        extractionType: page.extractionType,
        confidence: page.confidence
    };
}

function collectQuoteCandidates(candidate: SectionCandidate): InsightQuote[] {
    const quotes = candidate.text.match(/[“"][^“”"]{20,220}[”"]/g) || [];

    return quotes.slice(0, 3).map((quote, index) => ({
        id: `${candidate.id}-quote-${index + 1}`,
        text: quote.replace(/[“”]/g, '"').trim(),
        note: 'Directly stated in the paper excerpt.',
        provenance: candidate.provenance[0] || {
            pageNumber: 1,
            extractionType: 'native',
            confidence: null
        }
    }));
}

function materializeModelSummary(
    parsed: z.infer<typeof openRouterResponseSchema>,
    heuristics: InsightSection[],
    snapshotHeuristics: InsightSnapshotGroup[],
    modelLabel: string,
    warnings: string[]
): PaperInsightSummary {
    const heuristicMap = new Map(heuristics.map((section) => [section.id, section]));
    const sections = SECTION_ORDER.map((id) => {
        const modelSection = parsed.sections.find((section) => section.id === id);
        const heuristic = heuristicMap.get(id)!;
        const summary =
            cleanModelText(modelSection?.summary) || heuristic.summary || 'Not clearly found';
        const status =
            modelSection?.status ||
            (/not clearly found/i.test(summary) ? 'missing' : heuristic.status);
        const provenance = mergeProvenance(
            (modelSection?.provenancePageNumbers ?? []).map((pageNumber) => {
                const matched = heuristic.provenance.find((item) => item.pageNumber === pageNumber);
                return (
                    matched || {
                        pageNumber,
                        extractionType: 'native',
                        confidence: null
                    }
                );
            })
        );

        return {
            id,
            heading: heuristic.heading,
            summary,
            detail:
                status === 'missing'
                    ? null
                    : cleanModelText(modelSection?.detail) || heuristic.detail,
            status,
            provenance: provenance.length > 0 ? provenance : heuristic.provenance,
            quotes:
                id === 'quotes'
                    ? normalizeModelQuotes(modelSection?.quotes ?? [], heuristic.provenance)
                    : undefined
        } satisfies InsightSection;
    });

    const snapshot = materializeModelSnapshot(parsed.snapshot, snapshotHeuristics);

    return {
        generatedAt: new Date().toISOString(),
        modelLabel,
        extractionNotes: dedupeStrings([...warnings, ...parsed.extractionNotes]),
        sections,
        provenanceMap: Object.fromEntries(
            sections.map((section) => [section.id, section.provenance])
        ),
        snapshot
    };
}

function materializeModelSnapshot(
    modelFields: z.infer<typeof openRouterResponseSchema>['snapshot'],
    heuristicGroups: InsightSnapshotGroup[]
): InsightSnapshotGroup[] {
    const heuristicFields = heuristicGroups.flatMap((group) => group.fields);
    const heuristicMap = new Map(heuristicFields.map((field) => [field.id, field]));

    const fields = SNAPSHOT_FIELD_ORDER.map((id) => {
        const modelField = modelFields.find((field) => field.id === id);
        const heuristic = heuristicMap.get(id)!;
        const provenance = mergeProvenance(
            (modelField?.provenancePageNumbers ?? []).map((pageNumber) => {
                const matched = heuristic.provenance.find((item) => item.pageNumber === pageNumber);
                return (
                    matched || {
                        pageNumber,
                        extractionType: 'native',
                        confidence: null
                    }
                );
            })
        );

        return {
            id,
            label: heuristic.label,
            value: normalizeSnapshotValue(cleanModelText(modelField?.value) || heuristic.value),
            evidence:
                normalizeSnapshotEvidence(
                    cleanModelText(modelField?.evidence) || heuristic.evidence
                ),
            status: modelField?.status || heuristic.status,
            provenance: provenance.length > 0 ? provenance : heuristic.provenance
        } satisfies InsightSnapshotField;
    });

    return buildSnapshotGroups(fields);
}

function normalizeModelQuotes(
    quotes: Array<{ text: string; note: string; pageNumber: number }>,
    fallbackProvenance: PageProvenance[]
): InsightQuote[] {
    return quotes
        .filter((quote) => quote.text.trim().length > 0 && quote.text.trim().length <= 260)
        .slice(0, 3)
        .map((quote, index) => ({
            id: `quote-${index + 1}`,
            text: cleanModelText(quote.text) || 'Not clearly found',
            note: cleanModelText(quote.note) || 'Direct quote from the paper.',
            provenance:
                fallbackProvenance.find((item) => item.pageNumber === quote.pageNumber) || {
                    pageNumber: quote.pageNumber,
                    extractionType: 'native',
                    confidence: null
                }
        }));
}

function buildFallbackSummary(
    heuristics: InsightSection[],
    snapshot: InsightSnapshotGroup[],
    warnings: string[]
): PaperInsightSummary {
    return {
        generatedAt: new Date().toISOString(),
        modelLabel: 'Deterministic fallback',
        extractionNotes: dedupeStrings([
            ...warnings,
            'OpenRouter could not be reached, so the summary used a deterministic fallback.'
        ]),
        sections: heuristics,
        provenanceMap: Object.fromEntries(
            heuristics.map((section) => [section.id, section.provenance])
        ),
        snapshot
    };
}

function buildSnapshotGroups(
    fields: Array<InsightSnapshotField | SnapshotCandidate>
): InsightSnapshotGroup[] {
    return SNAPSHOT_GROUPS.map((group) => ({
        id: group.id,
        heading: group.heading,
        fields: group.fieldIds.flatMap((fieldId) => {
            const field = fields.find((item) => item.id === fieldId);
            return field ? [field] : [];
        })
    })).filter((group) => group.fields.length > 0);
}

function createSnapshotCandidate({
    id,
    label,
    text,
    evidence,
    provenance
}: {
    id: InsightSnapshotFieldId;
    label: string;
    text: string;
    evidence: string | null;
    provenance: PageProvenance[];
}): SnapshotCandidate {
    const cleanedValue = normalizeSnapshotValue(text);
    const normalizedEvidence = normalizeSnapshotEvidence(evidence);

    return {
        id,
        label,
        value: cleanedValue,
        evidence: normalizedEvidence,
        status:
            cleanedValue === 'Not clearly found'
                ? 'missing'
                : cleanedValue.split(/\s+/).length >= 5
                    ? 'found'
                    : 'partial',
        provenance
    };
}

function normalizeSnapshotValue(value: string | null | undefined): string {
    const cleaned = stripPageMarkers(value);
    if (!cleaned) {
        return 'Not clearly found';
    }

    if (/not clearly found/i.test(cleaned)) {
        return 'Not clearly found';
    }

    return limitWords(cleaned, 10);
}

function normalizeSnapshotEvidence(value: string | null | undefined): string | null {
    const cleaned = stripPageMarkers(value);
    if (!cleaned || /not clearly found/i.test(cleaned)) {
        return null;
    }

    return limitWords(pickBestSnippet(cleaned, 140), 16);
}

function stripPageMarkers(value: string | null | undefined): string {
    if (!value) {
        return '';
    }

    return normalizeWhitespace(value.replace(/\[Page \d+\]\s*/g, ' '));
}

function limitWords(value: string, maxWords: number): string {
    const words = normalizeWhitespace(value).split(/\s+/).filter(Boolean);
    if (words.length === 0) {
        return '';
    }

    if (words.length <= maxWords) {
        return words.join(' ');
    }

    return `${words.slice(0, maxWords).join(' ')}…`;
}

function extractConstructText(value: string): string {
    return (
        extractSentenceByPattern(
            value,
            /\b(construct|concept|framework|theory|model|phenomenon|trust|identity|capital|variable)\b/i
        ) ||
        ''
    );
}

function extractConstructEvidence(value: string): string | null {
    return (
        extractSentenceByPattern(
            value,
            /\b(construct|concept|framework|theory|model|phenomenon|trust|identity|capital|variable)\b/i
        ) || null
    );
}

function extractPeopleText(value: string): string {
    return (
        extractSentenceByPattern(
            value,
            /\b(participants?|students?|teachers?|workers?|patients?|families?|caregivers?|respondents?|children|adults|women|men|mothers|fathers)\b/i
        ) ||
        ''
    );
}

function extractPeopleEvidence(value: string): string | null {
    return (
        extractSentenceByPattern(
            value,
            /\b(participants?|students?|teachers?|workers?|patients?|families?|caregivers?|respondents?|children|adults|women|men|mothers|fathers)\b/i
        ) || null
    );
}

function extractParticipantCountText(value: string): string {
    const match = stripPageMarkers(value).match(
        /\b(?:n\s*=\s*\d+|\d+\s+(?:participants?|students?|teachers?|workers?|patients?|respondents?|families?|households?|interviews?|cases))\b/i
    );

    return match?.[0] || '';
}

function extractParticipantCountEvidence(value: string): string | null {
    return extractParticipantCountText(value) || null;
}

function extractLocationText(value: string): string {
    const cleaned = stripPageMarkers(value);
    const withKeyword =
        cleaned.match(
            /\b(?:in|at|across|within|from)\s+([A-Z][A-Za-z'’.-]+(?:\s+[A-Z][A-Za-z'’.-]+){0,4})/
        )?.[0] ||
        cleaned.match(
            /\b([A-Z][A-Za-z'’.-]+(?:\s+[A-Z][A-Za-z'’.-]+){0,4})\s+(?:school|schools|university|hospital|clinic|community|district|region|state|province|city|country)\b/
        )?.[0];

    if (!withKeyword || /\b(?:in|at|across|within|from)\s+(?:this|the|our)\b/i.test(withKeyword)) {
        return '';
    }

    return withKeyword;
}

function extractLocationEvidence(value: string): string | null {
    return extractLocationText(value) || null;
}

function buildConductedByText(authors: string[]): string {
    if (authors.length === 0) {
        return 'Not clearly found';
    }

    if (authors.length === 1) {
        return `By ${authors[0]}`;
    }

    return `By ${authors[0]} et al.`;
}

function extractSentenceByPattern(value: string, pattern: RegExp): string {
    const cleaned = stripPageMarkers(value);
    if (!cleaned) {
        return '';
    }

    const sentences = cleaned
        .split(/(?<=[.!?])\s+/)
        .map((sentence) => sentence.trim())
        .filter(Boolean);

    return sentences.find((sentence) => pattern.test(sentence)) || '';
}

function coerceStructuredPaper(value: Record<string, unknown> | null | undefined): StructuredPaper | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return null;
    }

    const parsed = structuredPaperSchema.safeParse(value);
    return parsed.success ? parsed.data : null;
}

function mapPageNumbersToProvenance(
    pages: StructuredPaper['pages'],
    pageNumbers: number[]
): PageProvenance[] {
    return mergeProvenance(
        pageNumbers.map((pageNumber) => {
            const page = pages.find((item) => item.pageNumber === pageNumber);
            return {
                pageNumber,
                extractionType: page?.extractionType || 'native',
                confidence: page?.confidence ?? null
            } satisfies PageProvenance;
        })
    );
}

function dedupeNumbers(values: number[]): number[] {
    return Array.from(new Set(values.filter((value) => value > 0)));
}

function joinStructuredSummaries(...values: Array<string | null | undefined>): string {
    const cleaned = values
        .map((value) => stripPageMarkers(value))
        .filter(Boolean);

    return cleaned.join('\n\n');
}

function cleanModelText(value: string | null | undefined): string | null {
    if (!value) {
        return null;
    }

    const normalized = normalizeWhitespace(value);
    return normalized || null;
}

function dedupeStrings(values: string[]): string[] {
    const seen = new Set<string>();
    const result: string[] = [];

    for (const value of values) {
        const normalized = value.trim();
        const key = normalized.toLowerCase();
        if (!normalized || seen.has(key)) {
            continue;
        }

        seen.add(key);
        result.push(normalized);
    }

    return result;
}
