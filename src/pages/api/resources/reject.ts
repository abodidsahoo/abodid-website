import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseServiceKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Move Resend init inside handler to prevent startup crashes
// const resend = new Resend(import.meta.env.RESEND_API_KEY);

export const POST: APIRoute = async ({ request }) => {
    try {
        // Safe access to env var (handle Vercel/Node differences)
        const resendKey = import.meta.env.RESEND_API_KEY || process.env.RESEND_API_KEY;

        const { resourceId, reason } = await request.json();

        if (!resourceId) {
            return new Response(JSON.stringify({ error: 'Missing resourceId' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Get the resource and submitter info
        const { data: resource, error: fetchError } = await supabase
            .from('hub_resources')
            .select(`
                *,
                submitter_profile:submitted_by (
                    id,
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

        // Get current user (curator/admin doing the rejection)
        const authHeader = request.headers.get('Authorization');
        const token = authHeader?.replace('Bearer ', '');

        let reviewerId = null;
        if (token) {
            const { data: { user } } = await supabase.auth.getUser(token);
            reviewerId = user?.id;
        }

        // Update resource status to rejected
        const { error: updateError } = await supabase
            .from('hub_resources')
            .update({
                status: 'rejected',
                reviewed_at: new Date().toISOString(),
                reviewed_by: reviewerId,
                rejection_reason: reason || 'No reason provided'
            })
            .eq('id', resourceId);

        if (updateError) {
            return new Response(JSON.stringify({ error: updateError.message }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Get submitter email
        const { data: { user: submitterUser }, error: userError } = await supabase.auth.admin.getUserById(
            resource.submitted_by
        );

        let emailResult = { sent: false, reason: 'No submitter email found' };

        if (!userError && submitterUser?.email) {
            // Check for API Key properly
            if (!resendKey) {
                console.error("Missing RESEND_API_KEY");
                emailResult = { sent: false, reason: "Server Config Error: Missing Email Key" };
            } else {
                try {
                    const resend = new Resend(resendKey);
                    const subject = `Your Resource Hub submission was reviewed`;
                    const fromAddress = 'Resource Hub <noreply@abodid.com>';

                    await resend.emails.send({
                        from: fromAddress,
                        to: submitterUser.email,
                        subject: subject,
                        html: `
                            <!DOCTYPE html>
                            <html>
                            <head>
                                <style>
                                    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
                                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                                    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; }
                                    .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
                                    .feedback-box { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 4px; }
                                    .button { display: inline-block; background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 20px; }
                                    .footer { text-align: center; color: #6b7280; font-size: 14px; margin-top: 30px; }
                                </style>
                            </head>
                            <body>
                                <div class="container">
                                    <div class="header">
                                        <h1 style="margin: 0; font-size: 24px;">Resource Hub Update</h1>
                                    </div>
                                    <div class="content">
                                        <p>Hi ${resource.submitter_profile?.full_name || resource.submitter_profile?.username || 'there'},</p>
                                        
                                        <p>Thank you for submitting <strong>"${resource.title}"</strong> to the Resource Hub.</p>
                                        
                                        <p>After review, we've decided not to approve this submission at this time.</p>
                                        
                                        <div class="feedback-box">
                                            <strong>📝 Curator Feedback:</strong>
                                            <p style="margin: 10px 0 0 0;">${reason || 'No specific reason provided'}</p>
                                        </div>
                                        
                                        <p>You can edit and resubmit your resource anytime. We encourage you to address the feedback and try again!</p>
                                        
                                        <a href="https://abodid.com/resources/dashboard" class="button">View Your Dashboard</a>
                                        
                                        <div class="footer">
                                            <p>Questions? Reply to this email or visit our <a href="https://abodid.com/resources">Resource Hub</a></p>
                                        </div>
                                    </div>
                                </div>
                            </body>
                            </html>
                        `
                    });
                    emailResult = { sent: true, reason: `Sent to ${submitterUser.email}` };
                } catch (emailError: any) {
                    console.error('Failed to send email:', emailError);
                    emailResult = { sent: false, reason: emailError.message || 'Unknown email error' };
                }
            }
        }

        return new Response(JSON.stringify({ success: true, emailResult }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (e: any) {
        console.error('Rejection error:', e);
        return new Response(JSON.stringify({ error: e.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};
