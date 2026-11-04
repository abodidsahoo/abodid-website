import { createHmac } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getContactClientIp } from '../contact-protection.js';
import type { FeedbackForm } from './schema';

export type ResourceEmailResult = { status: 'not_requested' | 'sent' | 'pending' | 'failed'; retryAfter?: number };
type EmailPayload = { from: string; to: string[]; subject: string; html: string; text: string };
type Delivery = {
    id: string; recipient_email: string; payload: EmailPayload; delivery_status: string;
    attempt_count: number; first_attempt_at: string | null; lease_until: string | null;
};
const env = (name: string) => (typeof import.meta !== 'undefined' && import.meta.env?.[name]) || process.env?.[name] || '';
const escape = (text: string) => text.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);

function getResourceActions(resource: { label: string; url: string; description?: string }) {
    const driveMatch = resource.url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    const isDrive = Boolean(driveMatch);
    const isPdf = isDrive ||
                  resource.url.toLowerCase().endsWith('.pdf') ||
                  resource.label.toLowerCase().includes('pdf') ||
                  Boolean(resource.description && resource.description.toLowerCase().includes('pdf'));

    if (isPdf) {
        let viewUrl = resource.url;
        let downloadUrl = resource.url;
        if (driveMatch) {
            viewUrl = `https://drive.google.com/file/d/${driveMatch[1]}/view?usp=sharing`;
            downloadUrl = `https://drive.google.com/uc?export=download&id=${driveMatch[1]}`;
        }
        return { isPdf: true, viewUrl, downloadUrl };
    }

    return { isPdf: false, viewUrl: resource.url, downloadUrl: null };
}

