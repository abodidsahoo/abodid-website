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
        // Ignore malformed URLs
    }
    return null;
};

const buildApprovalEmail = ({
    submitterName,
    resourceTitle,
    curatorNote,
    dashboardUrl,
    resourceUrl,
    hubUrl
}: {
    submitterName: string;
    resourceTitle: string;
    curatorNote: string;
    dashboardUrl: string;
    resourceUrl: string | null;
    hubUrl: string;
}) => {
    const safeName = escapeHtml(submitterName);
    const safeTitle = escapeHtml(resourceTitle);
    const safeNote = escapeHtml(curatorNote);
    const safeDashboardUrl = escapeHtml(dashboardUrl);
    const safeHubUrl = escapeHtml(hubUrl);
    const safeResourceUrl = resourceUrl ? escapeHtml(resourceUrl) : null;

    return {
        subject: 'Your Resource Hub submission has been approved',
        html: `
            <!doctype html>
            <html>
                <body style="margin:0;padding:0;background:#f6f7f9;color:#1f2937;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
                    <div style="max-width:620px;margin:24px auto;padding:0 16px;">
                        <div style="background:#ffffff;border:1px solid #e5e7eb;border-radius:14px;padding:28px;">
                            <p style="margin:0 0 14px 0;">Hi ${safeName},</p>
                            <p style="margin:0 0 14px 0;">Thank you for submitting <strong>"${safeTitle}"</strong> to the Resource Hub.</p>
                            <p style="margin:0 0 14px 0;">Great news: it has been accepted and is now part of this curation round.</p>
                            <div style="margin:18px 0;padding:14px;border-radius:10px;background:#f3faf5;border:1px solid #bde7c7;">
                                <p style="margin:0 0 8px 0;font-weight:600;">Curator note</p>
                                <p style="margin:0;">${safeNote}</p>
                            </div>
                            <p style="margin:0 0 18px 0;">Thank you again for contributing. You can continue sharing more resources anytime.</p>
                            <p style="margin:0 0 18px 0;">
                                <a href="${safeDashboardUrl}" style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;padding:10px 16px;border-radius:8px;font-weight:600;">Open Dashboard</a>
                                ${safeResourceUrl ? `<a href="${safeResourceUrl}" style="display:inline-block;margin-left:8px;background:#ffffff;color:#111827;text-decoration:none;padding:10px 16px;border-radius:8px;font-weight:600;border:1px solid #d1d5db;">View Resource</a>` : ''}
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

Great news: it has been accepted and is now part of this curation round.

Curator note:
${curatorNote}

You can view your dashboard here: ${dashboardUrl}
${resourceUrl ? `Resource link: ${resourceUrl}` : ''}

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

        const { resourceId, payload } = await request.json();
        const curatorNote = typeof payload?.curator_note === 'string' ? payload.curator_note.trim() : '';

        if (!resourceId) {
            return new Response(JSON.stringify({ error: 'Missing resourceId' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        if (!curatorNote) {
            return new Response(JSON.stringify({ error: 'Curator note is required for approval.' }), {
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

        const updates: Record<string, any> = {
            status: 'approved',
            reviewed_at: new Date().toISOString(),
            reviewed_by: authData.user.id,
            updated_at: new Date().toISOString(),
            admin_notes: curatorNote,
            rejection_reason: null
        };

        if (payload?.thumbnail_url !== undefined) {
            updates.thumbnail_url = payload.thumbnail_url;
        }

        if (payload?.audience) {
            updates.audience = payload.audience;
        }

        const { error: updateError } = await supabase
            .from('hub_resources')
            .update(updates)
            .eq('id', resourceId);

        if (updateError) {
            return new Response(JSON.stringify({ error: updateError.message }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        if (Array.isArray(payload?.tag_ids)) {
            const { error: deleteTagsError } = await supabase
                .from('hub_resource_tags')
                .delete()
                .eq('resource_id', resourceId);

            if (deleteTagsError) {
                return new Response(JSON.stringify({ error: deleteTagsError.message }), {
                    status: 500,
                    headers: { 'Content-Type': 'application/json' }
                });
            }

            if (payload.tag_ids.length > 0) {
                const tagRows = payload.tag_ids.map((tagId: string) => ({
                    resource_id: resourceId,
                    tag_id: tagId
                }));

                const { error: insertTagsError } = await supabase
                    .from('hub_resource_tags')
                    .insert(tagRows);

                if (insertTagsError) {
                    return new Response(JSON.stringify({ error: insertTagsError.message }), {
                        status: 500,
                        headers: { 'Content-Type': 'application/json' }
                    });
                }
            }
        }

        let emailResult = { sent: false, reason: 'No submitter email found' };
        const { data: userLookup, error: userLookupError } = await supabase.auth.admin.getUserById(resource.submitted_by);
        const submitterEmail = userLookupError ? null : userLookup.user?.email?.trim().toLowerCase();

        if (submitterEmail && resendKey) {
            try {
                const resend = new Resend(resendKey);
                const baseUrl = new URL(request.url).origin;
                const emailContent = buildApprovalEmail({
                    submitterName: resource.submitter_profile?.full_name || resource.submitter_profile?.username || 'there',
                    resourceTitle: resource.title || 'your resource',
                    curatorNote,
                    dashboardUrl: `${baseUrl}/resources/dashboard`,
                    resourceUrl: toSafeHttpUrl(resource.url),
                    hubUrl: `${baseUrl}/resources`
                });

                await resend.emails.send({
                    from: 'Abodid <newsletter@abodid.com>',
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
                console.error('Failed to send approval email:', emailError);
                emailResult = { sent: false, reason: emailError?.message || 'Unknown email error' };
            }
        } else if (!resendKey) {
            emailResult = { sent: false, reason: 'Server config error: missing RESEND_API_KEY' };
        }

        return new Response(JSON.stringify({ success: true, emailResult }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error: any) {
        console.error('Approval API error:', error);
        return new Response(JSON.stringify({ error: error?.message || 'Internal server error' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};
