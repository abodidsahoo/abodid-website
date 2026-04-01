import type { APIRoute } from 'astro';
import { sanitizeFilename } from '../../../../../lib/research-workspace/paper-utils';
import {
    downloadPaperBlob,
    getPaperRecord,
    getResearchWorkspaceAdminClient
} from '../../../../../lib/research-workspace/storage';

export const prerender = false;

export const GET: APIRoute = async ({ params, request }) => {
    try {
        const paperId = params.id;
        if (!paperId) {
            return json({ error: 'Paper id is required.' }, 400);
        }

        const url = new URL(request.url);
        const variant = url.searchParams.get('variant') || 'original';
        const customFilename = url.searchParams.get('filename');

        const admin = getResearchWorkspaceAdminClient();
        const paper = await getPaperRecord(admin, paperId);
        const blob = await downloadPaperBlob(admin, paper);
        const buffer = await blob.arrayBuffer();

        const targetFileName =
            variant === 'clean'
                ? sanitizeFilename(
                    customFilename ||
                    paper.preferred_filename ||
                    paper.cleaned_filename ||
                    paper.original_filename
                )
                : preserveOriginalFilename(paper.original_filename);

        return new Response(buffer, {
            status: 200,
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="${targetFileName}"`,
                'Cache-Control': 'private, max-age=0, must-revalidate'
            }
        });
    } catch (error) {
        console.error('[research-workspace/papers/download] failed:', error);
        return json(
            {
                error:
                    error instanceof Error
                        ? error.message
                        : 'We could not download this paper.'
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

function preserveOriginalFilename(value: string): string {
    const trimmed = value.trim() || 'paper.pdf';
    const safe = trimmed
        .replace(/[^\w.\- ]+/g, '-')
        .replace(/\s+/g, ' ')
        .trim();

    return safe.toLowerCase().endsWith('.pdf') ? safe : `${safe}.pdf`;
}
