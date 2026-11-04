import { createSupabaseServiceClient } from '../supabaseServer';
import { contentSchema, questionsSchema, type FeedbackForm } from './schema';
import { INTEREST_SLUG } from './collections';

export function feedbackClient() {
    const client = createSupabaseServiceClient();
    if (!client) throw new Error('Feedback storage is unavailable.');
    return client;
}

export async function getFeedbackForm(slug: string): Promise<FeedbackForm | null> {
    const { data, error } = await feedbackClient().from('feedback_forms')
        .select('id,slug,institution_slug,institution_name,event_slug,event_title,event_date,form_version,is_open,responses_public,questions,content')
        .eq('slug', slug).maybeSingle();
    if (error) throw error;
    if (!data) return null;
    let content = data.content;
    let questions = data.questions;
    let version = data.form_version;
    // Review pending copy and resource links locally without changing the live collection.
    // Vite removes this development-only import from production builds.
    if (import.meta.env.DEV) {
        const { default: drafts } = await import('../../data/feedbackContent.pending.json');
        const patch = (drafts as Record<string, unknown>)[slug];
        if (patch && typeof patch === 'object') content = { ...content, ...patch };
        const { default: questionDrafts } = await import('../../data/feedbackQuestions.pending.json');
        const questionPatch = (questionDrafts as Record<string, unknown>)[slug];
        if (questionPatch && JSON.stringify(questionsSchema.parse(questions)) !== JSON.stringify(questionsSchema.parse(questionPatch))) {
            questions = questionPatch;
            version += 1;
        }
    }
    return { ...data, form_version: version, questions: questionsSchema.parse(questions), content: contentSchema.parse(content) };
}

export async function getFeedbackResponses(formId: string, page: number) {
    const pageSize = 48;
    const { data, count, error } = await feedbackClient().from('feedback_responses')
        .select('id,created_at,participant_name,participant_email,answers,question_snapshot', { count: 'exact' })
        .eq('form_id', formId).in('submission_status', ['received', 'reviewed'])
        .order('created_at', { ascending: false }).order('id', { ascending: false })
        .range((page - 1) * pageSize, page * pageSize - 1);
    if (error) throw error;
    return { responses: data || [], total: count || 0, pageSize };
}

// Interest is its own collection, never an update to lecture answers.
export async function getPrivatePhotography(formId: string, responseId: string) {
    const source = await feedbackClient().from('feedback_responses').select('metadata').eq('form_id', formId).eq('id', responseId).maybeSingle();
    if (source.error || !source.data) return { photography_interest: false };
    const participant = source.data.metadata?.participant_id || responseId;
    const form = await getFeedbackForm(INTEREST_SLUG);
    if (!form) return { photography_interest: false };
    const { data, error } = await feedbackClient().from('feedback_responses').select('answers')
        .eq('form_id', form.id).eq('submission_key', participant).maybeSingle();
    if (error) throw error;
    return { photography_interest: data?.answers?.interested === 'Yes, I am interested.' };
}
