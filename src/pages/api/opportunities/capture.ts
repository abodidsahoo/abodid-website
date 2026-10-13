import type { APIRoute } from 'astro';
import {
    computeContentHash,
    fetchWebpageContent,
    prioritizeOpportunityText,
} from '../../../lib/opportunities/scraper';
import { extractOpportunityWithLLM, resolveOpportunityDeadline, parseEventDate } from '../../../lib/opportunities/extractor';
import { formatOpportunityTitle } from '../../../lib/opportunities/ui-helpers';
import { authorizeOpportunityRequest, opportunityJson } from '../../../lib/opportunities/userAuth';
import {
    PRIVATE_SAVED_SELECT,
    opportunityToSavedInsert,
    savedRowToOpportunity,
    type SavedOpportunityRow,
} from '../../../lib/opportunities/saved';
import type { Opportunity } from '../../../lib/opportunities/types';
import { consumeOpportunityAiLimit } from '../../../lib/opportunities/rateLimit';
import { normalizeOpportunityCaptureUrl } from '../../../lib/opportunities/captureUrl';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
    const authorization = await authorizeOpportunityRequest(request);
    if (!authorization.ok) return authorization.response;

    try {
        const body = await request.json().catch(() => ({}));
        const url = typeof body.url === 'string' ? body.url.trim() : '';
        if (!url || url.length > 4096) return opportunityJson({ error: 'A valid URL is required' }, 400);

        let sourceUrl: string;
        let canonicalUrl: string;
        try {
            ({ sourceUrl, canonicalUrl } = normalizeOpportunityCaptureUrl(url));
        } catch {
            return opportunityJson({ error: 'Enter a valid HTTP or HTTPS URL' }, 400);
        }

        // Per-user deduplication is the first check and costs no AI tokens.
        const { data: existing } = await authorization.userClient
            .from('saved_opportunities')
            .select(PRIVATE_SAVED_SELECT)
            .eq('canonical_url', canonicalUrl)
            .maybeSingle();

        if (existing) {
            return opportunityJson({
                success: true,
                is_duplicate: true,
                opportunity: savedRowToOpportunity(existing as unknown as SavedOpportunityRow),
            });
        }

        // Reuse a founder-curated legacy record without running extraction again.
        const { data: curated } = await authorization.serviceClient
            .from('opportunities')
            .select('*')
            .eq('canonical_url', canonicalUrl)
            .maybeSingle();

        if (curated) {
            const insert = opportunityToSavedInsert(authorization.user.id, curated as Opportunity);
            const { data, error } = await authorization.userClient
                .from('saved_opportunities')
                .upsert(insert, { onConflict: 'user_id,canonical_url', ignoreDuplicates: false })
                .select(PRIVATE_SAVED_SELECT)
                .single();
            if (error || !data) return opportunityJson({ error: 'Could not save this curated opportunity' }, 500);
            return opportunityJson({
                success: true,
                is_duplicate: false,
                reused_curated_record: true,
                opportunity: savedRowToOpportunity(data as unknown as SavedOpportunityRow),
            }, 201);
        }

        const providedText = typeof body.page_text === 'string' ? body.page_text.slice(0, 100_000) : '';
        let cleanText = '';
        let pageTitle = typeof body.title === 'string' ? body.title.slice(0, 500) : '';

        if (providedText.trim().length > 100) {
            cleanText = prioritizeOpportunityText(providedText.trim());
        } else {
            try {
                const fetched = await fetchWebpageContent(canonicalUrl);
                cleanText = fetched.text;
                pageTitle = pageTitle || fetched.title;
            } catch {
                return opportunityJson({
                    error: 'The page could not be fetched safely. Add it manually or try from the browser extension.',
                    can_manual_create: true,
                    canonical_url: canonicalUrl,
                }, 422);
            }
        }

        if (cleanText.length < 50) {
            return opportunityJson({
                error: 'The page did not contain enough readable content. Add it manually instead.',
                can_manual_create: true,
                canonical_url: canonicalUrl,
            }, 422);
        }

        // Charge the durable quota only when a new OpenRouter extraction is
        // actually needed; duplicates and curated cache hits remain free.
        const aiLimit = await consumeOpportunityAiLimit(authorization.serviceClient, authorization.user.id);
        if (!aiLimit.allowed) {
            if (aiLimit.unavailable) {
                return opportunityJson({
                    error: 'Capture is temporarily unavailable. Please try again in a moment.',
                    code: 'CAPTURE_QUOTA_UNAVAILABLE',
                }, 503);
            }

            const retryMinutes = Math.max(1, Math.ceil(aiLimit.retryAfter / 60));
            const response = opportunityJson({
                error: `Capture limit reached. Try again in ${retryMinutes} minute${retryMinutes === 1 ? '' : 's'}.`,
                retry_after: aiLimit.retryAfter,
            }, 429);
            response.headers.set('Retry-After', String(aiLimit.retryAfter));
            return response;
        }

        let extractedResult: Awaited<ReturnType<typeof extractOpportunityWithLLM>>;
        try {
            extractedResult = await extractOpportunityWithLLM(cleanText, pageTitle, {
                sourceUrl,
                capturedAt: typeof body.captured_at === 'string' ? body.captured_at : new Date().toISOString(),
                timezone: typeof body.capture_timezone === 'string' ? body.capture_timezone : undefined,
            });
        } catch (error) {
            console.error('Opportunity extraction failed', {
                userId: authorization.user.id,
                canonicalUrl,
                error: error instanceof Error ? error.name : 'UnknownError',
            });
            return opportunityJson({
                error: 'Extraction could not be completed. Add the opportunity manually or try again later.',
                can_manual_create: true,
                canonical_url: canonicalUrl,
            }, 502);
        }

        const { data: extracted, model } = extractedResult;
        const capturedAt = typeof body.captured_at === 'string' ? body.captured_at : undefined;
        const captureTimezone = typeof body.capture_timezone === 'string' ? body.capture_timezone : undefined;
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
            summary: extracted.summary || null,
            status: 'inbox',
            priority: 1,
            outcome: null,
            notes: null,
            source_hash: computeContentHash(cleanText),
            llm_model: model,
            llm_extraction_count: 1,
            extracted_at: new Date().toISOString(),
        } as Opportunity;

        const insert = opportunityToSavedInsert(authorization.user.id, opportunity);
        const { data, error } = await authorization.userClient
            .from('saved_opportunities')
            .upsert(insert, { onConflict: 'user_id,canonical_url', ignoreDuplicates: false })
            .select(PRIVATE_SAVED_SELECT)
            .single();

        if (error || !data) return opportunityJson({ error: 'The opportunity was extracted but could not be saved' }, 500);

        return opportunityJson({
            success: true,
            is_duplicate: false,
            opportunity: savedRowToOpportunity(data as unknown as SavedOpportunityRow),
        }, 201);
    } catch (error) {
        console.error('Capture endpoint failed', error instanceof Error ? error.name : 'UnknownError');
        return opportunityJson({ error: 'Capture failed unexpectedly' }, 500);
    }
};
