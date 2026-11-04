import type { APIRoute } from 'astro';
import { feedbackClient, getFeedbackForm } from '../../lib/feedback/server';
import { requestReceipt, verifyFollowUpToken, NIFT_SLUG, NIFT_RESOURCES_PATH } from '../../lib/feedback/receipt';
import { isSameOrigin, normalizeEmail, readFeedbackForm } from '../../lib/feedback/request';
import { FeedbackValidationError, UUID_PATTERN } from '../../lib/feedback/schema';
import { loadIdentity, updateIdentity, identityCookie } from '../../lib/feedback/identity';
import { sendResourceEmail } from '../../lib/feedback/resource-email';
export const prerender = false;
export const POST: APIRoute = async ({ request, redirect }) => {
    const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });
    const access = requestReceipt(request);
    if (!isSameOrigin(request) || !access) return json({ error: 'Please submit your feedback first.' }, 403);
    try {
        const data = await readFeedbackForm(request);
        if (!verifyFollowUpToken(data.get('follow_up_token'), access.receipt)) return json({ error: 'Please refresh the page and try again.' }, 403);
        const key = data.get('submission_key');
        if (typeof key !== 'string' || !UUID_PATTERN.test(key)) throw new FeedbackValidationError('Please refresh the page and try again.');
        const email = normalizeEmail(data.get('email'), true);
        const client = feedbackClient(); const form = await getFeedbackForm(NIFT_SLUG);
        if (!form) return json({ error: 'Lecture resources are unavailable.' }, 404);
        const { data: source, error } = await client.from('feedback_responses').select('id,metadata,participant_name,participant_email')
            .eq('id', access.receipt.id).eq('form_id', form.id).maybeSingle();
        if (error) throw error;
        if (!source) return json({ error: 'Your feedback receipt could not be found.' }, 404);
        const participantId = source.metadata?.participant_id || source.id;
        const person = await loadIdentity(client, participantId);
        const result = await sendResourceEmail({ client, form: { ...form, content: { ...form.content, resourceEmailEnabled: true } }, request,
            requestKey: key, email, name: person?.name || source.participant_name || '', responseId: source.id });
        if (result.status === 'failed') return json({ error: result.retryAfter ? 'Please wait before requesting another email.' : 'The email could not be sent. Please try again.' }, result.retryAfter ? 429 : 503);

        if (typeof updateIdentity === 'function') {
            try {
                await updateIdentity(client, participantId, person?.name || source.participant_name || '', email, new Date().toISOString());
            } catch {
                console.error('[feedback] Could not update participant identity with download email.');
            }
        }

        const response = request.headers.get('accept')?.includes('application/json')
            ? json({ ok: true, status: result.status })
            : redirect(`${NIFT_RESOURCES_PATH}?resource_email=${result.status}#email-downloads`, 303);
        if (typeof identityCookie === 'function') {
            try {
                response.headers.append('Set-Cookie', identityCookie(participantId, request));
            } catch { /* optional cookie */ }
        }
        return response;
    } catch (error) {
        return json({ error: error instanceof FeedbackValidationError ? error.message : 'The email could not be sent. Please try again.' }, error instanceof FeedbackValidationError ? 400 : 503);
    }
};
