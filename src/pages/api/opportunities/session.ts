import type { APIRoute } from 'astro';
import { authorizeOpportunityRequest, opportunityJson } from '../../../lib/opportunities/userAuth';
import { recordOpportunityOnboarding } from '../../../lib/opportunities/onboarding';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
    const authorization = await authorizeOpportunityRequest(request);
    if (!authorization.ok) return authorization.response;

    try {
        const onboarding = await recordOpportunityOnboarding({
            serviceClient: authorization.serviceClient,
            user: authorization.user,
            profile: authorization.profile,
        });
        if (onboarding.status === 'notification_failed') {
            console.error('Opportunity signup notification failed:', onboarding.error);
        }
    } catch (error) {
        // Tracker access must never depend on an operational owner notification.
        console.error('Opportunity onboarding could not be recorded:', error);
    }

    return opportunityJson({
        user: {
            id: authorization.user.id,
            email: authorization.user.email || null,
        },
        profile: authorization.profile,
    });
};
