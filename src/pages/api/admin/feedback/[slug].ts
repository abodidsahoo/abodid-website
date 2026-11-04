import type { APIRoute } from 'astro';
import { authorizeAdminRequest, jsonResponse } from '../../../../lib/admin/serverAuth';
import { ADMIN_FEEDBACK_COLLECTIONS } from '../../../../lib/feedback/collections';
import { UUID_PATTERN } from '../../../../lib/feedback/schema';

export const prerender = false;
export const GET: APIRoute = async ({ request, params }) => {
    const authorization = await authorizeAdminRequest(request);
    if (!authorization.ok) return authorization.response;
    if (!ADMIN_FEEDBACK_COLLECTIONS.includes(params.slug || '')) return jsonResponse({ error: 'Collection not found.' }, 404);
    const page = Number(new URL(request.url).searchParams.get('page') || 1);
    const limit = Math.min(200, Math.max(1, Number(new URL(request.url).searchParams.get('limit') || 50)));
    if (!Number.isSafeInteger(page) || page < 1 || page > 100000) return jsonResponse({ error: 'Invalid page.' }, 400);
    if (!Number.isSafeInteger(limit)) return jsonResponse({ error: 'Invalid limit.' }, 400);
    const client = authorization.supabase;
    try {
        const { data: form, error: formError } = await client.from('feedback_forms').select('id,event_title,institution_name,questions,event_date').eq('slug', params.slug!).single();
        if (formError) throw formError;
        const { data, count, error } = await client.from('feedback_responses').select('id,created_at,participant_name,participant_email,answers,metadata,question_snapshot', { count: 'exact' })
            .eq('form_id', form.id).in('submission_status', ['received', 'reviewed']).order('created_at', { ascending: false }).order('id', { ascending: false }).range((page - 1) * limit, page * limit - 1);
        if (error) throw error;
        const ids = [...new Set((data || []).map((row) => row.metadata?.participant_id).filter((id) => typeof id === 'string' && UUID_PATTERN.test(id)))];
        const anchors = ids.length ? await client.from('feedback_responses').select('id,participant_name,participant_email,metadata').in('id', ids) : { data: [], error: null };
        if (anchors.error) throw anchors.error;
        const identities = new Map((anchors.data || []).map((row) => [row.id, row]));
        return jsonResponse({
            title: form.event_title,
            institution: form.institution_name,
            questions: form.questions || [],
            total: count || 0,
            page,
            pageSize: limit,
            rows: (data || []).map((row) => {
                const person = identities.get(row.metadata?.participant_id);
                return {
                    id: row.id,
                    participant_id: row.metadata?.participant_id || row.id,
                    created_at: row.created_at,
                    name: person?.metadata?.private_identity?.name ?? person?.participant_name ?? row.metadata?.private_identity?.name ?? row.participant_name ?? '',
                    email: person?.metadata?.private_identity?.email ?? person?.participant_email ?? row.metadata?.private_identity?.email ?? row.participant_email ?? '',
                    answers: row.answers || {},
                    response: Object.values(row.answers || {}).filter(Boolean).join('\n'),
                    question_snapshot: row.question_snapshot || form.questions || [],
                };
            }),
        });
    } catch {
        return jsonResponse({ error: 'Could not load private responses. Please try again.' }, 503);
    }
};
