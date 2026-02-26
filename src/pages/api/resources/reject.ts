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

const buildRejectionEmail = ({
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
                            <p style="margin:0 0 10px 0;">If you are open to it, please share anything you would like us to consider, such as:</p>
                            <ul style="margin:8px 0 14px 20px;padding:0;">
                                <li style="margin-bottom:6px;">the intended audience and context</li>
                                <li style="margin-bottom:6px;">what makes this especially useful or unique</li>
                                <li style="margin-bottom:6px;">a practical use case or example outcome</li>
                                <li style="margin-bottom:0;">any updates made since submission</li>
                            </ul>
                            <p style="margin:0 0 18px 0;">You can edit and resubmit anytime from your dashboard.</p>
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
        text: `Hi ${submitterName},

Thank you for submitting "${resourceTitle}" to the Resource Hub.

For this current curation round, we are not including this resource. This is not a final no, and we may reconsider it in a future round.

Current review note:
${rejectionReason}

If you are open to it, please share anything you would like us to consider, such as:
- intended audience and context
- what makes this especially useful or unique
- a practical use case or example outcome
- any updates made since submission

You can edit and resubmit anytime from your dashboard: ${dashboardUrl}

With regards,
Abodid`
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

        const { data: reviewerProfile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', authData.user.id)
            .single();

        if (!reviewerProfile || (reviewerProfile.role !== 'admin' && reviewerProfile.role !== 'curator')) {
            return new Response(JSON.stringify({ error: 'Forbidden: curator/admin only' }), {
                status: 403,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const { resourceId, reason } = await request.json();
        const rejectionReason = typeof reason === 'string' ? reason.trim() : '';

        if (!resourceId) {
            return new Response(JSON.stringify({ error: 'Missing resourceId' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const { data: resource, error: fetchError } = await supabase
            .from('hub_resources')
            .select(`
                id,
                title,
                url,
                submitted_by,
                submitter_profile:submitted_by (
                    username,
                    full_name
                )
            `)
            .eq('id', resourceId)
            .single();

        if (fetchError || !resource) {
            return new Response(JSON.stringify({ error: 'Resource not found' }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const { error: updateError } = await supabase
            .from('hub_resources')
            .update({
                status: 'rejected',
                reviewed_at: new Date().toISOString(),
                reviewed_by: authData.user.id,
                rejection_reason: rejectionReason || null,
                admin_notes: rejectionReason || null
            })
            .eq('id', resourceId);

        if (updateError) {
            return new Response(JSON.stringify({ error: updateError.message }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        let emailResult = { sent: false, reason: 'Skipped: no curator note provided' };
        const submitterName =
            resource.submitter_profile?.full_name ||
            resource.submitter_profile?.username ||
            'there';

        const { data: userLookup, error: userLookupError } = await supabase.auth.admin.getUserById(resource.submitted_by);
        const submitterEmail = userLookupError ? null : userLookup.user?.email?.trim().toLowerCase();
        const baseUrl = new URL(request.url).origin;
        const dashboardUrl = `${baseUrl}/resources/dashboard`;
        const hubUrl = `${baseUrl}/resources`;

        if (rejectionReason && submitterEmail && resendKey) {
            try {
                const resend = new Resend(resendKey);
                const fromAddress = 'Abodid <newsletter@abodid.com>';
                const emailContent = buildRejectionEmail({
                    submitterName,
                    resourceTitle: resource.title || 'your resource',
                    rejectionReason,
                    dashboardUrl,
                    hubUrl
                });

                await resend.emails.send({
                    from: fromAddress,
                    to: submitterEmail,
                    bcc:
                        ownerNotificationEmail && ownerNotificationEmail !== submitterEmail
                            ? [ownerNotificationEmail]
                            : undefined,
                    replyTo: ownerNotificationEmail || undefined,
                    subject: emailContent.subject,
                    html: emailContent.html,
                    text: emailContent.text
                });

                emailResult = { sent: true, reason: `Sent to ${submitterEmail}` };
            } catch (emailError: any) {
                console.error('Failed to send rejection email:', emailError);
                emailResult = { sent: false, reason: emailError?.message || 'Unknown email error' };
            }
        } else if (rejectionReason && submitterEmail && !resendKey) {
            console.error('Missing RESEND_API_KEY');
            emailResult = { sent: false, reason: 'Server config error: missing RESEND_API_KEY' };
        } else if (rejectionReason && !submitterEmail) {
            emailResult = { sent: false, reason: 'No submitter email found' };
        }

        return new Response(JSON.stringify({
            success: true,
            emailResult,
            resourceUrl: toSafeHttpUrl(resource.url)
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error: any) {
        console.error('Rejection API error:', error);
        return new Response(JSON.stringify({ error: error?.message || 'Internal server error' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};
