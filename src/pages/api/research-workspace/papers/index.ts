import { randomUUID } from 'node:crypto';
import type { APIRoute } from 'astro';
import type { UploadPaperResponse } from '../../../../lib/research-workspace/contracts';
import {
    preparePaperFromLink,
    preparePaperFromUpload
} from '../../../../lib/research-workspace/paper-processor';
import { hashPdfBuffer } from '../../../../lib/research-workspace/paper-utils';
import { generatePaperRename } from '../../../../lib/research-workspace/rename';
import {
    createPaperRecord,
    ensureUniquePreferredFilename,
    findPaperRecordByFingerprint,
    getRecentPaperRecords,
    getResearchWorkspaceAdminClient,
    RESEARCH_WORKSPACE_ANALYSIS_VERSION,
    toClientPaper,
    uploadPaperBuffer
} from '../../../../lib/research-workspace/storage';

export const prerender = false;

export const GET: APIRoute = async () => {
    try {
        const admin = getResearchWorkspaceAdminClient();
        const rows = await getRecentPaperRecords(admin, 36);

        return json(
            {
                papers: rows.map((row) => toClientPaper(row))
            },
            200
        );
    } catch (error) {
        console.error('[research-workspace/papers] list failed:', error);
        return json(
            {
                error:
                    error instanceof Error
                        ? error.message
                        : 'We could not load saved papers.'
            },
            500
        );
    }
};

export const POST: APIRoute = async ({ request }) => {
    try {
        const formData = await request.formData();
        const sourceType = formData.get('sourceType');

        if (sourceType !== 'file' && sourceType !== 'link') {
            return json({ error: 'Invalid upload source.' }, 400);
        }

        const processed =
            sourceType === 'file'
                ? await handleFileImport(formData)
                : await handleLinkImport(formData);

        const admin = getResearchWorkspaceAdminClient();
        const fileFingerprint = hashPdfBuffer(processed.buffer);
        const cached = await findPaperRecordByFingerprint(
            admin,
            fileFingerprint,
            RESEARCH_WORKSPACE_ANALYSIS_VERSION
        );

        if (cached) {
            const payload: UploadPaperResponse = {
                paper: toClientPaper(cached),
                meta: {
                    extractedWithOcr:
                        cached.ocr_status === 'used' || cached.ocr_status === 'partial',
                    warnings: Array.isArray(cached.warnings_json)
                        ? cached.warnings_json.map((item) => String(item))
                        : [],
                    linkResolvedFrom: processed.linkResolvedFrom
                }
            };

            return json(payload, 200);
        }

        const renameResult = await generatePaperRename({
            originalFileName: processed.originalFileName,
            fallbackDisplayTitle: processed.displayTitle,
            fallbackCleanFileName: processed.cleanFileName,
            authors: processed.authors,
            year: processed.year,
            doi: processed.doi,
            journal: processed.journal,
            abstract: processed.abstract,
            extractedPaper: processed.extractedPaper
        });

        const cleanFileName = await ensureUniquePreferredFilename(admin, renameResult.cleanFileName);
        const preferredFileName = await ensureUniquePreferredFilename(admin, cleanFileName);

        const storagePath = await uploadPaperBuffer(
            admin,
            randomUUID(),
            processed.originalFileName,
            processed.buffer,
            processed.contentType
        );

        const extractionStatus = processed.pageMap.some((page) => page.text.length === 0)
            ? 'partial'
            : 'complete';

        const row = await createPaperRecord(admin, {
            fileFingerprint,
            analysisVersion: RESEARCH_WORKSPACE_ANALYSIS_VERSION,
            originalFilename: processed.originalFileName,
            cleanedFilename: cleanFileName,
            preferredFilename: preferredFileName,
            displayTitle: renameResult.displayTitle,
            sourceType: processed.sourceType,
            sourceUrl: processed.sourceUrl,
            storagePath,
            doi: processed.doi,
            authors: processed.authors,
            year: processed.year,
            journal: processed.journal,
            abstract: processed.abstract,
            uploadStatus: 'uploaded',
            extractionStatus,
            ocrStatus: processed.ocrStatus,
            insightStatus: 'idle',
            metadata: {
                ...processed.metadata,
                linkResolvedFrom: processed.linkResolvedFrom,
                renameMeta: {
                    usedOpenRouter: renameResult.usedOpenRouter,
                    fallbackUsed: renameResult.fallbackUsed,
                    modelLabel: renameResult.modelLabel
                }
            },
            pageMap: processed.pageMap,
            extractedPaper: processed.extractedPaper,
            warnings: processed.warnings,
            insights: null
        });

        const payload: UploadPaperResponse = {
            paper: toClientPaper(row),
            meta: {
                extractedWithOcr: processed.extractedWithOcr,
                warnings: processed.warnings,
                linkResolvedFrom: processed.linkResolvedFrom
            }
        };

        return json(payload, 200);
    } catch (error) {
        console.error('[research-workspace/papers] upload failed:', error);
        return json(
            {
                error:
                    error instanceof Error
                        ? error.message
                        : 'We could not process that paper.'
            },
            500
        );
    }
};

async function handleFileImport(formData: FormData) {
    const fileValue = formData.get('file');

    if (!(fileValue instanceof File)) {
        throw new Error('Choose a PDF first.');
    }

    return preparePaperFromUpload(fileValue);
}

async function handleLinkImport(formData: FormData) {
    const sourceUrl = String(formData.get('sourceUrl') || '').trim();

    if (!sourceUrl) {
        throw new Error('Paste a paper link first.');
    }

    return preparePaperFromLink(sourceUrl);
}

function json(body: unknown, status: number) {
    return new Response(JSON.stringify(body), {
        status,
        headers: {
            'Content-Type': 'application/json'
        }
    });
}
