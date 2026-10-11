import type { APIRoute } from 'astro';
import { generateIcsFile } from '../../../../lib/opportunities/calendar';
import { authorizeOpportunityRequest } from '../../../../lib/opportunities/userAuth';
import { PRIVATE_SAVED_SELECT, savedRowToOpportunity, type SavedOpportunityRow } from '../../../../lib/opportunities/saved';

export const prerender = false;

export const GET: APIRoute = async ({ params, request, url }) => {
    const authorization = await authorizeOpportunityRequest(request);
    if (!authorization.ok) return authorization.response;

    const id = params.id;
    if (!id) return new Response('Opportunity ID is required', { status: 400 });

    const { data, error } = await authorization.userClient
        .from('saved_opportunities')
        .select(PRIVATE_SAVED_SELECT)
        .eq('id', id)
        .single();

    if (error || !data) return new Response('Opportunity not found', { status: 404 });

    const opportunity = savedRowToOpportunity(data as unknown as SavedOpportunityRow);
    const mode = url.searchParams.get('mode') === 'event' ? 'event' : 'deadline';
    const filename = `${opportunity.title.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 30)}_${mode}.ics`;

    return new Response(generateIcsFile(opportunity, mode), {
        status: 200,
        headers: {
            'Content-Type': 'text/calendar; charset=utf-8',
            'Content-Disposition': `attachment; filename="${filename}"`,
            'Cache-Control': 'private, no-store',
        },
    });
};
