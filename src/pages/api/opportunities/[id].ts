import type { APIRoute } from 'astro';
import { isRequestAuthenticated } from '../../../lib/opportunities/auth';
import { createSupabaseServiceClient } from '../../../lib/supabaseServer';
import { parseDeadline, parseEventDate } from '../../../lib/opportunities/extractor';
import { formatOpportunityTitle } from '../../../lib/opportunities/ui-helpers';

export const prerender = false;

export const PATCH: APIRoute = async ({ params, request, cookies }) => {
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

    try {
        const body = await request.json().catch(() => ({}));
        const supabase = createSupabaseServiceClient();
        if (!supabase) {
            return new Response(JSON.stringify({ error: 'Database service unavailable' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const updates: Record<string, any> = {};

        if (body.title !== undefined) updates.title = formatOpportunityTitle(body.title);
        if (body.organisation !== undefined) updates.organisation = body.organisation;
        if (body.category !== undefined) updates.category = body.category;
        if (body.status !== undefined) updates.status = body.status;
        if (body.outcome !== undefined) updates.outcome = body.outcome;
        if (body.next_action !== undefined) updates.next_action = body.next_action;
        if (body.application_url !== undefined) updates.application_url = body.application_url;
        if (body.meeting_url !== undefined) updates.meeting_url = body.meeting_url;
        if (body.fee_or_funding !== undefined) updates.fee_or_funding = body.fee_or_funding;
        if (body.summary !== undefined) updates.summary = body.summary;
        if (body.location !== undefined) updates.location = body.location;
        if (body.notes !== undefined) updates.notes = body.notes;
        if (body.priority !== undefined) updates.priority = Math.min(3, Math.max(1, Number(body.priority) || 1));

        if (body.requirements !== undefined) {
            updates.requirements = Array.isArray(body.requirements)
                ? body.requirements
                : (typeof body.requirements === 'string'
                    ? body.requirements.split(',').map((s: string) => s.trim()).filter(Boolean)
                    : []);
        }

        if (body.deadline !== undefined || body.deadline_at !== undefined) {
            const parsed = parseDeadline(body.deadline || body.deadline_at, body.timezone || body.deadline_timezone);
            updates.deadline_at = parsed.deadline_at;
            updates.deadline_raw = parsed.deadline_raw;
            updates.deadline_timezone = parsed.deadline_timezone;
            updates.deadline_confidence = parsed.deadline_confidence;
        }

        if (body.event_date !== undefined) {
            updates.event_date = parseEventDate(body.event_date);
        }

        const { data: updated, error } = await supabase
            .from('opportunities')
            .update(updates)
            .eq('id', id)
            .select('*')
            .single();

        if (error || !updated) {
            return new Response(JSON.stringify({ error: error?.message || 'Failed to update opportunity' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // Determine event type for analytics
        let eventType = 'manually_edited';
        if (body.status) {
            switch (body.status) {
                case 'interested': eventType = 'marked_interested'; break;
                case 'preparing': eventType = 'started_preparing'; break;
                case 'submitted': eventType = 'submitted'; break;
                case 'registered': eventType = 'registered'; break;
                case 'attending': eventType = 'attending'; break;
                case 'dismissed': eventType = 'dismissed'; break;
                default: eventType = 'status_changed'; break;
            }
        }

        await supabase.from('opportunity_events').insert({
            opportunity_id: id,
            event_type: eventType,
            metadata: { updates },
        });

        return new Response(JSON.stringify({ success: true, opportunity: updated }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });

    } catch (err: any) {
        return new Response(JSON.stringify({ error: err?.message || 'Failed to update opportunity' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
};

export const DELETE: APIRoute = async ({ params, request, cookies }) => {
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

    const { error } = await supabase
        .from('opportunities')
        .delete()
        .eq('id', id);

    if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    return new Response(JSON.stringify({ success: true, message: 'Opportunity deleted' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
    });
};
