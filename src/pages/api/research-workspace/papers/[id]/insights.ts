import type { APIRoute } from 'astro';
import type { GenerateInsightsResponse } from '../../../../../lib/research-workspace/contracts';
import { generatePaperInsights } from '../../../../../lib/research-workspace/insights';
import {
    coercePageMap,
    coerceStringArray,
    coerceStringList,
    coerceInsights,
    getPaperRecord,
    getResearchWorkspaceAdminClient,
    toClientPaper,
    updatePaperRecord
} from '../../../../../lib/research-workspace/storage';

export const prerender = false;

export const POST: APIRoute = async ({ params }) => {
    const paperId = params.id;
    if (!paperId) {
        return json({ error: 'Paper id is required.' }, 400);
    }

    const admin = getResearchWorkspaceAdminClient();

    try {
        const current = await getPaperRecord(admin, paperId);
        const cachedInsights = coerceInsights(current.insights_json);
        const hasCompactSnapshot = Boolean(
            cachedInsights?.snapshot && cachedInsights.snapshot.length > 0
        );

        if (current.insight_status === 'ready' && cachedInsights && hasCompactSnapshot) {
            const payload: GenerateInsightsResponse = {
                paper: toClientPaper(current),
                insights: cachedInsights,
                meta: {
                    usedOpenRouter: false,
                    fallbackUsed: false
                }
            };

            return json(payload, 200);
        }

        await updatePaperRecord(admin, paperId, {
            insightStatus: 'processing'
        });

        const warnings = coerceStringList(current.warnings_json);
        const pageMap = coercePageMap(current.page_map_json);

        const result = await generatePaperInsights({
            displayTitle: current.display_title || current.original_filename,
            authors: coerceStringArray(current.authors_json),
            year: current.year,
            journal: current.journal,
            doi: current.doi,
            abstract: current.abstract,
            pageMap,
            warnings,
            structuredPaper:
                current.extracted_paper_json &&
                typeof current.extracted_paper_json === 'object' &&
                !Array.isArray(current.extracted_paper_json)
                    ? (current.extracted_paper_json as Record<string, unknown>)
                    : null
        });

        const updated = await updatePaperRecord(admin, paperId, {
            insightStatus: 'ready',
            insights: result.insights,
            warnings: Array.from(new Set([...warnings, ...result.insights.extractionNotes]))
        });

        const payload: GenerateInsightsResponse = {
            paper: toClientPaper(updated),
            insights: result.insights,
            meta: {
                usedOpenRouter: result.usedOpenRouter,
                fallbackUsed: result.fallbackUsed
            }
        };

        return json(payload, 200);
    } catch (error) {
        await updatePaperRecord(admin, paperId, {
            insightStatus: 'failed'
        }).catch(() => undefined);

        console.error('[research-workspace/papers/insights] failed:', error);
        return json(
            {
                error:
                    error instanceof Error
                        ? error.message
                        : 'We could not generate insights for this paper.'
            },
            500
        );
    }
};

function json(body: unknown, status: number) {
    return new Response(JSON.stringify(body), {
        status,
        headers: {
            'Content-Type': 'application/json'
        }
    });
}
