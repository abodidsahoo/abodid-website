import { Resend } from 'resend';
import { createSupabaseServiceClient } from '../supabaseServer';
import type { Opportunity } from './types';

const SENDER_EMAIL = import.meta.env.CONTACT_NOTIFICATION_FROM_EMAIL || process.env.CONTACT_NOTIFICATION_FROM_EMAIL || 'Abodid Opportunity Desk <contact@abodid.com>';
const RECIPIENT_EMAIL = import.meta.env.OWNER_NOTIFICATION_EMAIL || process.env.OWNER_NOTIFICATION_EMAIL || import.meta.env.CONTACT_FORM_TO_EMAIL || process.env.CONTACT_FORM_TO_EMAIL;

export interface ReminderRule {
    type: string;
    label: string;
    hoursBefore: number;
    targetField: 'deadline_at' | 'event_date';
}

export const REMINDER_RULES: ReminderRule[] = [
    // Application Deadline Reminders
    { type: 'deadline_7d', label: '7 days remaining', hoursBefore: 7 * 24, targetField: 'deadline_at' },
    { type: 'deadline_3d', label: '3 days remaining', hoursBefore: 3 * 24, targetField: 'deadline_at' },
    { type: 'deadline_24h', label: '24 hours remaining', hoursBefore: 24, targetField: 'deadline_at' },
    { type: 'deadline_3h', label: '3 hours remaining (Urgent)', hoursBefore: 3, targetField: 'deadline_at' },
    // Event / Meeting Reminders
    { type: 'event_24h', label: 'Event in 24 hours', hoursBefore: 24, targetField: 'event_date' },
    { type: 'event_1h', label: 'Event in 1 hour', hoursBefore: 1, targetField: 'event_date' },
];

/**
 * Calculates human-readable time remaining string.
 */
export function formatTimeRemaining(targetDateIso: string): string {
    const diffMs = new Date(targetDateIso).getTime() - Date.now();
    if (diffMs <= 0) return 'Expired / Passed';

    const totalHours = diffMs / (1000 * 60 * 60);
    const days = Math.ceil(totalHours / 24);

    if (days > 1) return `${days} days`;
    if (days === 1) return `${Math.max(1, Math.round(totalHours))} hrs`;
    const mins = Math.max(1, Math.floor(diffMs / (1000 * 60)));
    return `${mins} mins`;
}

/**
 * Generates styled HTML email body for a single opportunity reminder.
 */
