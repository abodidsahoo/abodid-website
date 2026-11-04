import type { APIRoute } from 'astro';
import { randomUUID } from 'node:crypto';
import { feedbackClient, getFeedbackForm } from '../../../lib/feedback/server';
import { FeedbackValidationError, formPath, UUID_PATTERN, validateAnswers } from '../../../lib/feedback/schema';
import { isSameOrigin, normalizeEmail, readFeedbackForm } from '../../../lib/feedback/request';
import { sendResourceEmail } from '../../../lib/feedback/resource-email';
import { ALBUM_SLUG, ALBUM_PATH, PRIVATE_COLLECTIONS } from '../../../lib/feedback/collections';
import { requestIdentity, identityCookie, updateIdentity } from '../../../lib/feedback/identity';
import { NIFT_SLUG, NIFT_RESOURCES_PATH, createReceipt, receiptCookie } from '../../../lib/feedback/receipt';

export const prerender = false;

export const POST: APIRoute = async ({ request, params, redirect }) => {
    const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
    if (!isSameOrigin(request)) {
        return json({ error: 'Please submit feedback from this website.' }, 403);
    }

    try {
        const form = await getFeedbackForm(params.slug || '');
        if (!form) return json({ error: 'This feedback form was not found.' }, 404);
        const data = await readFeedbackForm(request);
        const success = (payload: { resource_email_status?: string; [key: string]: unknown }) => request.headers.get('accept')?.includes('application/json')
            ? json({ ok: true, ...payload })
            : redirect(`${formPath(form.slug)}?submitted=1${payload.resource_email_status && payload.resource_email_status !== 'not_requested' ? `&resource_email=${payload.resource_email_status}` : ''}`, 303);
        if (String(data.get('website') || '').trim()) return success({});

        const rawKey = data.get('submission_key');
        const submissionKey = typeof rawKey === 'string' && UUID_PATTERN.test(rawKey) ? rawKey : randomUUID();
        const client = feedbackClient();
        const complete = async (row: any, newsletterStatus = 'not_requested') => {
            const emailResult = row.metadata?.resource_email_requested && row.participant_email
                ? await sendResourceEmail({ client, form, request, requestKey: row.submission_key,
                    email: row.participant_email, responseId: row.id, name: row.participant_name || '' })
                : { status: 'not_requested' };
            // Never expose stored contact details, answers, or metadata in a replay response.
            const payload = { id: row.id, created_at: row.created_at, newsletter_status: newsletterStatus, resource_email_status: emailResult.status };
            const tracked = form.slug === NIFT_SLUG || PRIVATE_COLLECTIONS.includes(form.slug);
            const participant = row.metadata?.participant_id || row.id;
            if (tracked && participant !== row.id) {
                // A failed contact update must not turn a saved response into a failed submission.
                try { await updateIdentity(client, participant, row.participant_name || '', row.participant_email || '', row.created_at); }
                catch { console.error('[feedback] Shared contact details could not be refreshed.'); }
            }
            if (form.slug === ALBUM_SLUG) {
                const destination = `${ALBUM_PATH}?submitted=1`;
                const response = request.headers.get('accept')?.includes('application/json')
                    ? json({ ok: true, ...payload, redirect_to: destination }) : redirect(destination, 303);
                response.headers.append('Set-Cookie', identityCookie(participant, request));
                return response;
            }
            if (form.slug !== NIFT_SLUG) {
                const response = success(payload);
                if (tracked) response.headers.append('Set-Cookie', identityCookie(participant, request));
                return response;
            }
            const resourcesUrl = `${NIFT_RESOURCES_PATH}?resource_email=${emailResult.status}`;
            const response = request.headers.get('accept')?.includes('application/json')
                ? json({ ok: true, ...payload, redirect_to: resourcesUrl }) : redirect(resourcesUrl, 303);
            response.headers.append('Set-Cookie', receiptCookie(createReceipt(form.slug, row.id), request));
            response.headers.append('Set-Cookie', identityCookie(participant, request));
            return response;
        };
        const receiptColumns = 'id,created_at,submission_key,participant_name,participant_email,metadata';
        // Replays succeed even if questions changed or the event closed after the original save.
        const { data: existing, error: replayError } = await client.from('feedback_responses')
            .select(receiptColumns).eq('form_id', form.id).eq('submission_key', submissionKey).maybeSingle();
        if (replayError) throw replayError;
        if (existing) return await complete(existing);
        if (!form.is_open) return json({ error: 'This feedback form is now closed.' }, 410);
        const version = data.get('form_version');
        if (version !== null && Number(version) !== form.form_version) {
            return json({ error: 'These questions have changed. Please copy your feedback and reload the page.' }, 409);
        }
        const answers = validateAnswers(form.questions, data);
        const tracked = form.slug === NIFT_SLUG || PRIVATE_COLLECTIONS.includes(form.slug);
        const identity = tracked ? await requestIdentity(client, request) : null;
        const name = String(data.get('name') || '').trim();
        const email = normalizeEmail(data.get('email'));
        const responseId = randomUUID();
        if (name.length > 180 || email.length > 254) throw new FeedbackValidationError('Please shorten your name or email.');
        const newsletterConsent = Boolean(email && data.get('newsletter_consent') === 'on');
        const { data: saved, error } = await client.from('feedback_responses').insert({
            id: responseId, form_id: form.id, submission_key: submissionKey, form_version: form.form_version,
            participant_name: name || null, participant_email: email || null,
            newsletter_consent: newsletterConsent, answers, question_snapshot: form.questions,
            metadata: { source_path: formPath(form.slug), ...(tracked ? { participant_id: identity?.id || responseId } : {}), ...(form.content.resourceEmailEnabled && email ? { resource_email_requested: true } : {}) },
        }).select(receiptColumns).single();
        if (error?.code === '23505') {
            const { data: replay, error: concurrentError } = await client.from('feedback_responses')
                .select(receiptColumns).eq('form_id', form.id).eq('submission_key', submissionKey).single();
            if (concurrentError) throw concurrentError;
            return await complete(replay);
        }
        if (error) throw error;

        let newsletterStatus = 'not_requested';
        if (newsletterConsent) {
            const { error: subscriberError } = await client.from('subscribers').upsert({
                email, ...(name ? { name } : {}), source: form.slug, status: 'active',
            }, { onConflict: 'email' });
            newsletterStatus = subscriberError ? 'failed' : 'subscribed';
            if (subscriberError) console.error('Feedback newsletter subscription failed:', subscriberError.code);
        }
        return await complete(saved, newsletterStatus);
    } catch (error) {
        if (error instanceof FeedbackValidationError) return json({ error: error.message }, 400);
        console.error('Feedback submission failed:', error && typeof error === 'object' && 'code' in error ? error.code : 'unavailable');
        return json({ error: 'Could not save your feedback right now. Please try again.' }, 503);
    }
};
