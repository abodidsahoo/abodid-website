import type { APIRoute } from 'astro';
import { authorizeOpportunityRequest, opportunityJson } from '../../../lib/opportunities/userAuth';
import {
    PRIVATE_SAVED_SELECT,
    savedRowToOpportunity,
    type SavedOpportunityRow,
} from '../../../lib/opportunities/saved';
import type { Opportunity } from '../../../lib/opportunities/types';
import {
    createOpportunityFromPayload,
    OpportunityCreateError,
} from '../../../lib/opportunities/createOpportunityService';

export const prerender = false;

const sortOpportunities = (opportunities: Opportunity[]) => {
    const now = Date.now();
    return opportunities.sort((a, b) => {
        const getBucket = (opportunity: Opportunity) => {
            if (opportunity.status === 'applied') return 99;
            if (opportunity.deadline_at) {
                return new Date(opportunity.deadline_at).getTime() >= now ? 1 : 5;
            }
            if (opportunity.event_date && new Date(opportunity.event_date).getTime() >= now) return 2;
            if (['needs_verification', 'none'].includes(opportunity.deadline_confidence)) return 3;
            if (opportunity.deadline_confidence === 'rolling') return 4;
            return 6;
        };

        if (a.is_high_priority !== b.is_high_priority) return a.is_high_priority ? -1 : 1;
        const bucketA = getBucket(a);
        const bucketB = getBucket(b);
        if (bucketA !== bucketB) return bucketA - bucketB;
        if (bucketA === 1 && a.deadline_at && b.deadline_at) {
            return new Date(a.deadline_at).getTime() - new Date(b.deadline_at).getTime();
        }
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
};

export const GET: APIRoute = async ({ request }) => {
    const authorization = await authorizeOpportunityRequest(request);
    if (!authorization.ok) return authorization.response;

    const { data, error } = await authorization.userClient
        .from('saved_opportunities')
        .select(PRIVATE_SAVED_SELECT)
        // Defense in depth: RLS already restricts this client to auth.uid(),
        // while the explicit predicate guarantees this response can only seed
        // the signed-in user's local search index.
        .eq('user_id', authorization.user.id)
        .order('created_at', { ascending: false });

    if (error) {
        return opportunityJson({ error: 'Could not load your opportunities' }, 500);
    }

    const opportunities = sortOpportunities(
        ((data || []) as unknown as SavedOpportunityRow[]).map(savedRowToOpportunity),
    );

    return opportunityJson({
        opportunities,
        authenticated: true,
        owner: true,
        profile: authorization.profile,
    });
};

export const POST: APIRoute = async ({ request }) => {
    const authorization = await authorizeOpportunityRequest(request);
    if (!authorization.ok) return authorization.response;

    try {
        const body = await request.json().catch(() => ({})) as Record<string, unknown>;
        const result = await createOpportunityFromPayload({
            userId: authorization.user.id,
            client: authorization.userClient,
            body,
        });
        if (result.isDuplicate) {
            return opportunityJson({
                error: 'This opportunity may already be on your radar.',
                code: 'DUPLICATE_OPPORTUNITY',
                is_duplicate: true,
                opportunity: result.opportunity,
            }, 409);
        }
        return opportunityJson({
            success: true,
            opportunity: result.opportunity,
        }, 201);
    } catch (error) {
        if (error instanceof OpportunityCreateError) {
            return opportunityJson({ error: error.message, code: error.code }, error.status);
        }
        return opportunityJson({ error: 'Could not create this opportunity' }, 500);
    }
};
