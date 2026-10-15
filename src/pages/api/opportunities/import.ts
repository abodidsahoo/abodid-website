import type { APIRoute } from 'astro';
import { z } from 'zod';
import { authorizeOpportunityRequest, opportunityJson } from '../../../lib/opportunities/userAuth';
import {
    PRIVATE_SAVED_SELECT,
    savedRowToOpportunity,
    type SavedOpportunityRow,
} from '../../../lib/opportunities/saved';

export const prerender = false;

const ImportRequestSchema = z.object({
    source_opportunity_id: z.string().uuid(),
}).strict();

type ImportRpcRow = {
    opportunity_id: string | null;
    import_status: 'added' | 'already_saved' | 'owned' | 'unavailable';
};

export const POST: APIRoute = async ({ request }) => {
    const authorization = await authorizeOpportunityRequest(request);
    if (!authorization.ok) return authorization.response;

    const parsed = ImportRequestSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return opportunityJson({ error: 'Invalid opportunity' }, 400);

    const { data, error } = await authorization.userClient.rpc('copy_public_opportunity', {
        p_source_opportunity_id: parsed.data.source_opportunity_id,
    });

    if (error) {
        console.error('Public opportunity import failed', {
            userId: authorization.user.id,
            code: error.code,
        });
        return opportunityJson({ error: 'Could not add this opportunity' }, 500);
    }

    const result = (Array.isArray(data) ? data[0] : data) as ImportRpcRow | null;
    if (!result || result.import_status === 'unavailable' || !result.opportunity_id) {
        return opportunityJson({ error: 'This opportunity is no longer available' }, 404);
    }

    const { data: saved, error: savedError } = await authorization.userClient
        .from('saved_opportunities')
        .select(PRIVATE_SAVED_SELECT)
        .eq('id', result.opportunity_id)
        .single();

    if (savedError || !saved) {
        return opportunityJson({ error: 'The opportunity was added but could not be opened' }, 500);
    }

    return opportunityJson({
        success: true,
        status: result.import_status,
        opportunity: savedRowToOpportunity(saved as unknown as SavedOpportunityRow),
        profile: { username: authorization.profile.username },
    }, result.import_status === 'added' ? 201 : 200);
};
