import type { APIRoute } from 'astro';
import { isRequestAuthenticated } from '../../../../lib/opportunities/auth';
import { createSupabaseServiceClient } from '../../../../lib/supabaseServer';
import { fetchWebpageContent, computeContentHash } from '../../../../lib/opportunities/scraper';
import { extractOpportunityWithLLM, parseDeadline, parseEventDate } from '../../../../lib/opportunities/extractor';
import { formatOpportunityTitle } from '../../../../lib/opportunities/ui-helpers';
import type { Opportunity } from '../../../../lib/opportunities/types';

export const prerender = false;

export const POST: APIRoute = async ({ params, request, cookies }) => {
    if (!isRequestAuthenticated(request, cookies)) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    const { id } = params;
    if (!id) {
        return new Response(JSON.stringify({ error: 'Opportunity ID is required' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    const supabase = createSupabaseServiceClient();
    if (!supabase) {
        return new Response(JSON.stringify({ error: 'Database service unavailable' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    // 1. Fetch existing record
    const { data: existing, error: getError } = await supabase
        .from('opportunities')
        .select('*')
        .eq('id', id)
        .single();

    if (getError || !existing) {
        return new Response(JSON.stringify({ error: 'Opportunity not found' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    try {
        // 2. Re-fetch webpage
        const fetched = await fetchWebpageContent(existing.canonical_url);
        if (!fetched.text || fetched.text.length < 50) {
            return new Response(JSON.stringify({ error: 'Page content is too short or inaccessible to re-extract' }), {
                status: 422,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const sourceHash = computeContentHash(fetched.text);

        // 3. Make ONE explicit OpenRouter extraction call
        const { data: llmData, model: usedModel } = await extractOpportunityWithLLM(fetched.text, existing.title);

        const parsedDeadline = parseDeadline(llmData.deadline, llmData.timezone);
        const parsedEventDate = parseEventDate(llmData.event_date, new Date().toISOString(), llmData.timezone);

        const currentCount = existing.llm_extraction_count || 1;

        const updates = {
            title: formatOpportunityTitle(llmData.title || existing.title),
            organisation: llmData.organisation || existing.organisation,
            category: llmData.category || existing.category,
            deadline_at: parsedDeadline.deadline_at,
            deadline_raw: parsedDeadline.deadline_raw,
            deadline_timezone: parsedDeadline.deadline_timezone,
            deadline_confidence: parsedDeadline.deadline_confidence,
            event_date: parsedEventDate,
            location: llmData.location || existing.location,
            requirements: Array.isArray(llmData.requirements) ? llmData.requirements : existing.requirements,
            next_action: llmData.next_action || existing.next_action,
            application_url: llmData.application_url || existing.application_url,
            meeting_url: llmData.meeting_url || existing.meeting_url,
            fee_or_funding: llmData.fee_or_funding || existing.fee_or_funding,
            summary: llmData.summary || existing.summary,
            source_hash: sourceHash,
            llm_model: usedModel,
            llm_extraction_count: currentCount + 1,
            extracted_at: new Date().toISOString(),
        };

        const { data: updated, error: updateError } = await supabase
            .from('opportunities')
            .update(updates)
            .eq('id', id)
            .select('*')
            .single();

        if (updateError || !updated) {
            throw new Error(`Failed to update database after re-extraction: ${updateError?.message || 'DB Error'}`);
        }

        // 4. Log re_extracted event
        await supabase.from('opportunity_events').insert({
            opportunity_id: id,
            event_type: 're_extracted',
            metadata: {
                model: usedModel,
                extraction_count: currentCount + 1,
            },
        });

        return new Response(JSON.stringify({
            success: true,
            message: `Opportunity re-extracted successfully with ${usedModel} (Extraction #${currentCount + 1}).`,
            opportunity: updated as Opportunity,
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });

    } catch (err: any) {
        return new Response(JSON.stringify({ error: err?.message || 'Re-extraction failed' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
};
