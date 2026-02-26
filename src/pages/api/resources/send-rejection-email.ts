import type { APIRoute } from 'astro';
import { Resend } from 'resend';

export const prerender = false;

const escapeHtml = (value: string) =>
    value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');

const ownerNotificationEmail = (
    import.meta.env.OWNER_NOTIFICATION_EMAIL ||
    process.env.OWNER_NOTIFICATION_EMAIL ||
    import.meta.env.CONTACT_FORM_TO_EMAIL ||
    process.env.CONTACT_FORM_TO_EMAIL ||
    'hello@abodid.com'
).trim().toLowerCase();

const buildLegacyRejectionEmail = ({
    submitterName,
    resourceTitle,
    rejectionReason,
    dashboardUrl,
    hubUrl
}: {
    submitterName: string;
    resourceTitle: string;
    rejectionReason: string;
    dashboardUrl: string;
    hubUrl: string;
}) => {
    const safeName = escapeHtml(submitterName);
    const safeTitle = escapeHtml(resourceTitle);
    const safeReason = escapeHtml(rejectionReason);
    const safeDashboardUrl = escapeHtml(dashboardUrl);
    const safeHubUrl = escapeHtml(hubUrl);

    return {
        subject: 'A quick update on your Resource Hub submission',
        html: `
            <!doctype html>
            <html>
                <body style="margin:0;padding:0;background:#f6f7f9;color:#1f2937;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
                    <div style="max-width:620px;margin:24px auto;padding:0 16px;">
                        <div style="background:#ffffff;border:1px solid #e5e7eb;border-radius:14px;padding:28px;">
                            <p style="margin:0 0 14px 0;">Hi ${safeName},</p>
                            <p style="margin:0 0 14px 0;">Thank you for submitting <strong>"${safeTitle}"</strong> to the Resource Hub.</p>
                            <p style="margin:0 0 14px 0;">For this current curation round, we are not including this resource. This is not a final no, and we may reconsider it in a future round.</p>
                            <div style="margin:18px 0;padding:14px;border-radius:10px;background:#fff8f3;border:1px solid #f7d9c4;">
                                <p style="margin:0 0 8px 0;font-weight:600;">Current review note</p>
                                <p style="margin:0;">${safeReason}</p>
                            </div>
                            <p style="margin:0 0 10px 0;">If you are open to it, please share anything you would like us to consider, such as audience context, uniqueness, practical use case, or updates made since submission.</p>
                            <p style="margin:0 0 18px 0;">
                                <a href="${safeDashboardUrl}" style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;padding:10px 16px;border-radius:8px;font-weight:600;">Open Dashboard</a>
                            </p>
                            <p style="margin:0 0 4px 0;">With regards,</p>
                            <p style="margin:0;">Abodid</p>
                        </div>
                        <p style="margin:12px 2px 0;color:#6b7280;font-size:12px;">Resource Hub: <a href="${safeHubUrl}" style="color:#6b7280;">${safeHubUrl}</a></p>
                    </div>
                </body>
            </html>
        `
    };
};

export const POST: APIRoute = async ({ request }) => {
    try {
        const resendKey = import.meta.env.RESEND_API_KEY || process.env.RESEND_API_KEY;
        if (!resendKey) {
            return new Response(JSON.stringify({ error: 'Missing RESEND_API_KEY' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const { to, resourceTitle, rejectionReason, submitterName } = await request.json();
        const recipientEmail = typeof to === 'string' ? to.trim().toLowerCase() : '';
        const safeTitle = typeof resourceTitle === 'string' ? resourceTitle.trim() : '';
        const safeReason = typeof rejectionReason === 'string' && rejectionReason.trim()
            ? rejectionReason.trim()
            : 'No specific note was provided for this review.';
        const safeName = typeof submitterName === 'string' && submitterName.trim()
            ? submitterName.trim()
            : 'there';

        if (!recipientEmail || !safeTitle) {
            return new Response(JSON.stringify({ error: 'Missing required fields' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const baseUrl = new URL(request.url).origin;
        const dashboardUrl = `${baseUrl}/resources/dashboard`;
        const hubUrl = `${baseUrl}/resources`;
        const emailContent = buildLegacyRejectionEmail({
            submitterName: safeName,
            resourceTitle: safeTitle,
            rejectionReason: safeReason,
            dashboardUrl,
            hubUrl
        });

        const resend = new Resend(resendKey);
        const { data, error } = await resend.emails.send({
            from: 'Abodid <newsletter@abodid.com>',
            to: recipientEmail,
            bcc:
                ownerNotificationEmail && ownerNotificationEmail !== recipientEmail
                    ? [ownerNotificationEmail]
                    : undefined,
            replyTo: ownerNotificationEmail || undefined,
            subject: emailContent.subject,
            html: emailContent.html
        });

        if (error) {
            return new Response(JSON.stringify({ error: error.message }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        return new Response(JSON.stringify({ success: true, data }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error: any) {
        console.error('Legacy rejection email error:', error);
        return new Response(JSON.stringify({ error: error?.message || 'Internal server error' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};
