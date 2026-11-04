import type { APIRoute } from 'astro';
import { authorizeAdminRequest, jsonResponse } from '../../../../lib/admin/serverAuth';
import {
    ALBUM_SLUG,
    DU_WORKSHOP_SLUG,
    INTEREST_SLUG,
    NIFT_WORKSHOP_SLUG,
} from '../../../../lib/feedback/collections';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
    const authorization = await authorizeAdminRequest(request);
    if (!authorization.ok) return authorization.response;
    const client = authorization.supabase;

    try {
        const slugs = [DU_WORKSHOP_SLUG, NIFT_WORKSHOP_SLUG, INTEREST_SLUG, ALBUM_SLUG];
        const { data: forms, error: formsError } = await client.from('feedback_forms')
            .select('id,slug,institution_name,event_title,event_date,questions')
            .in('slug', slugs);

        if (formsError) throw formsError;

        const formsBySlug = new Map((forms || []).map((f) => [f.slug, f]));

        // Fetch counts for all collections in parallel
        const counts = await Promise.all(
            slugs.map(async (slug) => {
                const form = formsBySlug.get(slug);
                if (!form) return { slug, count: 0, latestAt: null };
                const { count, data, error } = await client.from('feedback_responses')
                    .select('created_at', { count: 'exact' })
                    .eq('form_id', form.id)
                    .in('submission_status', ['received', 'reviewed'])
                    .order('created_at', { ascending: false })
                    .limit(1);
                if (error) throw error;
                return {
                    slug,
                    count: count || 0,
                    latestAt: data?.[0]?.created_at || null,
                };
            })
        );

        const statsMap = Object.fromEntries(counts.map((c) => [c.slug, c]));

        return jsonResponse({
            du: {
                slug: DU_WORKSHOP_SLUG,
                title: formsBySlug.get(DU_WORKSHOP_SLUG)?.event_title || 'Ethnographic Filmmaking Workshop',
                institution: formsBySlug.get(DU_WORKSHOP_SLUG)?.institution_name || 'University of Delhi',
                responseCount: statsMap[DU_WORKSHOP_SLUG]?.count || 0,
                latestAt: statsMap[DU_WORKSHOP_SLUG]?.latestAt || null,
            },
            nift: {
                slug: NIFT_WORKSHOP_SLUG,
                title: formsBySlug.get(NIFT_WORKSHOP_SLUG)?.event_title || 'Space & Materiality',
                institution: formsBySlug.get(NIFT_WORKSHOP_SLUG)?.institution_name || 'NIFT Bhubaneswar',
                lectureCount: statsMap[NIFT_WORKSHOP_SLUG]?.count || 0,
                interestCount: statsMap[INTEREST_SLUG]?.count || 0,
                albumCount: statsMap[ALBUM_SLUG]?.count || 0,
                totalCount: (statsMap[NIFT_WORKSHOP_SLUG]?.count || 0) + (statsMap[INTEREST_SLUG]?.count || 0) + (statsMap[ALBUM_SLUG]?.count || 0),
                latestAt: [statsMap[NIFT_WORKSHOP_SLUG]?.latestAt, statsMap[INTEREST_SLUG]?.latestAt, statsMap[ALBUM_SLUG]?.latestAt]
                    .filter(Boolean)
                    .sort()
                    .reverse()[0] || null,
            },
        });
    } catch (err) {
        console.error('[admin/feedback/summary] Failed to fetch summary:', err);
        return jsonResponse({ error: 'Could not load feedback summary.' }, 503);
    }
};

