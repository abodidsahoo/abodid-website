import type { APIRoute } from 'astro';
import { getApprovedResources } from '../../../lib/resources/db';
import type { ResourceAudience } from '../../../lib/resources/types';

export const GET: APIRoute = async ({ request }) => {
    const url = new URL(request.url);
    const q = url.searchParams.get('q') || undefined;
    const audience = url.searchParams.get('audience') || undefined;

    // Parse tags if needed (comma separated)
    // const tags = url.searchParams.get('tags')?.split(',') || undefined;

    try {
        const resources = await getApprovedResources({
            query: q,
            audience: audience as ResourceAudience | null,
        });

        return new Response(JSON.stringify(resources), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};