export function renderResourceEmail(form: FeedbackForm, email: string, name = ''): EmailPayload {
    const resources = form.content.resources;
    const notice = form.content.resourceNotice;
    const fontStack = "'Satoshi', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

    const textLines = [
        `Hi ${name || 'there'},`,
        `Thank you for joining the Space & Materiality lecture at NIFT Bhubaneswar and sharing your feedback. Here are both complete slide decks and the interactive demo.`,
        '--- LECTURE SLIDE DECKS & DEMO ---',
        ...resources.map((resource) => {
            const action = getResourceActions(resource);
            if (action.isPdf && action.downloadUrl) {
                return `${resource.label}\n${resource.description || ''}\nView Online: ${action.viewUrl}\nDownload PDF: ${action.downloadUrl}`.trim();
            }
            return `${resource.label}\n${resource.description || ''}\nView Online: ${action.viewUrl}`.trim();
        }),
        ...(notice ? [`--- CONFIDENTIALITY NOTICE ---\n${notice.title}\n${notice.text}`] : []),
        '--- ONE-ON-ONE OBSIDIAN TUTORING ---',
        `As Fashion Communication and design students, building a connected personal knowledge vault in Obsidian is an essential workflow tool. It helps you connect visual references, moodboards, project documentation, material studies, and thesis research in one unified second-brain system.`,
        `Most importantly, having an organized knowledge vault gives you a massive advantage in future job and internship interviews by allowing you to articulate your creative process, decisions, and references with complete clarity and depth.`,
        `View more details: https://abodid.com/obsidian-tutoring`,
        'Warmly,',
        'Abodid Sahoo',
        'Artist, Filmmaker & Researcher',
    ];

    const htmlContent = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${escape(form.institution_name)} — Lecture resources</title>
  <!-- Brand typography: Satoshi -->
  <link rel="preconnect" href="https://api.fontshare.com">
  <link href="https://api.fontshare.com/v2/css?f[]=satoshi@400,500,700,900&display=swap" rel="stylesheet">
  <style type="text/css">
    @font-face {
      font-family: 'Satoshi';
      font-style: normal;
      font-weight: 400;
      src: url('https://abodid.com/fonts/satoshi/Satoshi-Regular.woff2') format('woff2'),
           url('https://abodid.com/fonts/satoshi/Satoshi-Regular.woff') format('woff');
    }
    @font-face {
      font-family: 'Satoshi';
      font-style: normal;
      font-weight: 500;
      src: url('https://abodid.com/fonts/satoshi/Satoshi-Medium.woff2') format('woff2'),
           url('https://abodid.com/fonts/satoshi/Satoshi-Medium.woff') format('woff');
    }
    @font-face {
      font-family: 'Satoshi';
      font-style: normal;
      font-weight: 700;
      src: url('https://abodid.com/fonts/satoshi/Satoshi-Bold.woff2') format('woff2'),
           url('https://abodid.com/fonts/satoshi/Satoshi-Bold.woff') format('woff');
    }
    body, table, td, p, h1, h2, h3, a, span {
      font-family: 'Satoshi', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif !important;
    }
    @media only screen and (max-width: 600px) {
      .card-wrap {
        padding: 24px 18px !important;
      }
      .btn-table td {
        display: block !important;
        width: 100% !important;
        padding-right: 0 !important;
        padding-bottom: 8px !important;
      }
      .btn-link {
        display: block !important;
        text-align: center !important;
      }
    }
  </style>
</head>
<body style="margin:0;padding:36px 12px;background-color:#faf8f5;font-family:${fontStack};color:#1a1918;-webkit-font-smoothing:antialiased;">
  <!-- Center editorial container table -->
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#faf8f5;margin:0;padding:0;width:100%;">
    <tr>
      <td align="center" style="padding:0;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:580px;width:100%;margin:0 auto;background-color:#ffffff;border:1px solid #e8e4dc;border-radius:8px;text-align:left;">
          <tr>
            <td class="card-wrap" style="padding:38px 34px 34px;">

              <!-- Editorial Header (Clean Brandmark, No abodid.com link) -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-bottom:1px solid #eeeae3;padding-bottom:14px;margin-bottom:26px;">
                <tr>
                  <td style="font-family:${fontStack};font-size:11px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#1a1918;">
                    ABODID SAHOO
                  </td>
                  <td align="right" style="font-family:${fontStack};font-size:11px;font-weight:500;color:#8c857b;letter-spacing:0.04em;">
                    ${escape(form.institution_name)}
                  </td>
                </tr>
              </table>

              <!-- Main Title & Intro -->
              <h1 style="font-family:${fontStack};font-size:22px;font-weight:700;line-height:1.3;color:#1a1918;margin:0 0 16px;letter-spacing:-0.015em;">
                Space &amp; Materiality — Slides &amp; Resources
              </h1>
              <p style="font-family:${fontStack};font-size:15px;line-height:1.65;color:#1a1918;margin:0 0 10px;">Hi ${escape(name || 'there')},</p>
              <p style="font-family:${fontStack};font-size:14px;line-height:1.68;color:#4a4641;margin:0 0 24px;">
                Thank you for joining the Space &amp; Materiality lecture at NIFT Bhubaneswar and taking a moment to share your feedback. As promised, here are the links to view and download both complete slide decks and the tessellation demo.
              </p>

              <!-- Slide Decks & Resources Cards -->
              <div style="margin:24px 0 26px;">
                ${resources.map((resource) => {
                    const action = getResourceActions(resource);
                    return `
                <div style="background-color:#faf8f5;border:1px solid #eeeae3;border-radius:6px;padding:20px 22px;margin-bottom:14px;">
                  <h2 style="font-family:${fontStack};font-size:16px;font-weight:700;color:#1a1918;margin:0 0 4px;line-height:1.35;">${escape(resource.label)}</h2>
                  ${resource.description ? `<p style="font-family:${fontStack};font-size:12px;color:#78736c;margin:0 0 14px;letter-spacing:0.02em;">${escape(resource.description)}</p>` : ''}
                  ${action.isPdf && action.downloadUrl ? `
                  <table cellpadding="0" cellspacing="0" border="0" class="btn-table" style="margin:0;">
                    <tr>
                      <td style="padding-right:10px;padding-bottom:6px;">
                        <a href="${escape(action.viewUrl)}" target="_blank" rel="noopener noreferrer" class="btn-link" style="display:inline-block;background-color:#ffffff;border:1px solid #1a1918;color:#1a1918;padding:8px 16px;border-radius:4px;text-decoration:none;font-size:12px;font-weight:600;font-family:${fontStack};letter-spacing:0.02em;">
                          View Online ↗
                        </a>
                      </td>
                      <td style="padding-bottom:6px;">
                        <a href="${escape(action.downloadUrl)}" target="_blank" rel="noopener noreferrer" class="btn-link" style="display:inline-block;background-color:#1a1918;border:1px solid #1a1918;color:#ffffff;padding:8px 16px;border-radius:4px;text-decoration:none;font-size:12px;font-weight:600;font-family:${fontStack};letter-spacing:0.02em;">
                          Download PDF ↓
                        </a>
                      </td>
                    </tr>
                  </table>` : `
                  <table cellpadding="0" cellspacing="0" border="0" class="btn-table" style="margin:0;">
                    <tr>
                      <td style="padding-bottom:6px;">
                        <a href="${escape(action.viewUrl)}" target="_blank" rel="noopener noreferrer" class="btn-link" style="display:inline-block;background-color:#1a1918;border:1px solid #1a1918;color:#ffffff;padding:8px 16px;border-radius:4px;text-decoration:none;font-size:12px;font-weight:600;font-family:${fontStack};letter-spacing:0.02em;">
                          View Online ↗
                        </a>
                      </td>
                    </tr>
                  </table>`}
                </div>`;
                }).join('')}
              </div>

              <!-- Confidentiality Note -->
              ${notice ? `
              <div style="margin:22px 0 26px;padding:14px 18px;background-color:#f7f5f0;border-left:3px solid #8c857b;border-radius:2px;">
                <p style="font-family:${fontStack};font-size:11px;font-weight:700;color:#1a1918;margin:0 0 4px;text-transform:uppercase;letter-spacing:0.06em;">${escape(notice.title)}</p>
                <p style="font-family:${fontStack};font-size:13px;line-height:1.55;color:#4a4641;margin:0;">${escape(notice.text)}</p>
              </div>` : ''}

              <!-- One-on-One Obsidian Tutoring Section -->
              <div style="margin:30px 0 24px;padding:22px 20px;background-color:#faf8f5;border:1px solid #eeeae3;border-radius:6px;">
                <p style="font-family:${fontStack};font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#8c857b;margin:0 0 6px;">
                  Workshop &amp; Mentorship
                </p>
                <h3 style="font-family:${fontStack};font-size:17px;font-weight:700;color:#1a1918;margin:0 0 10px;line-height:1.35;">
                  One-on-One Obsidian Tutoring
                </h3>
                <p style="font-family:${fontStack};font-size:13px;line-height:1.65;color:#3d3a36;margin:0 0 10px;">
                  As Fashion Communication and design students, building a connected personal knowledge vault in Obsidian is an essential workflow tool. It helps you connect visual references, moodboards, project documentation, material studies, and thesis research in one unified second-brain system.
                </p>
                <p style="font-family:${fontStack};font-size:13px;line-height:1.65;color:#3d3a36;margin:0 0 16px;">
                  Most importantly, having an organized vault gives you a massive advantage in <strong>future job and internship interviews</strong> by allowing you to articulate your creative process, decisions, and references with complete clarity and depth.
                </p>
                <table cellpadding="0" cellspacing="0" border="0" class="btn-table" style="margin:0;">
                  <tr>
                    <td>
                      <a href="https://abodid.com/obsidian-tutoring" target="_blank" rel="noopener noreferrer" class="btn-link" style="display:inline-block;background-color:#1a1918;border:1px solid #1a1918;color:#ffffff;padding:8px 18px;border-radius:4px;text-decoration:none;font-size:12px;font-weight:600;font-family:${fontStack};letter-spacing:0.02em;">
                        View more details ↗
                      </a>
                    </td>
                  </tr>
                </table>
              </div>

              <!-- Clean Sign-off (No contact block / No abodid.com) -->
              <div style="margin:26px 0 0;">
                <p style="font-family:${fontStack};font-size:14px;line-height:1.6;color:#2e2b27;margin:0 0 4px;">Warmly,</p>
                <p style="font-family:${fontStack};font-size:15px;font-weight:700;color:#1a1918;margin:0;">Abodid Sahoo</p>
                <p style="font-family:${fontStack};font-size:12px;color:#78736c;margin:2px 0 0;">
                  Artist, Filmmaker &amp; Researcher
                </p>
              </div>

            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    return {
        from: env('FEEDBACK_RESOURCES_FROM_EMAIL') || env('CONTACT_NOTIFICATION_FROM_EMAIL') || 'Abodid Sahoo <contact@abodid.com>',
        to: [email],
        subject: `${form.institution_name} — Lecture resources`,
        text: textLines.join('\n\n'),
        html: htmlContent,
    };
}

