import type { APIRoute } from 'astro';
import type { GetPaperResponse } from '../../../../../lib/research-workspace/contracts';
import {
    getPaperRecord,
    getResearchWorkspaceAdminClient,
    toClientPaper
} from '../../../../../lib/research-workspace/storage';

export const prerender = false;

export const GET: APIRoute = async ({ params }) => {
    try {
        const paperId = params.id;
        if (!paperId) {
            return json({ error: 'Paper id is required.' }, 400);
        }

        const admin = getResearchWorkspaceAdminClient();
        const paper = await getPaperRecord(admin, paperId);

        const payload: GetPaperResponse = {
            paper: toClientPaper(paper)
        };

        return json(payload, 200);
    } catch (error) {
        return json(
            {
                error:
                    error instanceof Error
                        ? error.message
                        : 'We could not load this paper.'
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
