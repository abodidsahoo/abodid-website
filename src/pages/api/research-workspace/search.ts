import type { APIRoute } from 'astro';
import { searchResearchPapers } from '../../../lib/research-workspace/search';

export const GET: APIRoute = async ({ request }) => {
    const url = new URL(request.url);
    const query = url.searchParams.get('q')?.trim() || '';

    if (!query) {
        return new Response(
            JSON.stringify({ error: 'Query is required.' }),
            {
                status: 400,
                headers: {
                    'Content-Type': 'application/json'
                }
            }
        );
    }

    if (query.length > 300) {
        return new Response(
            JSON.stringify({ error: 'Query is too long.' }),
            {
                status: 400,
                headers: {
                    'Content-Type': 'application/json'
                }
            }
        );
    }

    try {
        const data = await searchResearchPapers(query, { limit: 6 });

        return new Response(JSON.stringify(data), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'public, max-age=0, s-maxage=300'
            }
        });
    } catch (error) {
        console.error('[research-workspace/search] ERROR:', error);

        return new Response(
            JSON.stringify({
                error:
                    error instanceof Error
                        ? error.message
                        : 'Search failed.'
            }),
            {
                status: 503,
                headers: {
                    'Content-Type': 'application/json'
                }
            }
        );
    }
};
