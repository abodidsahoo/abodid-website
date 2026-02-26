import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

export const prerender = false;

const escapeHtml = (value: string) =>
    value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');

const toSafeHttpUrl = (value: string | null | undefined): string | null => {
    if (!value) return null;
    try {
        const parsed = new URL(value);
        if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
            return parsed.toString();
        }
    } catch {
        // Ignore malformed URL
    }
    return null;
};

const buildSubmissionEmail = ({
    submitterName,
    title,
    resourceUrl,
    description,
    status,
    dashboardUrl,
    hubUrl
}: {
    submitterName: string;
    title: string;
    resourceUrl: string | null;
    description: string;
    status: 'approved' | 'pending' | 'rejected' | 'deleted' | string;
    dashboardUrl: string;
    hubUrl: string;
}) => {
    const safeName = escapeHtml(submitterName);
    const safeTitle = escapeHtml(title);
    const safeDescription = escapeHtml(description || 'No description provided.');
    const safeDashboardUrl = escapeHtml(dashboardUrl);
    const safeHubUrl = escapeHtml(hubUrl);
    const safeResourceUrl = resourceUrl ? escapeHtml(resourceUrl) : '';
    const now = new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });

    const isApproved = status === 'approved';
    const subject = isApproved
        ? 'Your resource is now live on the Resource Hub'
        : 'Thank you for your Resource Hub submission';

    const statusLine = isApproved
        ? 'Your resource is already live in the hub.'
        : 'Your resource is in the review queue for this curation round.';

    const text = `Hi ${submitterName},

Thank you for submitting "${title}" to the Resource Hub.
${statusLine}

Submission details:
- Title: ${title}
- URL: ${resourceUrl || 'No URL provided'}
- Why it is useful: ${description || 'No description provided'}
- Submitted: ${now}

This is a personal note from Abodid. If you would like to add more context, you can reply to this email.

Dashboard: ${dashboardUrl}
Resource Hub: ${hubUrl}

With regards,
Abodid`;

    return {
        subject,
        html: `
            <!doctype html>
            <html>
                <body style="margin:0;padding:0;background:#f6f7f9;color:#1f2937;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
                    <div style="max-width:620px;margin:24px auto;padding:0 16px;">
                        <div style="background:#ffffff;border:1px solid #e5e7eb;border-radius:14px;padding:28px;">
                            <p style="margin:0 0 14px 0;">Hi ${safeName},</p>
                            <p style="margin:0 0 14px 0;">Thank you for submitting <strong>"${safeTitle}"</strong> to the Resource Hub.</p>
                            <p style="margin:0 0 14px 0;">${escapeHtml(statusLine)}</p>
                            <div style="margin:18px 0;padding:14px;border-radius:10px;background:#f9fafb;border:1px solid #e5e7eb;">
                                <p style="margin:0 0 8px 0;font-weight:600;">Submission details</p>
                                <p style="margin:0 0 6px 0;"><strong>Title:</strong> ${safeTitle}</p>
                                <p style="margin:0 0 6px 0;"><strong>URL:</strong> ${resourceUrl ? `<a href="${safeResourceUrl}" style="color:#111827;">${safeResourceUrl}</a>` : 'No URL provided'}</p>
                                <p style="margin:0 0 6px 0;"><strong>Why it is useful:</strong> ${safeDescription}</p>
                                <p style="margin:0;"><strong>Submitted:</strong> ${escapeHtml(now)}</p>
                            </div>
                            <p style="margin:0 0 14px 0;">This is a personal note from Abodid. If you want to add context or updates, just reply to this email.</p>
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
        `,
        text
    };
};

export const POST: APIRoute = async ({ request }) => {
    try {
        const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL || process.env.PUBLIC_SUPABASE_URL;
        const supabaseServiceKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
        const resendKey = import.meta.env.RESEND_API_KEY || process.env.RESEND_API_KEY;
        const ownerNotificationEmail = (
            import.meta.env.OWNER_NOTIFICATION_EMAIL ||
            process.env.OWNER_NOTIFICATION_EMAIL ||
            import.meta.env.CONTACT_FORM_TO_EMAIL ||
            process.env.CONTACT_FORM_TO_EMAIL ||
            'hello@abodid.com'
        ).trim().toLowerCase();

        if (!supabaseUrl || !supabaseServiceKey) {
            return new Response(JSON.stringify({ error: 'Server configuration error' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        const authHeader = request.headers.get('Authorization');
        const token = authHeader?.replace('Bearer ', '').trim();
        if (!token) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const { data: authData, error: authError } = await supabase.auth.getUser(token);
        if (authError || !authData.user) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const { resourceId, title, url, description, status } = await request.json();
        let safeTitle = typeof title === 'string' && title.trim() ? title.trim() : 'Untitled resource';
        let safeDescription = typeof description === 'string' ? description.trim() : '';
        let safeStatus = typeof status === 'string' && status.trim() ? status.trim() : 'pending';
        let safeResourceUrl = toSafeHttpUrl(typeof url === 'string' ? url : null);

        if (typeof resourceId === 'string' && resourceId.trim()) {
            const { data: resourceRow } = await supabase
                .from('hub_resources')
                .select('title, url, description, status')
                .eq('id', resourceId)
                .eq('submitted_by', authData.user.id)
                .single();

            if (resourceRow) {
                safeTitle = (resourceRow.title || safeTitle).trim();
                safeDescription = (resourceRow.description || safeDescription || '').trim();
                safeStatus = (resourceRow.status || safeStatus || 'pending').trim();
                safeResourceUrl = toSafeHttpUrl(resourceRow.url);
            }
        }

        let submitterName = authData.user.user_metadata?.full_name || authData.user.user_metadata?.name || '';
        if (!submitterName) {
            const { data: profile } = await supabase
                .from('profiles')
                .select('full_name, username')
                .eq('id', authData.user.id)
                .single();
            submitterName = profile?.full_name || profile?.username || 'there';
        }

        if (!authData.user.email) {
            return new Response(JSON.stringify({ error: 'Missing submitter email' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        let emailResult = { sent: false, reason: 'Missing RESEND_API_KEY' };
        if (resendKey) {
            const baseUrl = new URL(request.url).origin;
            const dashboardUrl = `${baseUrl}/resources/dashboard`;
            const hubUrl = `${baseUrl}/resources`;
            const emailContent = buildSubmissionEmail({
                submitterName,
                title: safeTitle,
                resourceUrl: safeResourceUrl,
                description: safeDescription,
                status: safeStatus,
                dashboardUrl,
                hubUrl
            });

            try {
                const resend = new Resend(resendKey);
                await resend.emails.send({
                    from: 'Abodid <newsletter@abodid.com>',
                    to: authData.user.email.trim().toLowerCase(),
                    bcc:
                        ownerNotificationEmail &&
                        ownerNotificationEmail !== authData.user.email.trim().toLowerCase()
                            ? [ownerNotificationEmail]
                            : undefined,
                    replyTo: ownerNotificationEmail || undefined,
                    subject: emailContent.subject,
                    html: emailContent.html,
                    text: emailContent.text
                });
                emailResult = { sent: true, reason: `Sent to ${authData.user.email.trim().toLowerCase()}` };
            } catch (emailError: any) {
                console.error('Submission email send failed:', emailError);
                emailResult = { sent: false, reason: emailError?.message || 'Unknown email error' };
            }
        }

        return new Response(JSON.stringify({
            success: true,
            resourceId,
            emailResult
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error: any) {
        console.error('Submission email API error:', error);
        return new Response(JSON.stringify({ error: error?.message || 'Internal server error' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};
