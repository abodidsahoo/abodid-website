import { Resend } from 'resend';
import { supabase } from '../../lib/supabaseClient';
import {
    isUuid,
    normalizedAcquisitionSource,
    readableLocation,
    summarizeVisit,
} from '../../lib/contact-notification.js';
import { renderSubscriberNotification } from '../../lib/subscriber-notification.js';
import { createSupabaseServiceClient } from '../../lib/supabaseServer';

export const prerender = false;

const resendKey = import.meta.env.RESEND_API_KEY ?? process.env.RESEND_API_KEY;
const resend = new Resend(resendKey);
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const FOOTER_SPAM_MIN_SUBMISSION_MS = 1500;
const OWNER_NOTIFICATION_EMAIL =
    import.meta.env.OWNER_NOTIFICATION_EMAIL ||
    process.env.OWNER_NOTIFICATION_EMAIL ||
    import.meta.env.CONTACT_FORM_TO_EMAIL ||
    process.env.CONTACT_FORM_TO_EMAIL ||
    'hello@abodid.com';

const clean = (value, maxLength = 5000) => (
    typeof value === 'string'
        ? value.trim().replace(/[\u0000-\u001f\u007f]/g, '').slice(0, maxLength)
        : ''
);

const escapeHtml = (value) => clean(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const parseTracking = (formData) => {
    const raw = formData.get('tracking');
    if (typeof raw !== 'string' || !raw.trim()) return { sessionId: '' };
    try {
        const parsed = JSON.parse(raw);
        return { sessionId: clean(parsed?.sessionId, 40) };
    } catch (_error) {
        return { sessionId: '' };
    }
};

const shouldSilentlyBlockFooterSubmission = ({ request, data, source, tracking }) => {
    if (source !== 'footer-newsletter') return null;
    if (clean(data.get('company'), 200)) return 'honeypot_filled';
    if (clean(data.get('jsEnabled'), 10) !== '1') return 'missing_js_signal';

    const formStartedAt = Number(data.get('formStartedAt'));
    if (!Number.isFinite(formStartedAt) || Date.now() - formStartedAt < FOOTER_SPAM_MIN_SUBMISSION_MS) {
        return 'submitted_too_quickly';
    }

    if (!tracking.sessionId && !request.headers.get('referer')) return 'missing_journey_signals';
    return null;
};

const buildWelcomeEmail = ({ name, existing }) => {
    const greeting = name ? `Hi ${escapeHtml(name)},` : 'Hi,';
    const heading = existing ? 'Welcome back to the circle.' : 'Welcome to the tribe.';
    const copy = existing
        ? 'Your newsletter details are up to date. You will continue receiving the weekly collection of useful creative resources and field notes.'
        : 'Thank you for subscribing. You will receive a weekly collection of useful creative resources, references, workflows, and field notes.';

    return {
        subject: heading,
        html: `<!doctype html><html><body style="margin:0;background:#f5f4f0;color:#202124;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:28px 14px">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#fff;border:1px solid #e5e1d7;border-radius:14px;padding:38px 30px"><tr><td>
<p style="margin:0 0 12px;font-size:15px">${greeting}</p>
<h1 style="margin:0 0 14px;font-size:28px;line-height:1.2">${heading}</h1>
<p style="margin:0 0 24px;color:#4d4b47;font-size:15px;line-height:1.65">${copy}</p>
<a href="https://abodid.com/resources" style="display:inline-block;background:#111;color:#fff;border-radius:8px;padding:12px 18px;font-size:14px;font-weight:650;text-decoration:none">Explore Resources Hub</a>
</td></tr></table></td></tr></table></body></html>`,
        text: `${name ? `Hi ${name},` : 'Hi,'}\n\n${heading}\n\n${copy}\n\nExplore Resources Hub: https://abodid.com/resources`,
    };
};

async function sendOwnerNotification({ email, name, source, status, sessionId, submittedAt, request }) {
    let session = null;
    let pageViews = [];
    let newsletterSubmissionId = '';
    const serviceClient = createSupabaseServiceClient();

    if (serviceClient && isUuid(sessionId)) {
        const { data: sessionRow } = await serviceClient
            .from('analytics_sessions')
            .select('id, source, city, country, landing_page, started_at')
            .eq('id', sessionId)
            .single();
        session = sessionRow || null;

        if (session) {
            const { data: views } = await serviceClient
                .from('analytics_page_views')
                .select('page_path, page_title, viewed_at, engaged_seconds')
                .eq('session_id', session.id)
                .lte('viewed_at', submittedAt)
                .order('viewed_at', { ascending: true });
            pageViews = views || [];
        }
    }

    if (serviceClient) {
        const { data: submission, error } = await serviceClient
            .from('newsletter_submissions')
            .insert({
                session_id: session?.id || null,
                email,
                name: name || null,
                source,
                subscriber_status: status,
                submitted_at: submittedAt,
            })
            .select('id')
            .single();
        if (error) console.warn('[subscribe] Could not save notification context:', error.message);
        newsletterSubmissionId = submission?.id || '';
    }

    const visit = session ? summarizeVisit({ session, pageViews, submittedAt }) : null;
    const acquisitionSource = session ? normalizedAcquisitionSource(session.source) : '';
    const location = session ? readableLocation(session) : '';
    const siteOrigin = (import.meta.env.PUBLIC_SITE_URL || process.env.PUBLIC_SITE_URL || new URL(request.url).origin).replace(/\/$/, '');
    const analyticsUrl = newsletterSubmissionId
        ? `${siteOrigin}/admin/dashboard?section=analytics&newsletterSubmission=${encodeURIComponent(newsletterSubmissionId)}`
        : '';
    const rendered = renderSubscriberNotification({
        email,
        name,
        status,
        source,
        acquisitionSource,
        location,
        visit,
        analyticsUrl,
    });

    const { error } = await resend.emails.send({
        from:
            import.meta.env.SUBSCRIBE_ALERT_FROM_EMAIL ||
            process.env.SUBSCRIBE_ALERT_FROM_EMAIL ||
            import.meta.env.CONTACT_NOTIFICATION_FROM_EMAIL ||
            process.env.CONTACT_NOTIFICATION_FROM_EMAIL ||
            'Website Contact <contact@abodid.com>',
        to: [
            import.meta.env.SUBSCRIBE_ALERT_TO_EMAIL ||
            process.env.SUBSCRIBE_ALERT_TO_EMAIL ||
            OWNER_NOTIFICATION_EMAIL,
        ],
        replyTo: email,
        ...rendered,
    });
    if (error) throw error;
}

async function sendWelcomeEmail({ email, name, existing }) {
    const content = buildWelcomeEmail({ name, existing });
    const { error } = await resend.emails.send({
        from: 'Abodid Sahoo <newsletter@abodid.com>',
        to: email,
        replyTo: OWNER_NOTIFICATION_EMAIL,
        ...content,
    });
    if (error) throw error;
}

export const POST = async ({ request }) => {
    const data = await request.formData();
    const email = clean(data.get('email'), 254).toLowerCase();
    const name = clean(data.get('name'), 120) || null;
    const source = clean(data.get('source'), 40).toLowerCase() || 'newsletter-popup';
    const tracking = parseTracking(data);

    if (!email || !EMAIL_REGEX.test(email)) {
        return new Response(JSON.stringify({ message: 'Invalid email address' }), { status: 400 });
    }

    const blockedReason = shouldSilentlyBlockFooterSubmission({ request, data, source, tracking });
    if (blockedReason) {
        console.warn(`[subscribe] Blocked footer newsletter spam candidate: ${blockedReason}`);
        return new Response(JSON.stringify({ message: 'Successfully subscribed!' }), { status: 200 });
    }

    const submittedAt = new Date().toISOString();
    const { error: insertError } = await supabase.from('subscribers').insert([{ email, name, source }]);
    const existing = insertError?.code === '23505';

    if (insertError && !existing) {
        return new Response(JSON.stringify({ message: insertError.message }), { status: 500 });
    }

    if (existing && name) {
        await supabase.from('subscribers').update({ name }).eq('email', email);
    }

    try {
        await sendOwnerNotification({
            email,
            name,
            source,
            status: existing ? 'existing' : 'new',
            sessionId: tracking.sessionId,
            submittedAt,
            request,
        });
    } catch (error) {
        console.error('[subscribe] Owner notification failed:', error);
    }

    try {
        await sendWelcomeEmail({ email, name, existing });
    } catch (error) {
        console.error('[subscribe] Subscriber welcome email failed:', error);
    }

    return new Response(JSON.stringify({
        message: existing
            ? "You're already on the list! We've updated your details."
            : 'Successfully subscribed!',
        isUpdate: existing,
    }), { status: 200 });
};
