import type { APIRoute } from 'astro';
import { Resend } from 'resend';

const resend = new Resend(import.meta.env.RESEND_API_KEY);

export const POST: APIRoute = async ({ request }) => {
    try {
        const { to, resourceTitle, rejectionReason, submitterName } = await request.json();

        if (!to || !resourceTitle) {
            return new Response(JSON.stringify({ error: 'Missing required fields' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Send email using Resend
        const { data, error } = await resend.emails.send({
            from: 'Resource Hub <noreply@abodidsahoo.zip>',
            to: to,
            subject: `Your Resource Hub submission was reviewed`,
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
                            <p>Hi ${submitterName || 'there'},</p>
                            
                            <p>Thank you for submitting <strong>"${resourceTitle}"</strong> to the Resource Hub.</p>
                            
                            <p>After review, we've decided not to approve this submission at this time.</p>
                            
                            ${rejectionReason ? `
                                <div class="feedback-box">
                                    <strong>📝 Curator Feedback:</strong>
                                    <p style="margin: 10px 0 0 0;">${rejectionReason}</p>
                                </div>
                            ` : ''}
                            
                            <p>You can edit and resubmit your resource anytime. We encourage you to address the feedback and try again!</p>
                            
                            <a href="https://abodidsahoo.zip/resources/curator" class="button">View Your Dashboard</a>
                            
                            <div class="footer">
                                <p>Questions? Reply to this email or visit our <a href="https://abodidsahoo.zip/resources">Resource Hub</a></p>
                            </div>
                        </div>
                    </div>
                </body>
                </html>
            `
        });

        if (error) {
            console.error('Resend error:', error);
            return new Response(JSON.stringify({ error: error.message }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        return new Response(JSON.stringify({ success: true, data }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (e: any) {
        console.error('Email send error:', e);
        return new Response(JSON.stringify({ error: e.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};
