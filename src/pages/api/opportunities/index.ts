import type { APIRoute } from 'astro';
import { isRequestAuthenticated } from '../../../lib/opportunities/auth';
import { createSupabaseServiceClient } from '../../../lib/supabaseServer';
import { canonicalizeUrl } from '../../../lib/opportunities/scraper';
import { parseDeadline, parseEventDate } from '../../../lib/opportunities/extractor';
import { formatOpportunityTitle } from '../../../lib/opportunities/ui-helpers';
import type { Opportunity } from '../../../lib/opportunities/types';

export const prerender = false;

export const GET: APIRoute = async ({ request, cookies }) => {
    const isAuth = isRequestAuthenticated(request, cookies);
    const supabase = createSupabaseServiceClient();
    if (!supabase) {
        return new Response(JSON.stringify({ error: 'Database service unavailable' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    let query = supabase.from('opportunities').select('*');
    if (!isAuth) {
        // Public visitors see all active curated opportunities (excluding dismissed)
        query = query.neq('status', 'dismissed');
    }

    const { data: opportunities, error } = await query;

    if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    const now = Date.now();

    // Deterministic sorting prioritising:
    // 1. Actionable opportunities with nearest valid future deadline
    // 2. Upcoming meetings/events
    // 3. Deadline needs verification / unknown
    // 4. Rolling opportunities
    // 5. Expired items last
    const sorted = ((opportunities || []) as Opportunity[]).sort((a, b) => {
        const getPriority = (opp: Opportunity) => {
            const isDoneOrDismissed = opp.status === 'done' || opp.status === 'dismissed';
            if (isDoneOrDismissed) return 99; // finished items after active

            if (opp.deadline_at) {
                const diff = new Date(opp.deadline_at).getTime() - now;
                if (diff >= 0) return 1; // future deadline (most urgent)
                return 5; // expired deadline
            }

            if (opp.event_date) {
                const diff = new Date(opp.event_date).getTime() - now;
                if (diff >= 0) return 2; // upcoming event/meeting
            }

            if (opp.deadline_confidence === 'needs_verification' || opp.deadline_confidence === 'none') {
                return 3; // unknown / needs verification
            }

            if (opp.deadline_confidence === 'rolling') {
                return 4; // rolling
            }

            return 6;
        };

        const prioA = getPriority(a);
        const prioB = getPriority(b);

        if (prioA !== prioB) {
            return prioA - prioB;
        }

        // Secondary sort: earliest deadline_at first if both have future deadlines
        if (prioA === 1 && a.deadline_at && b.deadline_at) {
            return new Date(a.deadline_at).getTime() - new Date(b.deadline_at).getTime();
        }

        // Otherwise fallback to newest created first
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    return new Response(JSON.stringify({ opportunities: sorted, authenticated: isAuth }), {
        status: 200,
        headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'private, no-store, max-age=0, must-revalidate',
            'Vary': 'Cookie, Authorization',
        },
    });
};

export const POST: APIRoute = async ({ request, cookies }) => {
    if (!isRequestAuthenticated(request, cookies)) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    try {
        const body = await request.json().catch(() => ({}));
        const {
            title,
            organisation,
            category = 'other',
            source_url,
            deadline,
            timezone,
            event_date,
            location,
            requirements = [],
            next_action,
            application_url,
            meeting_url,
            fee_or_funding,
            summary,
            status = 'inbox',
            notes,
        } = body;

        if (!title || !source_url) {
            return new Response(JSON.stringify({ error: 'Title and Source URL are required' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const canonicalUrl = canonicalizeUrl(source_url);
        const parsedDeadline = parseDeadline(deadline, timezone);
        const parsedEventDate = parseEventDate(event_date, undefined, timezone);

        const supabase = createSupabaseServiceClient();
        if (!supabase) {
            return new Response(JSON.stringify({ error: 'Database service unavailable' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const newRecord = {
            title: formatOpportunityTitle(title.trim()),
            organisation: (organisation || 'Independent / Direct').trim(),
            category,
            source_url: source_url.trim(),
            canonical_url: canonicalUrl,
            deadline_at: parsedDeadline.deadline_at,
            deadline_raw: parsedDeadline.deadline_raw,
            deadline_timezone: parsedDeadline.deadline_timezone,
            deadline_confidence: parsedDeadline.deadline_confidence,
            event_date: parsedEventDate,
            location: location || null,
            requirements: Array.isArray(requirements) ? requirements : (typeof requirements === 'string' ? requirements.split(',').map(s => s.trim()).filter(Boolean) : []),
            next_action: next_action || null,
            application_url: application_url || null,
            meeting_url: meeting_url || null,
            fee_or_funding: fee_or_funding || null,
            summary: summary || null,
            status,
            priority: Math.min(3, Math.max(1, Number(body.priority) || 1)),
            outcome: null,
            source_hash: null,
            llm_model: 'manual',
            llm_extraction_count: 0,
            notes: notes || null,
        };

        const { data: inserted, error } = await supabase
            .from('opportunities')
            .upsert(newRecord, { onConflict: 'canonical_url' })
            .select('*')
            .single();

        if (error || !inserted) {
            return new Response(JSON.stringify({ error: error?.message || 'Failed to save opportunity' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        await supabase.from('opportunity_events').insert({
            opportunity_id: inserted.id,
            event_type: 'opportunity_saved',
            metadata: { manual: true },
        });

        return new Response(JSON.stringify({ success: true, opportunity: inserted }), {
            status: 201,
            headers: { 'Content-Type': 'application/json' },
        });

    } catch (err: any) {
        return new Response(JSON.stringify({ error: err?.message || 'Failed to manually create opportunity' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
};