export function buildReminderEmailHtml(opp: Opportunity, ruleLabel: string): string {
    const targetDate = opp.deadline_at || opp.event_date || '';
    const formattedDate = targetDate ? new Date(targetDate).toUTCString() : 'See source';
    const timeRemaining = targetDate ? formatTimeRemaining(targetDate) : 'Unknown';
    const reqsHtml = opp.requirements && opp.requirements.length > 0
        ? opp.requirements.map(r => `<li style="margin-bottom: 4px; color: #15130f;">${escapeHtml(r)}</li>`).join('')
        : '<li style="color: #666;">None specified</li>';

    return `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background: #fff8e8; margin: 0; padding: 24px; color: #15130f; }
  .card { max-width: 580px; margin: 0 auto; background: #ffffff; border: 2px solid #15130f; border-radius: 16px; padding: 24px; box-shadow: 4px 4px 0px #15130f; }
  .badge { display: inline-block; background: #ffe44f; color: #15130f; padding: 4px 10px; font-weight: 700; font-size: 12px; border-radius: 6px; text-transform: uppercase; border: 1px solid #15130f; margin-bottom: 12px; }
  .title { font-size: 22px; font-weight: 800; line-height: 1.2; margin: 0 0 4px; color: #15130f; }
  .org { font-size: 15px; font-weight: 600; color: #5524c7; margin: 0 0 16px; }
  .box { background: #fff8e8; border: 1px solid rgba(21,19,15,0.2); border-radius: 10px; padding: 14px; margin-bottom: 16px; }
  .box-title { font-size: 12px; font-weight: 700; text-transform: uppercase; color: #777; margin-bottom: 4px; }
  .box-val { font-size: 15px; font-weight: 700; color: #15130f; }
  .action-box { background: #ffe44f; border: 2px solid #15130f; border-radius: 10px; padding: 14px; margin-bottom: 16px; }
  .btn { display: inline-block; background: #2444ca; color: #fff8e8; font-weight: 700; text-decoration: none; padding: 10px 18px; border-radius: 8px; border: 1px solid #15130f; margin-right: 8px; margin-top: 8px; }
  .btn-alt { display: inline-block; background: #fff8e8; color: #15130f; font-weight: 700; text-decoration: none; padding: 10px 18px; border-radius: 8px; border: 1px solid #15130f; margin-top: 8px; }
</style>
</head>
<body>
  <div class="card">
    <div class="badge">${escapeHtml(ruleLabel)} · ${escapeHtml(opp.category)}</div>
    <h1 class="title">${escapeHtml(opp.title)}</h1>
    <div class="org">${escapeHtml(opp.organisation)}</div>

    <div class="box">
      <div class="box-title">Deadline / Target Date</div>
      <div class="box-val">${escapeHtml(formattedDate)} (${timeRemaining})</div>
    </div>

    ${opp.next_action ? `
    <div class="action-box">
      <div class="box-title" style="color: #15130f;">Next Immediate Action</div>
      <div class="box-val">${escapeHtml(opp.next_action)}</div>
    </div>` : ''}

    <div class="box">
      <div class="box-title">Submission Needs & Requirements</div>
      <ul style="margin: 6px 0 0; padding-left: 18px;">
        ${reqsHtml}
      </ul>
    </div>

    ${opp.summary ? `
    <p style="font-size: 14px; color: #555; line-height: 1.4; margin-bottom: 20px;">
      ${escapeHtml(opp.summary)}
    </p>` : ''}

    <div style="margin-top: 20px;">
      ${opp.application_url ? `<a href="${escapeHtml(opp.application_url)}" class="btn" target="_blank">Open Application →</a>` : ''}
      <a href="${escapeHtml(opp.source_url)}" class="btn-alt" target="_blank">View Original Source →</a>
      ${opp.meeting_url ? `<a href="${escapeHtml(opp.meeting_url)}" class="btn-alt" target="_blank">Join Meeting →</a>` : ''}
    </div>
  </div>
</body>
</html>
    `;
}

/**
 * Generates styled HTML email for the daily morning digest.
 */
