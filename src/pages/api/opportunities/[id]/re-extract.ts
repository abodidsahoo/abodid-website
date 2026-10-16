import type { APIRoute } from 'astro';
import { fetchWebpageContent, computeContentHash } from '../../../../lib/opportunities/scraper';
import { extractOpportunityWithLLM, resolveOpportunityDeadline, parseEventDate } from '../../../../lib/opportunities/extractor';
import { formatOpportunityTitle } from '../../../../lib/opportunities/ui-helpers';
import { authorizeOpportunityRequest, opportunityJson } from '../../../../lib/opportunities/userAuth';
import { PRIVATE_SAVED_SELECT, savedRowToOpportunity, type SavedOpportunityRow } from '../../../../lib/opportunities/saved';
import { consumeOpportunityAiLimit } from '../../../../lib/opportunities/rateLimit';

export const prerender = false;

export const POST: APIRoute = async ({ params, request }) => {
    const authorization = await authorizeOpportunityRequest(request);
    if (!authorization.ok) return authorization.response;

    const id = params.id;
    if (!id) return opportunityJson({ error: 'Opportunity ID is required' }, 400);

    const { data: existing, error: getError } = await authorization.userClient
        .from('saved_opportunities')
        .select(PRIVATE_SAVED_SELECT)
        .eq('id', id)
        .single();

    if (getError || !existing) return opportunityJson({ error: 'Opportunity not found' }, 404);

    const aiLimit = await consumeOpportunityAiLimit(authorization.serviceClient, authorization.user.id);
    if (!aiLimit.allowed) {
        if (aiLimit.unavailable) {
            return opportunityJson({
                error: 'Re-extraction is temporarily unavailable. Please try again in a moment.',
                code: 'CAPTURE_QUOTA_UNAVAILABLE',
            }, 503);
        }

        const retryMinutes = Math.max(1, Math.ceil(aiLimit.retryAfter / 60));
        const response = opportunityJson({
            error: `Extraction limit reached. Try again in ${retryMinutes} minute${retryMinutes === 1 ? '' : 's'}.`,
            retry_after: aiLimit.retryAfter,
        }, 429);
        response.headers.set('Retry-After', String(aiLimit.retryAfter));
        return response;
    }

    const row = existing as unknown as SavedOpportunityRow;
    const current = savedRowToOpportunity(row);

    try {
        const fetched = await fetchWebpageContent(current.canonical_url);
        if (fetched.text.length < 50) {
            return opportunityJson({ error: 'The source page does not contain enough readable content' }, 422);
        }

        const { data: extracted, model } = await extractOpportunityWithLLM(
            fetched.text,
            fetched.title || undefined,
            { sourceUrl: current.source_url, capturedAt: new Date().toISOString() },
        );

        const deadline = resolveOpportunityDeadline(extracted.deadline, extracted.timezone, fetched.text);
        const content = {
            ...(row.content || {}),
            organisation: extracted.organisation || current.organisation,
            category: extracted.category || current.category,
            deadline_raw: deadline.deadline_raw,
            deadline_timezone: deadline.deadline_timezone,
            deadline_confidence: deadline.deadline_confidence,
            event_date: parseEventDate(extracted.event_date, new Date().toISOString(), extracted.timezone),
            location: extracted.location || current.location,
            requirements: Array.isArray(extracted.requirements) ? extracted.requirements : current.requirements,
            next_action: extracted.next_action || current.next_action,
            application_url: extracted.application_url || current.application_url,
            meeting_url: extracted.meeting_url || current.meeting_url,
            fee_or_funding: extracted.fee_or_funding || current.fee_or_funding,
            application_fee: extracted.application_fee || current.application_fee,
            summary: extracted.summary || current.summary,
            source_hash: computeContentHash(fetched.text),
            llm_model: model,
            llm_extraction_count: current.llm_extraction_count + 1,
            extracted_at: new Date().toISOString(),
        };

        const { data, error } = await authorization.userClient
            .from('saved_opportunities')
            .update({
                title: formatOpportunityTitle(extracted.title || current.title).slice(0, 240),
                deadline_at: deadline.deadline_at,
                content,
            })
            .eq('id', id)
            .select(PRIVATE_SAVED_SELECT)
            .single();

        if (error || !data) return opportunityJson({ error: 'Could not save the refreshed extraction' }, 500);
        return opportunityJson({
            success: true,
            opportunity: savedRowToOpportunity(data as unknown as SavedOpportunityRow),
        });
    } catch (error) {
        console.error('Re-extraction failed', {
            userId: authorization.user.id,
            opportunityId: id,
            error: error instanceof Error ? error.name : 'UnknownError',
        });
        return opportunityJson({ error: 'Re-extraction could not be completed' }, 502);
    }
};
