import { Resend } from 'resend';
import type { SupabaseClient, User } from '@supabase/supabase-js';

type OpportunityOnboardingProfile = {
    id: string;
    username: string;
    display_name: string;
    role: string;
};

type DigestMailSettings = {
    recipient_name: string | null;
    recipient_email: string;
    sender_email: string;
    reply_to_email: string | null;
};

export type OpportunityOnboardingResult =
    | { status: 'skipped' | 'recorded' | 'already_recorded' | 'notified' }
    | { status: 'notification_failed'; error: string };

const APP_ORIGIN = 'https://abodid.com';

const escapeHtml = (value: string) => value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

export const buildOpportunitySignupEmailHtml = ({
    displayName,
    email,
    username,
    firstSeenAt,
    adminUrl,
}: {
    displayName: string;
    email: string;
    username: string;
    firstSeenAt: string;
    adminUrl: string;
}) => {
    const signedUp = new Intl.DateTimeFormat('en-IN', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'Asia/Kolkata',
    }).format(new Date(firstSeenAt));

    return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;background:#2444ca;color:#15130f;font-family:Arial,sans-serif;padding:24px;">
  <main style="max-width:620px;margin:0 auto;background:#fff8e8;border:1px solid #15130f;border-radius:20px;overflow:hidden;">
    <header style="background:#ff7eb5;border-bottom:1px solid #15130f;padding:28px;">
      <p style="margin:0 0 10px;font-size:12px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;">Opportunity Tracker</p>
      <h1 style="margin:0;font-size:36px;line-height:.98;letter-spacing:-.04em;">New user onboarded.</h1>
    </header>
    <section style="padding:28px;">
      <h2 style="margin:0 0 6px;font-size:24px;line-height:1.05;">${escapeHtml(displayName)}</h2>
      <p style="margin:0 0 26px;color:#514f4a;line-height:1.5;">${escapeHtml(email)} · @${escapeHtml(username)}</p>
      <div style="border-top:1px solid rgba(21,19,15,.24);border-bottom:1px solid rgba(21,19,15,.24);padding:16px 0;margin-bottom:24px;">
        <p style="margin:0;font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;">Onboarded</p>
        <p style="margin:6px 0 0;font-size:18px;font-weight:700;">${escapeHtml(signedUp)} IST</p>
      </div>
      <a href="${escapeHtml(adminUrl)}" style="display:inline-block;background:#ffe44f;color:#15130f;border:1px solid #15130f;border-radius:14px;padding:14px 18px;font-weight:800;text-decoration:none;">View user collection →</a>
    </section>
  </main>
</body>
</html>`;
};

const markNotification = async (
    serviceClient: SupabaseClient,
    userId: string,
    values: Record<string, unknown>,
) => {
    const { error } = await serviceClient
        .from('opportunity_memberships')
        .update({ ...values, updated_at: new Date().toISOString() })
        .eq('user_id', userId);

    if (error) throw error;
};

/**
 * Records the first successful Tracker session and sends one owner email.
 * All failures are returned to the caller so authentication itself never fails.
 */
export const recordOpportunityOnboarding = async ({
    serviceClient,
    user,
    profile,
}: {
    serviceClient: SupabaseClient;
    user: User;
    profile: OpportunityOnboardingProfile;
}): Promise<OpportunityOnboardingResult> => {
    if (user.is_anonymous || profile.role === 'admin') return { status: 'skipped' };

    const firstSeenAt = new Date().toISOString();
    const { data: inserted, error: insertError } = await serviceClient
        .from('opportunity_memberships')
        .insert({ user_id: user.id, first_seen_at: firstSeenAt })
        .select('user_id, first_seen_at')
        .maybeSingle();

    if (insertError && insertError.code !== '23505') throw insertError;

    const { data: claimed, error: claimError } = await serviceClient
        .rpc('claim_opportunity_signup_notification', { p_user_id: user.id });
    if (claimError) throw claimError;
    if (!claimed) return { status: inserted ? 'recorded' : 'already_recorded' };

    try {
        const resendKey = (typeof import.meta !== 'undefined' && import.meta.env?.RESEND_API_KEY)
            || process.env.RESEND_API_KEY;
        if (!resendKey) throw new Error('RESEND_API_KEY is not configured');

        const { data: mailSettings, error: settingsError } = await serviceClient
            .from('reading_digest_settings')
            .select('recipient_name, recipient_email, sender_email, reply_to_email')
            .eq('id', true)
            .single<DigestMailSettings>();
        if (settingsError || !mailSettings?.recipient_email) {
            throw settingsError || new Error('Morning digest recipient is not configured');
        }

        const membershipFirstSeenAt = inserted?.first_seen_at || firstSeenAt;
        const displayName = profile.display_name || profile.username;
        const email = user.email || 'Email unavailable';
        const adminUrl = `${APP_ORIGIN}/admin/opportunities?user=${encodeURIComponent(user.id)}`;
        const resend = new Resend(resendKey);
        const { error: sendError } = await resend.emails.send({
            from: `Opportunity Tracker <${mailSettings.sender_email}>`,
            to: [mailSettings.recipient_email],
            replyTo: mailSettings.reply_to_email || undefined,
            subject: `New Opportunity Tracker user — ${displayName}`,
            html: buildOpportunitySignupEmailHtml({
                displayName,
                email,
                username: profile.username,
                firstSeenAt: membershipFirstSeenAt,
                adminUrl,
            }),
            text: [
                'New Opportunity Tracker user',
                displayName,
                email,
                `@${profile.username}`,
                `Onboarded: ${membershipFirstSeenAt}`,
                adminUrl,
            ].join('\n'),
        }, {
            idempotencyKey: `opportunity-onboarding/${user.id}`,
        });
        if (sendError) throw new Error(sendError.message);

        await markNotification(serviceClient, user.id, {
            signup_notification_status: 'sent',
            signup_notification_sent_at: new Date().toISOString(),
            signup_notification_error: null,
        });
        return { status: 'notified' };
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown signup notification error';
        await markNotification(serviceClient, user.id, {
            signup_notification_status: 'failed',
            signup_notification_error: message.slice(0, 500),
        }).catch(() => undefined);
        return { status: 'notification_failed', error: message };
    }
};