export function buildDailyDigestEmailHtml(
    closingToday: Opportunity[],
    closingThisWeek: Opportunity[],
    meetingsToday: Opportunity[]
): string {
    const totalCount = closingToday.length + closingThisWeek.length + meetingsToday.length;

    const renderList = (items: Opportunity[], subtitle: string) => {
        if (items.length === 0) return '';
        return `
        <div style="margin-bottom: 24px;">
          <h3 style="font-size: 14px; text-transform: uppercase; color: #5524c7; margin: 0 0 10px; border-bottom: 2px solid #5524c7; padding-bottom: 4px;">
            ${escapeHtml(subtitle)} (${items.length})
          </h3>
          ${items.map(opp => `
            <div style="background: #ffffff; border: 1.5px solid #15130f; border-radius: 10px; padding: 14px; margin-bottom: 10px; box-shadow: 2px 2px 0px #15130f;">
              <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #666; margin-bottom: 2px;">
                ${escapeHtml(opp.category)} · ${escapeHtml(opp.organisation)}
              </div>
              <div style="font-size: 16px; font-weight: 800; color: #15130f; margin-bottom: 6px;">
                ${escapeHtml(opp.title)}
              </div>
              ${opp.next_action ? `<div style="font-size: 13px; font-weight: 600; color: #2444ca; margin-bottom: 6px;">Next: ${escapeHtml(opp.next_action)}</div>` : ''}
              <div style="font-size: 12px; color: #777;">
                ${opp.application_url ? `<a href="${escapeHtml(opp.application_url)}" style="color: #2444ca; font-weight: 700; margin-right: 12px;">Apply →</a>` : ''}
                <a href="https://abodid.com/opportunities" style="color: #15130f; font-weight: 600;">Open in Dashboard →</a>
              </div>
            </div>
          `).join('')}
        </div>
        `;
    };

    return `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background: #2444ca; margin: 0; padding: 24px; color: #15130f; }
  .card { max-width: 600px; margin: 0 auto; background: #fff8e8; border: 2px solid #15130f; border-radius: 20px; padding: 24px; box-shadow: 6px 6px 0px #15130f; }
  .header { font-size: 26px; font-weight: 900; margin: 0 0 4px; color: #15130f; }
  .subhead { font-size: 15px; color: #444; margin: 0 0 24px; }
</style>
</head>
<body>
  <div class="card">
    <h1 class="header">Opportunities Digest & Briefing</h1>
    <p class="subhead">${totalCount} actionable item${totalCount === 1 ? '' : 's'} requiring your attention.</p>

    ${renderList(meetingsToday, 'Meetings & Events Today')}
    ${renderList(closingToday, 'Closes Today / Urgent')}
    ${renderList(closingThisWeek, 'Closing This Week (Next 7 Days)')}

    <div style="text-align: center; margin-top: 24px; border-top: 1px solid rgba(21,19,15,0.2); padding-top: 16px;">
      <a href="https://abodid.com/opportunities" style="display: inline-block; background: #2444ca; color: #fff8e8; font-weight: 800; text-decoration: none; padding: 12px 24px; border-radius: 10px; border: 1.5px solid #15130f;">
        Launch Opportunities Dashboard →
      </a>
    </div>
  </div>
</body>
</html>
    `;
}

