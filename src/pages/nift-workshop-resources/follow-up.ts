import type { APIRoute } from 'astro';
import { feedbackClient, getFeedbackForm } from '../../lib/feedback/server';
import { NIFT_SLUG, NIFT_RESOURCES_PATH, RECEIPT_COOKIE, readReceipt, verifyFollowUpToken } from '../../lib/feedback/receipt';
import { isSameOrigin, readFeedbackForm } from '../../lib/feedback/request';
import { FeedbackValidationError, UUID_PATTERN } from '../../lib/feedback/schema';
import { ALBUM_PATH, INTEREST_SLUG } from '../../lib/feedback/collections';
import { identityCookie, loadIdentity } from '../../lib/feedback/identity';

export const prerender = false;
export const POST: APIRoute = async ({ request, cookies, redirect }) => {
    const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });
    if (!isSameOrigin(request)) return json({ error: 'Please use the form on this website.' }, 403);
    const receipt = readReceipt(cookies.get(RECEIPT_COOKIE)?.value, NIFT_SLUG);
    if (!receipt || !UUID_PATTERN.test(receipt.id)) return json({ error: 'Please submit your lecture feedback first, then reopen the resources page.' }, 403);
    try {
        const data = await readFeedbackForm(request);
        if (!verifyFollowUpToken(data.get('follow_up_token'), receipt)) return json({ error: 'Please reload the resources page and try again.' }, 403);
        const kind = data.get('kind');
        if (kind !== 'interest' && kind !== 'album') throw new FeedbackValidationError('Please use the separate interest or album form.');
        const client = feedbackClient();
        const sourceForm = await getFeedbackForm(NIFT_SLUG);
        if (!sourceForm) return json({ error: 'This lecture was not found.' }, 404);
        const { data: source, error } = await client.from('feedback_responses').select('id,metadata')
            .eq('id', receipt.id).eq('form_id', sourceForm.id).in('submission_status', ['received', 'reviewed']).maybeSingle();
        if (error) throw error;
        if (!source) return json({ error: 'Your feedback receipt is no longer available.' }, 404);
        const participant = source.metadata?.participant_id || source.id;
        const identity = await loadIdentity(client, participant);
        if (!identity) return json({ error: 'Your contact details could not be loaded. Please reload and try again.' }, 409);
        let destination = ALBUM_PATH;
        if (kind === 'interest') {
            const raw = data.get('photography_interest');
            if (raw !== null && raw !== 'on') throw new FeedbackValidationError('Please use the interest checkbox.');
            const form = await getFeedbackForm(INTEREST_SLUG);
            if (!form?.is_open) return json({ error: 'The interest form is currently unavailable.' }, 503);
            if (!String(data.get('website') || '').trim()) {
                const { error: saveError } = await client.from('feedback_responses').upsert({
                    form_id: form.id, submission_key: participant, form_version: form.form_version,
                    participant_name: identity.name || null, participant_email: identity.email || null,
                    answers: { interested: raw === 'on' ? 'Yes, I am interested.' : 'Not right now.' },
                    question_snapshot: form.questions, newsletter_consent: false,
                    metadata: { participant_id: participant, source_response_id: source.id, source_path: NIFT_RESOURCES_PATH },
                }, { onConflict: 'form_id,submission_key' });
                if (saveError) throw saveError;
            }
            destination = `${NIFT_RESOURCES_PATH}?interest=saved#photography`;
        }
        const response = request.headers.get('accept')?.includes('application/json')
            ? json({ ok: true, ...(kind === 'album' ? { redirect_to: destination } : {}) }) : redirect(destination, 303);
        response.headers.set('Cache-Control', 'private, no-store');
        response.headers.append('Set-Cookie', identityCookie(participant, request));
        return response;
    } catch (error) {
        if (error instanceof FeedbackValidationError) return json({ error: error.message }, 400);
        console.error('[feedback] Independent photography collection failed:', error && typeof error === 'object' && 'code' in error ? error.code : 'unavailable');
        return json({ error: 'Could not save your interest. Please try again. Your lecture feedback is already saved.' }, 503);
    }
};
