import type { APIRoute } from 'astro';
import { parseDeadline, parseEventDate } from '../../../lib/opportunities/extractor';
import { formatOpportunityTitle } from '../../../lib/opportunities/ui-helpers';
import { authorizeOpportunityRequest, opportunityJson } from '../../../lib/opportunities/userAuth';
import { PRIVATE_SAVED_SELECT, savedRowToOpportunity, type SavedOpportunityRow } from '../../../lib/opportunities/saved';
import { OpportunityCategorySchema, OpportunityOutcomeSchema, OpportunityStatusSchema } from '../../../lib/opportunities/types';

export const prerender = false;

const boundedNullableString = (value: unknown, max: number) => {
    if (value === null || value === '') return null;
    if (typeof value !== 'string') return undefined;
    return value.trim().slice(0, max) || null;
};

export const PATCH: APIRoute = async ({ params, request }) => {
    const authorization = await authorizeOpportunityRequest(request);
    if (!authorization.ok) return authorization.response;

    const id = params.id;
    if (!id) return opportunityJson({ error: 'Opportunity ID is required' }, 400);

    const { data: current, error: currentError } = await authorization.userClient
        .from('saved_opportunities')
        .select(PRIVATE_SAVED_SELECT)
        .eq('id', id)
        .single();

    if (currentError || !current) return opportunityJson({ error: 'Opportunity not found' }, 404);

    const body = await request.json().catch(() => ({}));
    const row = current as unknown as SavedOpportunityRow;
    const content: Record<string, unknown> = { ...(row.content || {}) };
    const updates: Record<string, unknown> = {};

    if (body.title !== undefined) {
        const title = boundedNullableString(body.title, 240);
        if (!title) return opportunityJson({ error: 'Title cannot be empty' }, 400);
        updates.title = formatOpportunityTitle(title);
    }

    if (body.status !== undefined) {
        const status = OpportunityStatusSchema.safeParse(body.status);
        if (!status.success) return opportunityJson({ error: 'Invalid status' }, 400);
        updates.status = status.data;
    }

    if (body.priority !== undefined) {
        const priority = Number(body.priority);
        if (![1, 2, 3].includes(priority)) return opportunityJson({ error: 'Invalid priority' }, 400);
        updates.priority = priority;
    }

    if (body.outcome !== undefined) {
        const outcome = OpportunityOutcomeSchema.safeParse(body.outcome || null);
        if (!outcome.success) return opportunityJson({ error: 'Invalid outcome' }, 400);
        updates.outcome = outcome.data;
    }

    if (body.notes !== undefined) updates.notes = boundedNullableString(body.notes, 20000);

    if (body.category !== undefined) {
        const category = OpportunityCategorySchema.safeParse(body.category);
        if (!category.success) return opportunityJson({ error: 'Invalid category' }, 400);
        content.category = category.data;
    }

    const contentStringFields: Array<[string, number]> = [
        ['organisation', 240], ['next_action', 1000], ['application_url', 4096],
        ['meeting_url', 4096], ['fee_or_funding', 1000], ['summary', 10000], ['location', 1000],
    ];
    for (const [field, max] of contentStringFields) {
        if (body[field] !== undefined) content[field] = boundedNullableString(body[field], max);
    }

    if (body.requirements !== undefined) {
        content.requirements = Array.isArray(body.requirements)
            ? body.requirements.slice(0, 50).map((value: unknown) => String(value).slice(0, 500))
            : typeof body.requirements === 'string'
                ? body.requirements.split(',').map((value: string) => value.trim()).filter(Boolean).slice(0, 50)
                : [];
    }

    if (body.deadline !== undefined || body.deadline_at !== undefined) {
        const parsed = parseDeadline(body.deadline || body.deadline_at, body.timezone || body.deadline_timezone);
        updates.deadline_at = parsed.deadline_at;
        content.deadline_raw = parsed.deadline_raw;
        content.deadline_timezone = parsed.deadline_timezone;
        content.deadline_confidence = parsed.deadline_confidence;
    }

    if (body.event_date !== undefined) content.event_date = parseEventDate(body.event_date);
    updates.content = content;

    const { data, error } = await authorization.userClient
        .from('saved_opportunities')
        .update(updates)
        .eq('id', id)
        .select(PRIVATE_SAVED_SELECT)
        .single();

    if (error || !data) return opportunityJson({ error: 'Could not update this opportunity' }, 500);

    return opportunityJson({
        success: true,
        opportunity: savedRowToOpportunity(data as unknown as SavedOpportunityRow),
    });
};

export const DELETE: APIRoute = async ({ params, request }) => {
    const authorization = await authorizeOpportunityRequest(request);
    if (!authorization.ok) return authorization.response;

    const id = params.id;
    if (!id) return opportunityJson({ error: 'Opportunity ID is required' }, 400);

    const { data, error } = await authorization.userClient
        .from('saved_opportunities')
        .delete()
        .eq('id', id)
        .select('id')
        .maybeSingle();

    if (error) return opportunityJson({ error: 'Could not delete this opportunity' }, 500);
    if (!data) return opportunityJson({ error: 'Opportunity not found' }, 404);
    return opportunityJson({ success: true });
};
