import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import {
    AudienceSelectionError,
    resolveNewsletterAudience,
} from '../../../lib/newsletter/recipientSelection.js';
import { createNewsletterDelivery } from '../../../lib/newsletter/deliveryPayload.js';
import { personalizeNewsletterMessage } from '../../../lib/newsletter/personalization.js';
import { newsletterHasContent } from '../../../lib/newsletter/blocks.js';
import {
    compileNewsletterEmail,
    escapeNewsletterHtml,
} from '../../../lib/newsletter/compiler.js';

const NEWSLETTER_TEST_EMAIL = 'abodidsahoo@gmail.com';

export const POST: APIRoute = async ({ request }) => {
    try {
        const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL || process.env.PUBLIC_SUPABASE_URL;
        const supabaseServiceKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
        const resendKey = import.meta.env.RESEND_API_KEY || process.env.RESEND_API_KEY;

        // 1. Config Check
        if (!supabaseUrl || !supabaseServiceKey || !resendKey) {
            return new Response(JSON.stringify({ error: 'Server Config Error: Missing Keys' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        const resend = new Resend(resendKey);

        // 2. Auth Check (Admin Only)
        const authHeader = request.headers.get('Authorization');
        const token = authHeader?.replace('Bearer ', '');

        if (!token) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
        }

        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (authError || !user) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
        }

        // Verify Admin Role
        const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();

        if (profile?.role !== 'admin') {
            return new Response(JSON.stringify({ error: 'Forbidden: Admin access required' }), { status: 403 });
        }

        // 3. Parse Request
        const {
            newsletterId,
            subject,
            blocks,
            settings,
            isTest,
            previewText,
            senderName,
            senderEmail,
            audienceMode,
            recipientIds,
        } = await request.json();

        let audience;
        try {
            audience = resolveNewsletterAudience({ isTest, audienceMode, recipientIds });
        } catch (error) {
            if (error instanceof AudienceSelectionError) {
                return new Response(JSON.stringify({ error: error.message }), {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' },
                });
            }
            throw error;
        }

        // Validate Sender Email (Must be verified domain)
        if (senderEmail && !senderEmail.endsWith('@abodid.com')) {
            return new Response(JSON.stringify({ error: 'Sender email must be an @abodid.com address.' }), { status: 400 });
        }

        const effectiveSenderName = senderName || 'Abodid';
        const effectiveSenderEmail = senderEmail || 'hello@abodid.com';
        const fromAddress = `${effectiveSenderName} <${effectiveSenderEmail}>`;

        if (!subject || !newsletterHasContent(blocks)) {
            return new Response(JSON.stringify({ error: 'Missing fields' }), { status: 400 });
        }

        // 4. Send Logic
        let recipients: Array<{ id?: string; email: string; name?: string | null }> = [];

        if (audience.mode === 'test') {
            // Test Mode is deliberately fixed to the owner's review inbox.
            const adminName = user.user_metadata?.first_name
                || user.user_metadata?.name
                || user.user_metadata?.full_name
                || 'Abodid';
            recipients = [{ email: NEWSLETTER_TEST_EMAIL, name: adminName }];
        } else if (audience.mode === 'selected') {
            // Targeted Mode: Resolve IDs against active subscribers on the server.
            const { data: subscribers, error: subError } = await supabase
                .from('subscribers')
                .select('id, email, name')
                .eq('status', 'active')
                .in('id', audience.recipientIds);

            if (subError) throw subError;

            if ((subscribers || []).length !== audience.recipientIds.length) {
                return new Response(
                    JSON.stringify({
                        error: 'One or more selected subscribers are no longer active. Refresh the list and try again.',
                    }),
                    {
                        status: 400,
                        headers: { 'Content-Type': 'application/json' },
                    },
                );
            }

            recipients = subscribers || [];
        } else {
            // Broadcast Mode: Fetch all active subscribers
            const { data: subscribers, error: subError } = await supabase
                .from('subscribers')
                .select('email, name')
                .eq('status', 'active');

            if (subError) throw subError;
            recipients = subscribers || [];
        }

        if (recipients.length === 0) {
            return new Response(JSON.stringify({ success: true, count: 0, message: 'No recipients found.' }), { status: 200 });
        }

        // 5. Log Broadcast to DB (if not test) & Get ID
        let broadcastId = null;
        if (!isTest) {
            const { data: broadcastData, error: dbError } = await supabase
                .from('newsletter_broadcasts')
                .insert({
                    newsletter_id: newsletterId || null,
                    subject,
                    message: JSON.stringify({ version: 1, blocks, settings }),
                    sent_count: recipients.length
                })
                .select()
                .single();

            if (!dbError && broadcastData) {
                broadcastId = broadcastData.id;
            } else {
                console.warn("Failed to log broadcast to DB:", dbError);
            }
        }

        // 6. Send Logic (Batch API)

        // Define tracking pixel ID (use 'test' for tests to avoid DB pollution or handling)
        const trackingId = broadcastId || (isTest ? 'test-mode' : null);
        const baseUrl = new URL(request.url).origin;
        const pixelUrl = `${baseUrl}/api/tracking/pixel?id=${trackingId}`;
        const compiledEmail = compileNewsletterEmail({
            blocks,
            settings,
            previewText,
            trackingPixelUrl: pixelUrl,
        });

        // Helper to chunk array
        const chunkArray = (arr: any[], size: number) => {
            return Array.from({ length: Math.ceil(arr.length / size) }, (_, i) =>
                arr.slice(i * size, i * size + size)
            );
        };

        // Resend Batch API Limit is 100
        const batches = chunkArray(recipients, 100);
        let successCount = 0;
        let failCount = 0;
        let errors: string[] = [];

        // Process batches sequentially to be safe, though parallel is likely fine for small numbers
        for (const batch of batches) {
            const emailBatch = batch.map((recipient) => {
                const unsubscribeUrl = `${baseUrl}/unsubscribe?email=${encodeURIComponent(recipient.email)}`;
                const htmlContent = personalizeNewsletterMessage(compiledEmail, recipient.name)
                    .replaceAll('{{unsubscribe_url}}', escapeNewsletterHtml(unsubscribeUrl));

                return createNewsletterDelivery({
                    fromAddress,
                    recipientEmail: recipient.email,
                    subject,
                    htmlContent,
                });
            });

            try {
                const { data, error } = await resend.batch.send(emailBatch);

                if (error) {
                    console.error('Batch Send Error:', error);
                    failCount += batch.length;
                    errors.push(error.message);
                } else if (data && data.data) {
                    // Resend returns an object with { data: [...] } where inside data is array of { id } or { error }? 
                    // Actually resend.batch.send returns { data: CreateBatchData, error: ErrorResponse }
                    // CreateBatchData is { data: CreateEmailResponse[] }
                    // We need to check identifying individual failures if possible, but 
                    // for now assuming if batch succeeds, all good, unless individual items have errors.

                    // Let's assume mostly success if no top-level error.
                    // But we should count properly.
                    const batchResults = data.data;
                    const batchSuccess = batchResults.filter((r: any) => r.id).length;
                    const batchFail = batchResults.length - batchSuccess;

                    successCount += batchSuccess;
                    failCount += batchFail;

                    // Log individual failures if any (though Resend SDK types might be vague here without checking docs deep)
                    // If r.id is missing it might be an error object
                }
            } catch (e: any) {
                console.error('Batch Exception:', e);
                failCount += batch.length;
                errors.push(e.message);
            }
        }

        if (!isTest && newsletterId && successCount > 0) {
            const { error: newsletterUpdateError } = await supabase
                .from('newsletters')
                .update({ status: 'sent', sent_at: new Date().toISOString() })
                .eq('id', newsletterId);
            if (newsletterUpdateError) {
                console.warn('Failed to mark newsletter as sent:', newsletterUpdateError);
            }
        }

        return new Response(JSON.stringify({
            success: true,
            count: successCount,
            failures: failCount,
            mode:
                audience.mode === 'test'
                    ? 'test'
                    : audience.mode === 'selected'
                        ? 'selected'
                        : 'broadcast',
            analytics: broadcastId ? 'active' : 'disabled',
            errors: errors.length > 0 ? errors : undefined
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (e: any) {
        console.error('Broadcast Error:', e);
        return new Response(JSON.stringify({ error: e.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};
