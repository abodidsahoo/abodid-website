import type { SupabaseClient } from '@supabase/supabase-js';
import {
    computeContentHash,
    fetchWebpageContent,
    prioritizeOpportunityText,
} from './scraper';
import { extractOpportunityWithLLM, parseEventDate, resolveOpportunityDeadline } from './extractor';
import { formatOpportunityTitle } from './ui-helpers';
import {
    PRIVATE_SAVED_SELECT,
    opportunityToSavedInsert,
    savedRowToOpportunity,
    type SavedOpportunityRow,
} from './saved';
import type { Opportunity } from './types';
import { consumeOpportunityAiLimit } from './rateLimit';
import { normalizeOpportunityCaptureUrl } from './captureUrl';

export type OpportunityUrlCaptureInput = {
    url: string;
    title?: string;
    page_text?: string;
    captured_at?: string;
    capture_timezone?: string;
};

export type OpportunityCaptureResult = {
    opportunity: Opportunity;
    is_duplicate: boolean;
    reused_curated_record?: boolean;
};

export class OpportunityCaptureError extends Error {
    constructor(
        message: string,
        readonly status: number,
        readonly code?: string,
        readonly details: Record<string, unknown> = {},
    ) {
        super(message);
        this.name = 'OpportunityCaptureError';
    }
}

const throwSaveFailure = (
    error: { code?: string; message?: string; details?: string; hint?: string } | null,
    context: { userId: string; canonicalUrl: string; source: 'curated' | 'extracted' },
): never => {
    const code = error?.code || 'UNKNOWN_SAVE_ERROR';
    console.error('Opportunity database save failed', {
        ...context,
        code,
        message: error?.message?.slice(0, 300) || 'No database error message',
        details: error?.details?.slice(0, 300) || null,
        hint: error?.hint?.slice(0, 300) || null,
    });

    const isSchemaMismatch = ['42P01', '42703', 'PGRST204', 'PGRST205'].includes(code);
    throw new OpportunityCaptureError(
        isSchemaMismatch
            ? 'Opportunity storage was being updated. Please try capturing it again now.'
            : 'The opportunity was extracted but could not be saved. Please try again.',
        isSchemaMismatch ? 503 : 500,
        isSchemaMismatch ? 'OPPORTUNITY_STORAGE_UPDATING' : 'OPPORTUNITY_SAVE_FAILED',
    );
};

/** The unique constraint settles concurrent captures without overwriting edits. */
export const insertCapturedOpportunity = async (
    client: SupabaseClient,
    insert: ReturnType<typeof opportunityToSavedInsert>,
    context: { userId: string; canonicalUrl: string; source: 'curated' | 'extracted' },
): Promise<OpportunityCaptureResult> => {
    const { data, error } = await client.from('saved_opportunities')
        .insert(insert).select(PRIVATE_SAVED_SELECT).single();
    if (error?.code === '23505') {
        const existing = await client.from('saved_opportunities')
            .select(PRIVATE_SAVED_SELECT)
            .eq('user_id', context.userId).eq('canonical_url', context.canonicalUrl).maybeSingle();
        if (!existing.error && existing.data) {
            return { is_duplicate: true, opportunity: savedRowToOpportunity(existing.data as unknown as SavedOpportunityRow) };
        }
        throwSaveFailure(existing.error || error, context);
    }
    if (error || !data) throwSaveFailure(error, context);
    return { is_duplicate: false, opportunity: savedRowToOpportunity(data as unknown as SavedOpportunityRow) };
};

/**
 * Shared URL capture orchestration used by the synchronous compatibility API
 * and the durable background-job processor. Every user-owned query includes an
 * explicit user_id predicate so the service-role worker cannot cross accounts.
 */
