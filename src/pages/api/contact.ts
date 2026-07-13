import type { APIRoute } from 'astro';
import { Resend } from 'resend';
import {
    cleanContactString,
    formatDuration,
    isUuid,
    normalizedAcquisitionSource,
    readableLocation,
    resolveEnquiryTitle,
    summarizeVisit,
} from '../../lib/contact-notification.js';
import { createSupabaseServiceClient } from '../../lib/supabaseServer';

export const prerender = false;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

const escapeHtml = (value: string) => value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

async function parsePayload(request: Request) {
    const contentType = request.headers.get('content-type') || '';
    let body: Record<string, unknown> = {};

    if (contentType.includes('application/json')) {
        body = await request.json().catch(() => ({}));
    } else if (contentType.includes('form')) {
        const formData = await request.formData();
        body = Object.fromEntries(formData.entries());
        if (typeof body.tracking === 'string') {
            try { body.tracking = JSON.parse(body.tracking); } catch (_error) { body.tracking = {}; }
        }
    }

    const tracking = body.tracking && typeof body.tracking === 'object'
        ? body.tracking as Record<string, unknown>
        : {};
    return {
        name: cleanContactString(body.name, 120),
        email: cleanContactString(body.email, 254).toLowerCase(),
        message: typeof body.message === 'string' ? body.message.trim().slice(0, 5001) : '',
        sessionId: cleanContactString(tracking.sessionId, 40),
        enquiryPath: cleanContactString(tracking.enquiryPath || tracking.lastSourcePage || tracking.currentPath, 240),
        sourceName: cleanContactString(tracking.sourceName || tracking.lastSourceName, 120),
        cta: cleanContactString(tracking.cta || tracking.lastCta, 120),
    };
}

function renderEmail({
    name,
    email,
    message,
    enquiryTitle,
    source,
    location,
    visit,
    analyticsUrl,
}: {
    name: string;
    email: string;
    message: string;
    enquiryTitle: string;
    source: string;
    location: string;
    visit: ReturnType<typeof summarizeVisit>;
    analyticsUrl: string;
}) {
    const safe = {
        name: escapeHtml(name),
        email: escapeHtml(email),
        message: escapeHtml(message).replace(/\r?\n/g, '<br />'),
        enquiryTitle: escapeHtml(enquiryTitle),
        source: escapeHtml(source),
        location: escapeHtml(location),
        analyticsUrl: escapeHtml(analyticsUrl),
    };
    const pageCount = visit?.distinctMeaningfulPages || 0;
    const visitSummary = visit
        ? `${formatDuration(visit.durationSeconds)} &middot; ${pageCount} ${pageCount === 1 ? 'page' : 'pages'} explored`
        : '';
    const strongest = visit?.strongestPage && visit.strongestPage.engagedSeconds > 0
        ? `Spent the most time on ${escapeHtml(visit.strongestPage.title)} &mdash; ${formatDuration(visit.strongestPage.engagedSeconds)}`
        : '';
    const replyHref = `mailto:${safe.email}?subject=${encodeURIComponent(`Re: ${enquiryTitle}`)}`;

    const html = `<!doctype html>
<html><head><meta name="viewport" content="width=device-width,initial-scale=1" />
<style>@media(max-width:600px){.card{padding:32px 24px!important}.name{font-size:32px!important}.message{font-size:22px!important;padding:24px!important}.button{display:block!important;text-align:center!important}}</style></head>
<body style="margin:0;background:#f5f4f0;color:#181817;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif">
<div style="display:none;max-height:0;overflow:hidden">New ${safe.enquiryTitle} enquiry from ${safe.name}</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f5f4f0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" class="card" style="max-width:640px;background:#fff;padding:52px 56px;border-radius:12px">
<tr><td>
<p style="margin:0 0 18px;color:#b3452d;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase">New enquiry</p>
<h1 class="name" style="margin:0 0 6px;font-size:40px;line-height:1.12;letter-spacing:-1.2px">${safe.name}</h1>
<a href="mailto:${safe.email}" style="color:#66635e;font-size:15px;text-decoration:underline">${safe.email}</a>

<div class="message" style="margin:38px 0 42px;padding:30px;background:#f7f2ef;border-left:3px solid #b3452d;border-radius:2px 8px 8px 2px;font-family:Georgia,'Times New Roman',serif;font-size:25px;line-height:1.45">&ldquo;${safe.message}&rdquo;</div>

<p style="margin:0 0 7px;color:#817e78;font-size:11px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase">Enquiring about</p>
<p style="margin:0 0 30px;font-size:18px;font-weight:650;line-height:1.4">${safe.enquiryTitle}</p>

<p style="margin:0 0 7px;color:#817e78;font-size:11px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase">Came from</p>
<p style="margin:0;font-size:18px;font-weight:650;line-height:1.4">${safe.source}</p>
${location ? `<p style="margin:4px 0 30px;color:#66635e;font-size:14px;line-height:1.5">${safe.location}</p>` : '<div style="height:30px"></div>'}

${visit ? `<p style="margin:0 0 7px;color:#817e78;font-size:11px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase">Current visit</p>
<p style="margin:0;font-size:17px;font-weight:650;line-height:1.5">${visitSummary}</p>
${strongest ? `<p style="margin:5px 0 0;color:#66635e;font-size:14px;line-height:1.5">${strongest}</p>` : ''}` : ''}

<div style="margin-top:42px;padding-top:32px;border-top:1px solid #e8e5df">
<a class="button" href="${replyHref}" style="display:inline-block;padding:14px 22px;background:#b3452d;color:#fff;border-radius:7px;font-size:15px;font-weight:700;text-decoration:none">Reply to ${safe.name}</a>
<p style="margin:20px 0 0"><a href="${safe.analyticsUrl}" style="color:#817e78;font-size:12px;text-decoration:underline">View this visit in analytics</a></p>
</div>
</td></tr></table></td></tr></table></body></html>`;

    const text = [
        'NEW ENQUIRY', '', name, email, '', `“${message}”`, '',
        'Enquiring about', enquiryTitle, '',
        'Came from', source,
        ...(location ? [location] : []),
        ...(visit ? ['', 'Current visit', `${formatDuration(visit.durationSeconds)} · ${pageCount} ${pageCount === 1 ? 'page' : 'pages'} explored`] : []),
        ...(strongest && visit?.strongestPage ? [`Spent the most time on ${visit.strongestPage.title} — ${formatDuration(visit.strongestPage.engagedSeconds)}`] : []),
        '', `Reply to ${name}: mailto:${email}`, `View this visit in analytics: ${analyticsUrl}`,
    ].join('\n');

    return { html, text };
}

