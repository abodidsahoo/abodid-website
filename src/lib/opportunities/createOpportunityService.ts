import type { SupabaseClient } from '@supabase/supabase-js';
import { parseDeadline, parseEventDate } from './extractor';
import {
    PRIVATE_SAVED_SELECT,
    opportunityToSavedInsert,
    savedRowToOpportunity,
    type SavedOpportunityRow,
} from './saved';
import { canonicalizeUrl } from './scraper';
import { OpportunityCategorySchema, OpportunityStatusSchema, type Opportunity } from './types';
import { findOpportunityDataDuplicate } from './unifiedInput';
import { formatOpportunityTitle } from './ui-helpers';

export class OpportunityCreateError extends Error {
    constructor(
        message: string,
        readonly status: number,
        readonly code = 'OPPORTUNITY_CREATE_FAILED',
    ) {
        super(message);
        this.name = 'OpportunityCreateError';
    }
}

export const createOpportunityFromPayload = async ({
    userId,
    client,
    body,
    extractionMetadata,
}: {
    userId: string;
    client: SupabaseClient;
    body: Record<string, unknown>;
    extractionMetadata?: { model: string; count: number };
}): Promise<{ opportunity: Opportunity; isDuplicate: boolean }> => {
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    const sourceUrl = typeof body.source_url === 'string' ? body.source_url.trim() : '';
    if (!title || !sourceUrl || sourceUrl.length > 4096) {
        throw new OpportunityCreateError('Title and source URL are required', 400, 'INVALID_OPPORTUNITY');
    }

    const category = OpportunityCategorySchema.safeParse(body.category || 'other');
    const status = OpportunityStatusSchema.safeParse(body.status || 'reviewing');
    if (!category.success || !status.success) {
        throw new OpportunityCreateError('Invalid category or status', 400, 'INVALID_OPPORTUNITY');
    }

    let canonicalUrl: string;
    try {
        canonicalUrl = canonicalizeUrl(sourceUrl);
    } catch {
        throw new OpportunityCreateError(
            'Enter a valid HTTP or HTTPS source URL',
            400,
            'INVALID_SOURCE_URL',
        );
    }

    const { data: urlDuplicate, error: urlDuplicateError } = await client
        .from('saved_opportunities')
        .select(PRIVATE_SAVED_SELECT)
        .eq('user_id', userId)
        .eq('canonical_url', canonicalUrl)
        .maybeSingle();
    if (urlDuplicateError) {
        throw new OpportunityCreateError(
            'Could not check for existing opportunities',
            500,
            'DUPLICATE_CHECK_FAILED',
        );
    }
    if (urlDuplicate) {
        return {
            isDuplicate: true,
            opportunity: savedRowToOpportunity(urlDuplicate as unknown as SavedOpportunityRow),
        };
    }

    const deadline = typeof body.deadline === 'string' ? body.deadline : undefined;
    const timezone = typeof body.timezone === 'string' ? body.timezone : undefined;
    const eventDate = typeof body.event_date === 'string' ? body.event_date : undefined;
    const parsedDeadline = parseDeadline(deadline, timezone);
    const parsedEventDate = parseEventDate(eventDate, undefined, timezone);
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
        llm_model: extractionMetadata?.model || 'manual',
        llm_extraction_count: extractionMetadata?.count || 0,
    } as Opportunity;

    const { data: possibleDuplicates, error: duplicateLookupError } = await client
        .from('saved_opportunities')
        .select(PRIVATE_SAVED_SELECT)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1000);
    if (duplicateLookupError) {
        throw new OpportunityCreateError(
            'Could not check for existing opportunities',
            500,
            'DUPLICATE_CHECK_FAILED',
        );
    }

    const existing = findOpportunityDataDuplicate(
        ((possibleDuplicates || []) as unknown as SavedOpportunityRow[]).map(savedRowToOpportunity),
        opportunity,
    );
    if (existing) return { opportunity: existing, isDuplicate: true };

    const insert = opportunityToSavedInsert(userId, opportunity);
    const { data, error } = await client
        .from('saved_opportunities')
        .insert(insert)
        .select(PRIVATE_SAVED_SELECT)
        .single();

    if (error || !data) {
        if (error?.code === '23505') {
            const { data: duplicate } = await client
                .from('saved_opportunities')
                .select(PRIVATE_SAVED_SELECT)
                .eq('user_id', userId)
                .eq('canonical_url', canonicalUrl)
                .maybeSingle();
            if (duplicate) {
                return {
                    isDuplicate: true,
                    opportunity: savedRowToOpportunity(duplicate as unknown as SavedOpportunityRow),
                };
            }
        }
        throw new OpportunityCreateError(
            'Could not save this opportunity',
            500,
            'OPPORTUNITY_SAVE_FAILED',
        );
    }

    return {
        isDuplicate: false,
        opportunity: savedRowToOpportunity(data as unknown as SavedOpportunityRow),
    };
};
