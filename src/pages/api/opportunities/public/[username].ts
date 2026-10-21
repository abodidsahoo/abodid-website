import type { APIRoute } from 'astro';
import { createSupabaseServiceClient } from '../../../../lib/supabaseServer';
import { opportunityJson } from '../../../../lib/opportunities/userAuth';
import { savedRowToOpportunity, type SavedOpportunityRow } from '../../../../lib/opportunities/saved';
import { isValidOpportunityUsername } from '../../../../lib/opportunities/username';

export const prerender = false;

const PUBLIC_SELECT = 'id, user_id, title, source_url, canonical_url, deadline_at, content, created_at, updated_at';

export const GET: APIRoute = async ({ params }) => {
    const username = String(params.username || '').trim().toLowerCase();
    if (!isValidOpportunityUsername(username)) return opportunityJson({ error: 'Collection not found' }, 404);

    const serviceClient = createSupabaseServiceClient();
    if (!serviceClient) return opportunityJson({ error: 'Database service unavailable' }, 500);

    const { data: profile, error: profileError } = await serviceClient
        .from('profiles')
        .select('id, username, full_name, avatar_url, is_public')
        .eq('username', username)
        .single();

    if (profileError || !profile?.is_public) {
        return opportunityJson({ error: 'This collection is private or does not exist' }, 404);
    }

    const { data, error } = await serviceClient
        .from('saved_opportunities')
        .select(PUBLIC_SELECT)
        .eq('user_id', profile.id)
        .eq('status', 'reviewing')
        .not('source_url', 'like', 'https://direct.entry/%')
        .order('created_at', { ascending: false });

    if (error) return opportunityJson({ error: 'Could not load this collection' }, 500);

    const opportunities = ((data || []) as unknown as Array<Partial<SavedOpportunityRow> & Pick<SavedOpportunityRow, 'id' | 'title' | 'source_url' | 'canonical_url' | 'created_at' | 'updated_at'>>)
        .map((row) => savedRowToOpportunity({
            ...row,
            user_id: profile.id,
            deadline_at: row.deadline_at || null,
            status: 'reviewing',
            is_high_priority: false,
            outcome: null,
            notes: null,
            content: {
                organisation: row.content?.organisation,
                category: row.content?.category,
                deadline_raw: row.content?.deadline_raw,
                deadline_timezone: row.content?.deadline_timezone,
                deadline_confidence: row.content?.deadline_confidence,
                event_date: row.content?.event_date,
                location: row.content?.location,
                requirements: row.content?.requirements,
                application_url: row.content?.application_url,
                fee_or_funding: row.content?.fee_or_funding,
                application_fee: row.content?.application_fee,
                summary: row.content?.summary,
                extracted_at: row.content?.extracted_at,
                // Expose extraction provenance without leaking provider/model details.
                llm_model: row.content?.llm_model ? 'ai-extracted' : null,
            },
        } as SavedOpportunityRow));

    const response = opportunityJson({
        opportunities,
        authenticated: false,
        owner: false,
        profile: {
            username: profile.username,
            display_name: profile.full_name || profile.username,
            avatar_url: profile.avatar_url || null,
            is_public: true,
        },
    });
    // Privacy changes must take effect immediately; do not leave a formerly
    // public collection in an intermediary cache.
    response.headers.set('Cache-Control', 'no-store, max-age=0');
    response.headers.delete('Vary');
    return response;
};
