import type { APIRoute } from 'astro';
import {
    isRequestAuthenticated,
    verifyPassword,
    createSessionToken,
    setAuthCookie,
    checkRateLimit,
} from '../../../lib/opportunities/auth';
import { canonicalizeUrl, computeContentHash, fetchWebpageContent, cleanHtmlToText } from '../../../lib/opportunities/scraper';
import { extractOpportunityWithLLM, parseDeadline, parseEventDate } from '../../../lib/opportunities/extractor';
import { formatOpportunityTitle } from '../../../lib/opportunities/ui-helpers';
import { createSupabaseServiceClient } from '../../../lib/supabaseServer';
import type { Opportunity } from '../../../lib/opportunities/types';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, clientAddress }) => {
    try {
        const body = await request.json().catch(() => ({}));
        const { url, title: providedTitle, page_text: providedText, password } = body;

        // 1. Authenticate request (via cookie, bearer, or password in body)
        let isAuthenticated = isRequestAuthenticated(request, cookies);
        if (!isAuthenticated && password) {
            if (verifyPassword(password)) {
                isAuthenticated = true;
                const token = createSessionToken();
                setAuthCookie(cookies, token);
            }
        }

        if (!isAuthenticated) {
            return new Response(JSON.stringify({ error: 'Unauthorized: Valid password or session required' }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // 2. Rate limiting check
        const clientIp = clientAddress || request.headers.get('x-forwarded-for') || 'unknown';
        const rateCheck = checkRateLimit(clientIp, 25, 60 * 1000);
        if (!rateCheck.allowed) {
            return new Response(JSON.stringify({ error: 'Rate limit exceeded. Please wait a moment before capturing again.' }), {
                status: 429,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // 3. Validate & canonicalize URL
        if (!url || typeof url !== 'string') {
            return new Response(JSON.stringify({ error: 'A valid URL is required' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        let canonicalUrl: string;
        try {
            canonicalUrl = canonicalizeUrl(url);
        } catch (err: any) {
            return new Response(JSON.stringify({ error: `Invalid URL format: ${err?.message || 'Check URL'}` }), {
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

        // 4. Check for existing record (Deduplication - ZERO AI CALLS if exists)
        const { data: existing, error: findError } = await supabase
            .from('opportunities')
            .select('*')
            .eq('canonical_url', canonicalUrl)
            .maybeSingle();

        if (findError) {
            console.error('Error querying opportunities table:', findError);
        }

        if (existing) {
            return new Response(JSON.stringify({
                success: true,
                is_duplicate: true,
                message: 'Opportunity already saved. Loaded existing record without calling AI.',
                opportunity: existing,
            }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // 5. Ingest and clean page content
        let cleanText = '';
        let pageTitle = providedTitle || '';

        if (providedText && typeof providedText === 'string' && providedText.trim().length > 100) {
            // Direct text provided from Chrome Extension
            cleanText = providedText.trim().slice(0, 12000);
        } else {
            // Server-side fetch & clean
            try {
                const fetched = await fetchWebpageContent(canonicalUrl);
                cleanText = fetched.text;
            } catch (fetchErr: any) {
                return new Response(JSON.stringify({
                    error: `Could not fetch opportunity webpage: ${fetchErr?.message || 'Fetch failed'}. You can still create it manually.`,
                    can_manual_create: true,
                    canonical_url: canonicalUrl,
                }), {
                    status: 422,
                    headers: { 'Content-Type': 'application/json' },
                });
            }
        }

        if (!cleanText || cleanText.length < 50) {
            return new Response(JSON.stringify({
                error: 'The webpage did not contain enough readable content to extract. You can create it manually.',
                can_manual_create: true,
                canonical_url: canonicalUrl,
            }), {
                status: 422,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // 6. Make ONE OpenRouter LLM extraction call
        const sourceHash = computeContentHash(cleanText);
        let extractedResult;
        try {
            extractedResult = await extractOpportunityWithLLM(cleanText, pageTitle);
        } catch (llmErr: any) {
            return new Response(JSON.stringify({
                error: `AI extraction failed: ${llmErr?.message || 'LLM error'}. You can create the opportunity manually.`,
                can_manual_create: true,
                canonical_url: canonicalUrl,
            }), {
                status: 502,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const { data: llmData, model: usedModel } = extractedResult;

        // 7. Parse deadlines and dates deterministically
        const parsedDeadline = parseDeadline(llmData.deadline, llmData.timezone);
        const parsedEventDate = parseEventDate(llmData.event_date);

        // 8. Insert record into Supabase
        const rawExtractedTitle = llmData.title || pageTitle || 'Untitled Opportunity';
        const newRecord = {
            title: formatOpportunityTitle(rawExtractedTitle),
            organisation: llmData.organisation || 'Unknown Organisation',
            category: llmData.category || 'other',
            source_url: url.trim(),
            canonical_url: canonicalUrl,
            deadline_at: parsedDeadline.deadline_at,
            deadline_raw: parsedDeadline.deadline_raw,
            deadline_timezone: parsedDeadline.deadline_timezone,
            deadline_confidence: parsedDeadline.deadline_confidence,
            event_date: parsedEventDate,
            location: llmData.location || null,
            requirements: Array.isArray(llmData.requirements) ? llmData.requirements : [],
            next_action: llmData.next_action || null,
            application_url: llmData.application_url || null,
            meeting_url: llmData.meeting_url || null,
            fee_or_funding: llmData.fee_or_funding || null,
            summary: llmData.summary || null,
            status: 'inbox',
            priority: 1,
            outcome: null,
            source_hash: sourceHash,
            llm_model: usedModel,
            llm_extraction_count: 1,
            notes: null,
        };

        const { data: inserted, error: insertError } = await supabase
            .from('opportunities')
            .insert(newRecord)
            .select('*')
            .single();

        if (insertError || !inserted) {
            throw new Error(`Failed to save extracted opportunity to database: ${insertError?.message || 'Database error'}`);
        }

        // 9. Log lightweight event
        await supabase.from('opportunity_events').insert({
            opportunity_id: inserted.id,
            event_type: 'opportunity_saved',
            metadata: {
                model: usedModel,
                canonical_url: canonicalUrl,
                category: inserted.category,
            },
        });

        return new Response(JSON.stringify({
            success: true,
            is_duplicate: false,
            message: 'Opportunity extracted and saved successfully.',
            opportunity: inserted as Opportunity,
        }), {
            status: 201,
            headers: { 'Content-Type': 'application/json' },
        });

    } catch (err: any) {
        console.error('Capture endpoint unexpected error:', err);
        return new Response(JSON.stringify({ error: err?.message || 'Internal server error during capture' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
};
