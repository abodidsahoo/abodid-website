import type { APIRoute } from 'astro';
import { authorizeOpportunityRequest, opportunityJson } from '../../../lib/opportunities/userAuth';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
    const authorization = await authorizeOpportunityRequest(request);
    if (!authorization.ok) return authorization.response;
    return opportunityJson({
        user: {
            id: authorization.user.id,
            email: authorization.user.email || null,
        },
        profile: authorization.profile,
    });
};
