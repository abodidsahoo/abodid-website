import type { APIRoute } from 'astro';
import { z } from 'zod';
import { authorizeOpportunityRequest, opportunityJson } from '../../../lib/opportunities/userAuth';
import { PRODUCT_UPDATES_CONSENT_TEXT, PRODUCT_UPDATES_CONSENT_VERSION } from '../../../lib/opportunities/productUpdates';

export const prerender = false;
const preferenceSchema = z.object({
    opt_in: z.boolean(),
    source: z.enum(['onboarding', 'profile']),
    consent_version: z.literal(PRODUCT_UPDATES_CONSENT_VERSION),
}).strict();

export const GET: APIRoute = async ({ request }) => {
    const auth = await authorizeOpportunityRequest(request);
    if (!auth.ok) return auth.response;
    const { data, error } = await auth.serviceClient.from('opportunity_memberships')
        .select('product_updates_opt_in, product_updates_email').eq('user_id', auth.user.id).maybeSingle();
    if (error) return opportunityJson({ error: 'Email preferences are temporarily unavailable.' }, 500);
    return opportunityJson({ opt_in: Boolean(data?.product_updates_opt_in
        && data.product_updates_email?.toLowerCase() === auth.user.email?.toLowerCase()) });
};

export const POST: APIRoute = async ({ request }) => {
    const auth = await authorizeOpportunityRequest(request);
    if (!auth.ok) return auth.response;
    const parsed = preferenceSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return opportunityJson({ error: 'Please choose your email preference again.' }, 400);
    const { opt_in: optedIn, source } = parsed.data;
    if (optedIn && (!auth.user.email || !auth.user.email_confirmed_at)) {
        return opportunityJson({ error: 'A verified email is required to receive product updates.' }, 409);
    }
    const now = new Date().toISOString();
    const values = optedIn ? {
        product_updates_opt_in: true,
        product_updates_email: auth.user.email!.toLowerCase(),
        product_updates_opt_in_at: now,
        product_updates_consent_version: PRODUCT_UPDATES_CONSENT_VERSION,
        product_updates_consent_text: PRODUCT_UPDATES_CONSENT_TEXT,
        product_updates_consent_source: source,
    } : {
        product_updates_opt_in: false,
        product_updates_opt_out_at: now,
    };
    // Only the verified token determines whose preference and address may change.
    const { error } = await auth.serviceClient.from('opportunity_memberships')
        .upsert({ user_id: auth.user.id, ...values, updated_at: now }, { onConflict: 'user_id', defaultToNull: false });
    if (error) return opportunityJson({ error: 'Your email preference could not be saved. Please try again.' }, 500);
    return opportunityJson({ opt_in: optedIn });
};
