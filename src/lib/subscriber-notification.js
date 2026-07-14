import { formatDuration } from './contact-notification.js';

const escapeHtml = (value) => String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

export const readableSubscriptionSource = (value) => ({
    'footer-newsletter': 'Footer newsletter',
    'newsletter-popup': 'Newsletter popup',
    'newsletter-page': 'Newsletter page',
    'landing-grid-newsletter': 'Homepage newsletter',
    'du-workshop-feedback': 'Workshop feedback form',
}[String(value || '').toLowerCase()] || 'Newsletter form');

export const renderSubscriberNotification = ({
    email,
    name,
    status,
    source,
    acquisitionSource,
    location,
    visit,
    analyticsUrl,
}) => {
    const isNew = status === 'new';
    const label = isNew ? 'New subscriber' : 'Subscription updated';
    const heading = name || (isNew ? 'New newsletter subscriber' : 'Returning subscriber');
    const sourceLabel = readableSubscriptionSource(source);
    const safe = {
        email: escapeHtml(email),
        heading: escapeHtml(heading),
        source: escapeHtml(sourceLabel),
        acquisition: escapeHtml(acquisitionSource),
        location: escapeHtml(location),
        analyticsUrl: escapeHtml(analyticsUrl),
    };
    const pageCount = visit?.distinctMeaningfulPages || 0;
    const strongest = visit?.strongestPage && visit.strongestPage.engagedSeconds > 0
        ? `Spent the most time on ${escapeHtml(visit.strongestPage.title)} &mdash; ${formatDuration(visit.strongestPage.engagedSeconds)}`
        : '';

    const html = `<!doctype html>
<html><head><meta name="viewport" content="width=device-width,initial-scale=1" />
<style>@media(max-width:600px){.card{padding:32px 24px!important}.heading{font-size:31px!important}.button{display:block!important;text-align:center!important}}</style></head>
<body style="margin:0;background:#f5f4f0;color:#181817;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif">
<div style="display:none;max-height:0;overflow:hidden">${escapeHtml(label)}: ${safe.email}</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f5f4f0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" class="card" style="max-width:640px;background:#fff;padding:52px 56px;border-radius:12px"><tr><td>
<p style="margin:0 0 18px;color:#b3452d;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase">${escapeHtml(label)}</p>
<h1 class="heading" style="margin:0 0 7px;font-size:38px;line-height:1.14;letter-spacing:-1.1px">${safe.heading}</h1>
<a href="mailto:${safe.email}" style="color:#66635e;font-size:15px;text-decoration:underline">${safe.email}</a>

<div style="margin-top:40px">
<p style="margin:0 0 7px;color:#817e78;font-size:11px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase">Subscribed through</p>
<p style="margin:0 0 30px;font-size:18px;font-weight:650;line-height:1.4">${safe.source}</p>

${acquisitionSource ? `<p style="margin:0 0 7px;color:#817e78;font-size:11px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase">Came from</p>
<p style="margin:0;font-size:18px;font-weight:650;line-height:1.4">${safe.acquisition}</p>
${location ? `<p style="margin:4px 0 30px;color:#66635e;font-size:14px;line-height:1.5">${safe.location}</p>` : '<div style="height:30px"></div>'}` : ''}

${visit ? `<p style="margin:0 0 7px;color:#817e78;font-size:11px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase">Current visit</p>
<p style="margin:0;font-size:17px;font-weight:650;line-height:1.5">${formatDuration(visit.durationSeconds)} &middot; ${pageCount} ${pageCount === 1 ? 'page' : 'pages'} explored</p>
${strongest ? `<p style="margin:5px 0 0;color:#66635e;font-size:14px;line-height:1.5">${strongest}</p>` : ''}` : ''}
</div>

<div style="margin-top:42px;padding-top:32px;border-top:1px solid #e8e5df">
<a class="button" href="mailto:${safe.email}" style="display:inline-block;padding:14px 22px;background:#b3452d;color:#fff;border-radius:7px;font-size:15px;font-weight:700;text-decoration:none">Email subscriber</a>
${analyticsUrl ? `<p style="margin:20px 0 0"><a href="${safe.analyticsUrl}" style="color:#817e78;font-size:12px;text-decoration:underline">View this visit in analytics</a></p>` : ''}
</div>
</td></tr></table></td></tr></table></body></html>`;

    const text = [
        label.toUpperCase(), '',
        ...(name ? [name] : []),
        email, '',
        'Subscribed through', sourceLabel,
        ...(acquisitionSource ? ['', 'Came from', acquisitionSource] : []),
        ...(location ? [location] : []),
        ...(visit ? ['', 'Current visit', `${formatDuration(visit.durationSeconds)} · ${pageCount} ${pageCount === 1 ? 'page' : 'pages'} explored`] : []),
        ...(strongest && visit?.strongestPage ? [`Spent the most time on ${visit.strongestPage.title} — ${formatDuration(visit.strongestPage.engagedSeconds)}`] : []),
        '', `Email subscriber: mailto:${email}`,
        ...(analyticsUrl ? [`View this visit in analytics: ${analyticsUrl}`] : []),
    ].join('\n');

    return {
        subject: `${isNew ? 'New newsletter subscriber' : 'Newsletter subscription updated'} — ${name || email}`,
        html,
        text,
    };
};