export const POST: APIRoute = async ({ request }) => {
    let submissionId = '';
    try {
        const payload = await parsePayload(request);
        if (!payload.name) return json({ error: 'Please provide your name.' }, 400);
        if (!EMAIL_REGEX.test(payload.email)) return json({ error: 'Please provide a valid email address.' }, 400);
        if (!payload.message || payload.message.length > 5000) return json({ error: 'Please provide a message (1–5000 characters).' }, 400);
        if (!isUuid(payload.sessionId)) {
            return json({ error: 'Your visit expired. Please refresh the page and try again.' }, 400);
        }

        const resendKey = import.meta.env.RESEND_API_KEY || process.env.RESEND_API_KEY;
        const supabase = createSupabaseServiceClient();
        if (!resendKey || !supabase) return json({ error: 'The contact service is temporarily unavailable.' }, 503);

        const enquiryTitle = resolveEnquiryTitle(payload);
        const { data: submission, error: submissionError } = await supabase
            .from('contact_submissions')
            .insert({
                session_id: payload.sessionId,
                name: payload.name,
                email: payload.email,
                message: payload.message,
                enquiry_path: payload.enquiryPath || null,
                enquiry_source_name: payload.sourceName || null,
                enquiry_cta: payload.cta || null,
                enquiry_title: enquiryTitle,
            })
            .select('id, session_id, name, email, message, enquiry_title, submitted_at')
            .single();
        if (submissionError || !submission) {
            console.error('[contact] Submission was not saved:', submissionError?.message);
            return json({ error: 'Your visit could not be linked to this enquiry. Please refresh and try again.' }, 409);
        }
        submissionId = submission.id;

        const [{ data: session }, { data: pageViews, error: viewsError }] = await Promise.all([
            supabase
                .from('analytics_sessions')
                .select('id, source, city, country, landing_page, started_at')
                .eq('id', submission.session_id)
                .single(),
            supabase
                .from('analytics_page_views')
                .select('page_path, page_title, viewed_at, engaged_seconds')
                .eq('session_id', submission.session_id)
                .lte('viewed_at', submission.submitted_at)
                .order('viewed_at', { ascending: true }),
        ]);
        if (!session || viewsError) throw new Error('The saved visit could not be retrieved.');

        const visit = summarizeVisit({ session, pageViews, submittedAt: submission.submitted_at });
        const source = normalizedAcquisitionSource(session.source);
        const location = readableLocation(session);
        const siteOrigin = (import.meta.env.PUBLIC_SITE_URL || process.env.PUBLIC_SITE_URL || new URL(request.url).origin).replace(/\/$/, '');
        const analyticsUrl = `${siteOrigin}/admin/dashboard?section=analytics&submission=${encodeURIComponent(submission.id)}`;
        const rendered = renderEmail({
            name: submission.name,
            email: submission.email,
            message: submission.message,
            enquiryTitle: submission.enquiry_title,
            source,
            location,
            visit,
            analyticsUrl,
        });

        const resend = new Resend(resendKey);
        const { error: emailError } = await resend.emails.send({
            from: import.meta.env.CONTACT_FORM_FROM_EMAIL || process.env.CONTACT_FORM_FROM_EMAIL || 'Abodid Contact <newsletter@abodid.com>',
            to: [import.meta.env.CONTACT_FORM_TO_EMAIL || process.env.CONTACT_FORM_TO_EMAIL || 'hello@abodid.com'],
            replyTo: submission.email,
            subject: `New ${submission.enquiry_title} enquiry — ${submission.name}`,
            ...rendered,
        });
        if (emailError) throw new Error(`Email provider rejected the notification: ${emailError.message}`);

        await supabase.from('contact_submissions').update({ notification_sent_at: new Date().toISOString(), notification_error: null }).eq('id', submission.id);
        return json({ success: true });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unexpected contact form failure';
        console.error('[contact] Notification failed:', message);
        if (submissionId) {
            const supabase = createSupabaseServiceClient();
            await supabase?.from('contact_submissions').update({ notification_error: message.slice(0, 500) }).eq('id', submissionId);
        }
        return json({ error: 'Your enquiry was saved, but the notification could not be sent. Please email hello@abodid.com directly.' }, 502);
    }
};