function escapeHtml(str: string): string {
    return (str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/**
 * Deterministically checks and sends all pending deadline and event reminders.
 * ZERO OpenRouter calls are made here.
 */
export async function processOpportunityReminders(): Promise<{ sent: number; errors: string[] }> {
    const resendKey = import.meta.env.RESEND_API_KEY || process.env.RESEND_API_KEY;
    const recipient = RECIPIENT_EMAIL;

    if (!resendKey || !recipient) {
        return { sent: 0, errors: ['Missing RESEND_API_KEY or recipient email'] };
    }

    const supabase = createSupabaseServiceClient();
    if (!supabase) {
        return { sent: 0, errors: ['Missing Supabase service client'] };
    }

    const resend = new Resend(resendKey);
    const now = Date.now();
    const errors: string[] = [];
    let sentCount = 0;

    // Fetch actionable opportunities (status not in done, dismissed, submitted)
    const { data: opportunities, error: oppError } = await supabase
        .from('opportunities')
        .select('*')
        .in('status', ['inbox', 'interested', 'preparing', 'registered', 'attending']);

    if (oppError || !opportunities) {
        return { sent: 0, errors: [oppError?.message || 'Failed to fetch opportunities'] };
    }

    // Fetch existing notification log entries to prevent duplicate emails
    const { data: sentLogs, error: logError } = await supabase
        .from('notification_log')
        .select('opportunity_id, notification_type');

    const sentSet = new Set<string>();
    if (sentLogs) {
        for (const log of sentLogs) {
            sentSet.add(`${log.opportunity_id}:${log.notification_type}`);
        }
    }

    for (const opp of opportunities as Opportunity[]) {
        for (const rule of REMINDER_RULES) {
            const logKey = `${opp.id}:${rule.type}`;
            if (sentSet.has(logKey)) {
                continue; // already sent
            }

            const targetTimestampStr = opp[rule.targetField];
            if (!targetTimestampStr) continue;

            const targetTime = new Date(targetTimestampStr).getTime();
            if (isNaN(targetTime)) continue;

            const timeUntilTargetMs = targetTime - now;
            const hoursUntilTarget = timeUntilTargetMs / (1000 * 60 * 60);

            // Trigger if within the rule's window and hasn't already passed completely
            if (hoursUntilTarget <= rule.hoursBefore && hoursUntilTarget > -1) {
                try {
                    const emailHtml = buildReminderEmailHtml(opp, rule.label);
                    const subject = `[${rule.label}] ${opp.title} (${opp.organisation})`;

                    const { error: sendError } = await resend.emails.send({
                        from: SENDER_EMAIL,
                        to: recipient,
                        subject,
                        html: emailHtml,
                    });

                    if (sendError) {
                        errors.push(`Failed to send email for ${opp.id} (${rule.type}): ${sendError.message}`);
                        continue;
                    }

                    // Log sent notification in Supabase
                    await supabase.from('notification_log').insert({
                        opportunity_id: opp.id,
                        notification_type: rule.type,
                        scheduled_for: new Date(targetTime - rule.hoursBefore * 60 * 60 * 1000).toISOString(),
                        sent_at: new Date().toISOString(),
                        status: 'sent',
                    });

                    sentSet.add(logKey);
                    sentCount++;
                } catch (err: any) {
                    errors.push(`Exception sending email for ${opp.id}: ${err?.message || err}`);
                }
            }
        }
    }

    return { sent: sentCount, errors };
}

/**
 * Deterministically generates and sends the daily morning digest email.
 * ZERO OpenRouter calls are made here.
 */
export async function sendDailyMorningDigest(): Promise<{ success: boolean; count: number; error?: string }> {
    const resendKey = import.meta.env.RESEND_API_KEY || process.env.RESEND_API_KEY;
    const recipient = RECIPIENT_EMAIL;

    if (!resendKey || !recipient) {
        return { success: false, count: 0, error: 'Missing RESEND_API_KEY or recipient email' };
    }

    const supabase = createSupabaseServiceClient();
    if (!supabase) {
        return { success: false, count: 0, error: 'Missing Supabase service client' };
    }

    const now = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;
    const sevenDaysMs = 7 * oneDayMs;

    const { data: opportunities, error } = await supabase
        .from('opportunities')
        .select('*')
        .in('status', ['inbox', 'interested', 'preparing', 'registered', 'attending']);

    if (error || !opportunities) {
        return { success: false, count: 0, error: error?.message || 'Failed to fetch opportunities' };
    }

    const closingToday: Opportunity[] = [];
    const closingThisWeek: Opportunity[] = [];
    const meetingsToday: Opportunity[] = [];

    for (const opp of opportunities as Opportunity[]) {
        if (opp.deadline_at) {
            const dlTime = new Date(opp.deadline_at).getTime();
            const diff = dlTime - now;
            if (diff >= 0 && diff <= oneDayMs) {
                closingToday.push(opp);
            } else if (diff > oneDayMs && diff <= sevenDaysMs) {
                closingThisWeek.push(opp);
            }
        }

        if (opp.event_date) {
            const evTime = new Date(opp.event_date).getTime();
            const diff = evTime - now;
            if (diff >= 0 && diff <= oneDayMs) {
                meetingsToday.push(opp);
            }
        }
    }

    const totalCount = closingToday.length + closingThisWeek.length + meetingsToday.length;
    if (totalCount === 0) {
        return { success: true, count: 0 };
    }

    const resend = new Resend(resendKey);
    const emailHtml = buildDailyDigestEmailHtml(closingToday, closingThisWeek, meetingsToday);
    const dateFormatted = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    const { error: sendError } = await resend.emails.send({
        from: SENDER_EMAIL,
        to: recipient,
        subject: `⚡ Opportunities Briefing (${dateFormatted}) - ${totalCount} Actionable Items`,
        html: emailHtml,
    });

    if (sendError) {
        return { success: false, count: totalCount, error: sendError.message };
    }

    return { success: true, count: totalCount };
}
