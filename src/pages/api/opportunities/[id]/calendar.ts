import type { APIRoute } from 'astro';
import { isRequestAuthenticated } from '../../../../lib/opportunities/auth';
import { createSupabaseServiceClient } from '../../../../lib/supabaseServer';
import { generateIcsFile } from '../../../../lib/opportunities/calendar';
import type { Opportunity } from '../../../../lib/opportunities/types';

export const prerender = false;

export const GET: APIRoute = async ({ params, request, cookies, url }) => {
    if (!isRequestAuthenticated(request, cookies)) {
        return new Response('Unauthorized', { status: 401 });
    }

    const { id } = params;
    if (!id) {
        return new Response('Opportunity ID is required', { status: 400 });
    }

    const supabase = createSupabaseServiceClient();
    if (!supabase) {
        return new Response('Database service unavailable', { status: 500 });
    }

    const { data: opp, error } = await supabase
        .from('opportunities')
        .select('*')
        .eq('id', id)
        .single();

    if (error || !opp) {
        return new Response('Opportunity not found', { status: 404 });
    }

    const mode = (url.searchParams.get('mode') === 'event' ? 'event' : 'deadline') as 'deadline' | 'event';
    const icsContent = generateIcsFile(opp as Opportunity, mode);

    const safeFilename = `${opp.title.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 30)}_${mode}.ics`;

    return new Response(icsContent, {
        status: 200,
        headers: {
            'Content-Type': 'text/calendar; charset=utf-8',
            'Content-Disposition': `attachment; filename="${safeFilename}"`,
        },
    });
};
