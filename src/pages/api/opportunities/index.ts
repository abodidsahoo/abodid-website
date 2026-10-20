import type { APIRoute } from 'astro';
import { canonicalizeUrl } from '../../../lib/opportunities/scraper';
import { parseDeadline, parseEventDate } from '../../../lib/opportunities/extractor';
import { formatOpportunityTitle } from '../../../lib/opportunities/ui-helpers';
import { authorizeOpportunityRequest, opportunityJson } from '../../../lib/opportunities/userAuth';
import {
    PRIVATE_SAVED_SELECT,
    opportunityToSavedInsert,
    savedRowToOpportunity,
    type SavedOpportunityRow,
} from '../../../lib/opportunities/saved';
import { OpportunityCategorySchema, OpportunityStatusSchema, type Opportunity } from '../../../lib/opportunities/types';
import { findOpportunityDataDuplicate } from '../../../lib/opportunities/unifiedInput';

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
        const body = await request.json().catch(() => ({}));
        const title = typeof body.title === 'string' ? body.title.trim() : '';
        const sourceUrl = typeof body.source_url === 'string' ? body.source_url.trim() : '';
        if (!title || !sourceUrl || sourceUrl.length > 4096) {
            return opportunityJson({ error: 'Title and source URL are required' }, 400);
        }

        const category = OpportunityCategorySchema.safeParse(body.category || 'other');
        const status = OpportunityStatusSchema.safeParse(body.status || 'reviewing');
        if (!category.success || !status.success) {
            return opportunityJson({ error: 'Invalid category or status' }, 400);
        }

        let canonicalUrl: string;
        try {
            canonicalUrl = canonicalizeUrl(sourceUrl);
        } catch {
            return opportunityJson({ error: 'Enter a valid HTTP or HTTPS source URL' }, 400);
        }

        const { data: urlDuplicate, error: urlDuplicateError } = await authorization.userClient
            .from('saved_opportunities')
            .select(PRIVATE_SAVED_SELECT)
            .eq('user_id', authorization.user.id)
            .eq('canonical_url', canonicalUrl)
            .maybeSingle();
        if (urlDuplicateError) {
            return opportunityJson({ error: 'Could not check for existing opportunities' }, 500);
        }
        if (urlDuplicate) {
            return opportunityJson({
                error: 'This opportunity is already on your radar.',
                code: 'DUPLICATE_OPPORTUNITY',
                is_duplicate: true,
                opportunity: savedRowToOpportunity(urlDuplicate as unknown as SavedOpportunityRow),
            }, 409);
        }

        const parsedDeadline = parseDeadline(body.deadline, body.timezone);
        const parsedEventDate = parseEventDate(body.event_date, undefined, body.timezone);
        const opportunity = {
            title: formatOpportunityTitle(title).slice(0, 240),
            organisation: String(body.organisation || 'Independent / Direct').trim().slice(0, 240),
            category: category.data,
            source_url: sourceUrl,
            canonical_url: canonicalUrl,
            deadline_at: parsedDeadline.deadline_at,
            deadline_raw: parsedDeadline.deadline_raw,
            deadline_timezone: parsedDeadline.deadline_timezone,
            deadline_confidence: parsedDeadline.deadline_confidence,
            event_date: parsedEventDate,
            location: typeof body.location === 'string' ? body.location.trim().slice(0, 1000) || null : null,
            requirements: Array.isArray(body.requirements)
                ? body.requirements.slice(0, 50).map((value: unknown) => String(value).slice(0, 500))
                : typeof body.requirements === 'string'
                    ? body.requirements.split(',').map((value: string) => value.trim()).filter(Boolean).slice(0, 50)
                    : [],
            next_action: typeof body.next_action === 'string' ? body.next_action.trim().slice(0, 1000) || null : null,
            application_url: typeof body.application_url === 'string' ? body.application_url.trim().slice(0, 4096) || null : null,
            meeting_url: typeof body.meeting_url === 'string' ? body.meeting_url.trim().slice(0, 4096) || null : null,
            fee_or_funding: typeof body.fee_or_funding === 'string' ? body.fee_or_funding.trim().slice(0, 1000) || null : null,
            application_fee: typeof body.application_fee === 'string' ? body.application_fee.trim().slice(0, 1000) || null : null,
            summary: typeof body.summary === 'string' ? body.summary.trim().slice(0, 10000) || null : null,
            status: status.data,
            is_high_priority: Boolean(body.is_high_priority),
            outcome: null,
            notes: typeof body.notes === 'string' ? body.notes.trim().slice(0, 20000) || null : null,
            extracted_at: new Date().toISOString(),
            source_hash: null,
            llm_model: 'manual',
            llm_extraction_count: 0,
        } as Opportunity;

        const { data: possibleDuplicates, error: duplicateLookupError } = await authorization.userClient
            .from('saved_opportunities')
            .select(PRIVATE_SAVED_SELECT)
            .eq('user_id', authorization.user.id)
            .order('created_at', { ascending: false })
            .limit(1000);
        if (duplicateLookupError) {
            return opportunityJson({ error: 'Could not check for existing opportunities' }, 500);
        }

        const existing = findOpportunityDataDuplicate(
            ((possibleDuplicates || []) as unknown as SavedOpportunityRow[]).map(savedRowToOpportunity),
            opportunity,
        );
        if (existing) {
            return opportunityJson({
                error: 'This opportunity may already be on your radar.',
                code: 'DUPLICATE_OPPORTUNITY',
                is_duplicate: true,
                opportunity: existing,
            }, 409);
        }

        const insert = opportunityToSavedInsert(authorization.user.id, opportunity);
        const { data, error } = await authorization.userClient
            .from('saved_opportunities')
            .insert(insert)
            .select(PRIVATE_SAVED_SELECT)
            .single();

        if (error || !data) {
            if (error?.code === '23505') {
                const { data: duplicate } = await authorization.userClient
                    .from('saved_opportunities')
                    .select(PRIVATE_SAVED_SELECT)
                    .eq('user_id', authorization.user.id)
                    .eq('canonical_url', canonicalUrl)
                    .maybeSingle();
                if (duplicate) {
                    return opportunityJson({
                        error: 'This opportunity is already on your radar.',
                        code: 'DUPLICATE_OPPORTUNITY',
                        is_duplicate: true,
                        opportunity: savedRowToOpportunity(duplicate as unknown as SavedOpportunityRow),
                    }, 409);
                }
            }
            return opportunityJson({ error: 'Could not save this opportunity' }, 500);
        }

        return opportunityJson({
            success: true,
            opportunity: savedRowToOpportunity(data as unknown as SavedOpportunityRow),
        }, 201);
    } catch {
        return opportunityJson({ error: 'Could not create this opportunity' }, 500);
    }
};