async function consumeMailLimit(client: SupabaseClient, scope: string, value: string, limit: number, secret: string) {
    const key = createHmac('sha256', secret).update(`feedback-resources:${scope}:${value}`).digest('hex');
    const { data, error } = await client.rpc('consume_contact_rate_limit', { p_key_hash: key, p_limit: limit, p_window_seconds: 3600 });
    if (error) throw new Error('mail_rate_limit_unavailable');
    const result = Array.isArray(data) ? data[0] : data;
    if (!result || typeof result.allowed !== 'boolean') throw new Error('mail_rate_limit_unavailable');
    return result.allowed ? 0 : Math.max(1, Number(result.retry_after_seconds) || 3600);
}

/** Called only after a successful feedback save.
 * The database receipt and frozen payload make retries safe, including provider timeouts.
 * Nothing is sent until durable rate limits and the single-writer claim succeed.
 */
export async function sendResourceEmail({ client, form, request, requestKey, email, responseId, name = '' }: {
    client: SupabaseClient; form: FeedbackForm; request: Request; requestKey: string;
    email: string; responseId: string; name?: string;
}): Promise<ResourceEmailResult> {
    if (!form.content.resourceEmailEnabled || !email) return { status: 'not_requested' };
    try {
        const lookup = () => client.from('feedback_resource_deliveries').select('*')
            .eq('form_id', form.id).eq('request_key', requestKey).maybeSingle();
        const { data: existing, error: lookupError } = await lookup();
        if (lookupError) throw new Error('mail_receipt_unavailable');
        let delivery: Delivery | null = existing;
        // A request UUID is bound to its first recipient. Never send a replay to a new address.
        if (delivery && delivery.recipient_email !== email) return { status: 'failed' };
        if (delivery?.delivery_status === 'sent') return { status: 'sent' };
        if (delivery?.delivery_status === 'sending' && Date.parse(delivery.lease_until || '') > Date.now()) return { status: 'pending' };
        // Resend retains idempotency keys for 24h. Do not retry an uncertain attempt beyond that window.
        if (delivery?.first_attempt_at && Date.parse(delivery.first_attempt_at) < Date.now() - 23 * 3600_000) return { status: 'failed' };
        const apiKey = env('RESEND_API_KEY');
        if (!apiKey) throw new Error('mail_provider_unavailable');
        for (const [scope, value, limit] of [
            ['recipient', email, 3], ['client', getContactClientIp(request), 100], ['global', 'all', 300],
        ] as const) {
            const retryAfter = await consumeMailLimit(client, scope, value, limit, apiKey);
            if (retryAfter) return { status: 'failed', retryAfter };
        }
        if (!delivery) {
            const { data, error } = await client.from('feedback_resource_deliveries').insert({
                form_id: form.id, response_id: responseId, request_key: requestKey,
                recipient_email: email, payload: renderResourceEmail(form, email, name),
            }).select('*').single();
            if (error?.code === '23505') {
                // The other request owns this delivery; its result will be visible on retry.
                return { status: 'pending' };
            }
            if (error || !data) throw new Error('mail_receipt_unavailable');
            delivery = data as Delivery;
        }
        const now = new Date().toISOString();
        const { data: claimed, error: claimError } = await client.from('feedback_resource_deliveries').update({
            delivery_status: 'sending', attempt_count: delivery.attempt_count + 1,
            first_attempt_at: delivery.first_attempt_at || now,
            lease_until: new Date(Date.now() + 60_000).toISOString(), updated_at: now, error_code: null,
        }).eq('id', delivery.id).eq('attempt_count', delivery.attempt_count).eq('delivery_status', delivery.delivery_status)
            .select('id').maybeSingle();
        if (claimError) throw new Error('mail_claim_unavailable');
        if (!claimed) return { status: 'pending' };

        let providerId: string | null = null;
        try {
            const response = await fetch('https://api.resend.com/emails', {
                method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'Idempotency-Key': `feedback-resources/${delivery.id}` },
                body: JSON.stringify(delivery.payload), signal: AbortSignal.timeout(8000),
            });
            const result = await response.json();
            if (response.ok && typeof result.id === 'string') providerId = result.id;
        } catch { /* Timeout can mean the provider accepted the email: replay uses the same idempotency key. */ }
        const { error: savedError } = await client.from('feedback_resource_deliveries').update({
            delivery_status: providerId ? 'sent' : 'failed', provider_id: providerId,
            error_code: providerId ? null : 'provider_unavailable', lease_until: null, updated_at: new Date().toISOString(),
        }).eq('id', delivery.id).eq('attempt_count', delivery.attempt_count + 1);
        if (savedError) return { status: providerId ? 'sent' : 'failed' };
        return { status: providerId ? 'sent' : 'failed' };
    } catch (error) {
        console.error('[feedback] Resource email unavailable. Feedback storage is independent.', error);
        return { status: 'failed' };
    }
}