export const captureOpportunityFromUrl = async ({
    userId,
    userClient,
    serviceClient,
    input,
}: {
    userId: string;
    userClient: SupabaseClient;
    serviceClient: SupabaseClient;
    input: OpportunityUrlCaptureInput;
}): Promise<OpportunityCaptureResult> => {
    const url = typeof input.url === 'string' ? input.url.trim() : '';
    if (!url || url.length > 4096) {
        throw new OpportunityCaptureError('A valid URL is required', 400, 'INVALID_URL');
    }

    let sourceUrl: string;
    let canonicalUrl: string;
    try {
        ({ sourceUrl, canonicalUrl } = normalizeOpportunityCaptureUrl(url));
    } catch {
        throw new OpportunityCaptureError('Enter a valid HTTP or HTTPS URL', 400, 'INVALID_URL');
    }

    const { data: existing, error: existingError } = await userClient
        .from('saved_opportunities')
        .select(PRIVATE_SAVED_SELECT)
        .eq('user_id', userId)
        .eq('canonical_url', canonicalUrl)
        .maybeSingle();

    if (existingError) {
        throw new OpportunityCaptureError('Could not check for an existing opportunity', 500, 'DUPLICATE_CHECK_FAILED');
    }
    if (existing) {
        return {
            is_duplicate: true,
            opportunity: savedRowToOpportunity(existing as unknown as SavedOpportunityRow),
        };
    }

    const { data: curated } = await serviceClient
        .from('opportunities')
        .select('*')
        .eq('canonical_url', canonicalUrl)
        .maybeSingle();

    if (curated) {
        const insert = opportunityToSavedInsert(userId, curated as Opportunity);
        const result = await insertCapturedOpportunity(userClient, insert, { userId, canonicalUrl, source: 'curated' });
        return {
            ...result,
            reused_curated_record: true,
        };
    }

    const providedText = typeof input.page_text === 'string' ? input.page_text.slice(0, 100_000) : '';
    let cleanText = '';
    let pageTitle = typeof input.title === 'string' ? input.title.slice(0, 500) : '';

    if (providedText.trim().length > 100) {
        cleanText = prioritizeOpportunityText(providedText.trim());
    } else {
        try {
            const fetched = await fetchWebpageContent(canonicalUrl);
            cleanText = fetched.text;
            pageTitle = pageTitle || fetched.title;
        } catch {
            throw new OpportunityCaptureError(
                'The page could not be fetched safely. Paste its description, attach a screenshot, or try from the browser extension.',
                422,
                'PAGE_FETCH_FAILED',
                { can_manual_create: true, canonical_url: canonicalUrl },
            );
        }
    }

    if (cleanText.length < 50) {
        throw new OpportunityCaptureError(
            'The page did not contain enough readable content. Paste its description or attach a screenshot instead.',
            422,
            'PAGE_CONTENT_INSUFFICIENT',
            { can_manual_create: true, canonical_url: canonicalUrl },
        );
    }

    const aiLimit = await consumeOpportunityAiLimit(serviceClient, userId);
    if (!aiLimit.allowed) {
        if (aiLimit.unavailable) {
            throw new OpportunityCaptureError(
                'Capture is temporarily unavailable. Please try again in a moment.',
                503,
                'CAPTURE_QUOTA_UNAVAILABLE',
            );
        }
        const retryMinutes = Math.max(1, Math.ceil(aiLimit.retryAfter / 60));
        throw new OpportunityCaptureError(
            `Capture limit reached. Try again in ${retryMinutes} minute${retryMinutes === 1 ? '' : 's'}.`,
            429,
            'CAPTURE_LIMIT_REACHED',
            { retry_after: aiLimit.retryAfter },
        );
    }

    let extractedResult: Awaited<ReturnType<typeof extractOpportunityWithLLM>>;
    try {
        extractedResult = await extractOpportunityWithLLM(cleanText, pageTitle, {
            sourceUrl,
            capturedAt: typeof input.captured_at === 'string' ? input.captured_at : new Date().toISOString(),
            timezone: typeof input.capture_timezone === 'string' ? input.capture_timezone : undefined,
        });
    } catch (error) {
        console.error('Opportunity extraction failed', {
            userId,
            canonicalUrl,
            error: error instanceof Error ? error.name : 'UnknownError',
            message: error instanceof Error ? error.message.slice(0, 300) : 'Unknown extraction failure',
        });
        throw new OpportunityCaptureError(
            'Extraction could not be completed. Paste the description, attach a screenshot, or try again later.',
            502,
            'EXTRACTION_FAILED',
            { can_manual_create: true, canonical_url: canonicalUrl },
        );
    }

    const { data: extracted, model } = extractedResult;
    const capturedAt = typeof input.captured_at === 'string' ? input.captured_at : undefined;
    const captureTimezone = typeof input.capture_timezone === 'string' ? input.capture_timezone : undefined;
    const deadline = resolveOpportunityDeadline(extracted.deadline, extracted.timezone, cleanText);
    const eventDate = parseEventDate(extracted.event_date, capturedAt, captureTimezone);

    const opportunity = {
        title: formatOpportunityTitle(extracted.title || pageTitle || 'Untitled Opportunity').slice(0, 240),
        organisation: extracted.organisation || 'Unknown Organisation',
        category: extracted.category || 'other',
        source_url: sourceUrl,
        canonical_url: canonicalUrl,
        deadline_at: deadline.deadline_at,
        deadline_raw: deadline.deadline_raw,
        deadline_timezone: deadline.deadline_timezone,
        deadline_confidence: deadline.deadline_confidence,
        event_date: eventDate,
        location: extracted.location || null,
        requirements: Array.isArray(extracted.requirements) ? extracted.requirements.slice(0, 50) : [],
        next_action: extracted.next_action || null,
        application_url: extracted.application_url || null,
        meeting_url: extracted.meeting_url || null,
        fee_or_funding: extracted.fee_or_funding || null,
        application_fee: extracted.application_fee || null,
        summary: extracted.summary || null,
        status: 'reviewing',
        is_high_priority: false,
        outcome: null,
        notes: null,
        source_hash: computeContentHash(cleanText),
        llm_model: model,
        llm_extraction_count: 1,
        extracted_at: new Date().toISOString(),
    } as Opportunity;

    const insert = opportunityToSavedInsert(userId, opportunity);
    return insertCapturedOpportunity(userClient, insert, { userId, canonicalUrl, source: 'extracted' });
};
