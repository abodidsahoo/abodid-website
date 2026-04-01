import type { APIRoute } from 'astro';
import type {
    RenamePaperRequest,
    RenamePaperResponse
} from '../../../../../lib/research-workspace/contracts';
import { sanitizeFilename } from '../../../../../lib/research-workspace/paper-utils';
import {
    ensureUniquePreferredFilename,
    getPaperRecord,
    getResearchWorkspaceAdminClient,
    toClientPaper,
    updatePaperRecord
} from '../../../../../lib/research-workspace/storage';

export const prerender = false;

export const POST: APIRoute = async ({ params, request }) => {
    try {
        const paperId = params.id;
        if (!paperId) {
            return json({ error: 'Paper id is required.' }, 400);
        }

        const body = (await request.json()) as RenamePaperRequest;
        const selection = body.selection;

        if (!selection || selection === 'idle') {
            return json({ error: 'Rename selection is required.' }, 400);
        }

        const admin = getResearchWorkspaceAdminClient();
        const current = await getPaperRecord(admin, paperId);

        let preferredFileName =
            selection === 'original'
                ? current.original_filename
                : sanitizeFilename(body.preferredFileName || current.cleaned_filename || current.original_filename);

        preferredFileName = await ensureUniquePreferredFilename(admin, preferredFileName, paperId);

        const updated = await updatePaperRecord(admin, paperId, {
            preferredFilename: preferredFileName,
            cleanedFilename:
                selection === 'original'
                    ? current.cleaned_filename || preferredFileName
                    : preferredFileName
        });

        const payload: RenamePaperResponse = {
            paper: toClientPaper(updated)
        };

        return json(payload, 200);
    } catch (error) {
        console.error('[research-workspace/papers/rename] failed:', error);
        return json(
            {
                error:
                    error instanceof Error
                        ? error.message
                        : 'We could not update the filename.'
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
