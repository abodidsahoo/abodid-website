import { Resend } from 'resend';
import { createSupabaseServiceClient } from '../supabaseServer';
import type { Opportunity } from './types';
import { formatOpportunityTitle } from './ui-helpers';

const SENDER_EMAIL = (typeof import.meta !== 'undefined' && import.meta.env?.CONTACT_NOTIFICATION_FROM_EMAIL) || process.env.CONTACT_NOTIFICATION_FROM_EMAIL || 'Abodid Opportunity Desk <contact@abodid.com>';
const RECIPIENT_EMAIL = (typeof import.meta !== 'undefined' && import.meta.env?.OWNER_NOTIFICATION_EMAIL) || process.env.OWNER_NOTIFICATION_EMAIL || (typeof import.meta !== 'undefined' && import.meta.env?.CONTACT_FORM_TO_EMAIL) || process.env.CONTACT_FORM_TO_EMAIL || 'hello@abodid.com';

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
    if (diffMs <= 0) return 'Deadline has passed';

    const diffHours = diffMs / (1000 * 60 * 60);
    const diffDays = Math.ceil(diffHours / 24);

    if (diffHours < 1) {
        const mins = Math.max(1, Math.floor(diffMs / (1000 * 60)));
        return `${mins} minutes left`;
    }
    if (diffHours < 24) {
        return `${Math.floor(diffHours)} hours left`;
    }
    if (diffDays === 1) {
        return 'Tomorrow (1 day left)';
    }
    return `${diffDays} days left`;
}

/**
 * Builds standard rich HTML email template for individual opportunity reminder.
 */
export function buildReminderEmailHtml(opp: Opportunity, ruleLabel: string): string {
    const targetDateIso = opp.deadline_at || opp.event_date;
    const formattedDate = targetDateIso ? new Date(targetDateIso).toUTCString() : 'Unspecified';
    const timeRemaining = targetDateIso ? formatTimeRemaining(targetDateIso) : '';
    const cleanTitle = formatOpportunityTitle(opp.title);

    const reqsHtml = (opp.requirements && opp.requirements.length > 0)
        ? opp.requirements.map(r => `<li style="margin-bottom: 4px;">${escapeHtml(r)}</li>`).join('')
        : '<li style="color: #666;">Standard portfolio/proposal prerequisites</li>';

    return `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background: #fff8e8; margin: 0; padding: 20px; color: #15130f; }
  .card { max-width: 580px; margin: 0 auto; background: #ffffff; border: 2px solid #15130f; border-radius: 16px; padding: 24px; box-shadow: 4px 4px 0px #15130f; }
  .badge { display: inline-block; background: #ffe44f; color: #15130f; padding: 4px 10px; font-weight: 700; font-size: 12px; border-radius: 6px; text-transform: uppercase; border: 1px solid #15130f; margin-bottom: 12px; }
  .title { font-size: 22px; font-weight: 800; line-height: 1.2; margin: 0 0 4px; color: #15130f; }
  .org { font-size: 15px; font-weight: 600; color: #5524c7; margin: 0 0 16px; }
  .box { background: #fff8e8; border: 1px solid rgba(21,19,15,0.2); border-radius: 10px; padding: 14px; margin-bottom: 16px; }
  .box-title { font-size: 12px; font-weight: 700; text-transform: uppercase; color: #777; margin-bottom: 4px; }
  .box-val { font-size: 15px; font-weight: 700; color: #15130f; }
  .action-box { background: #ffe44f; border: 2px solid #15130f; border-radius: 10px; padding: 14px; margin-bottom: 16px; }
  .btn { display: inline-block; background: #2444ca; color: #fff8e8; font-weight: 700; text-decoration: none; padding: 10px 18px; border-radius: 8px; border: 1px solid #15130f; margin-right: 8px; }
  .btn-alt { display: inline-block; background: #fff8e8; color: #15130f; font-weight: 700; text-decoration: none; padding: 10px 18px; border-radius: 8px; border: 1px solid #15130f; }
</style>
</head>
<body>
  <div class="card">
    <div class="badge">${escapeHtml(ruleLabel)} · ${escapeHtml(opp.category)}</div>
    <h1 class="title">${escapeHtml(cleanTitle)}</h1>
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

    <div style="margin-top: 24px; border-top: 2px solid #15130f; padding-top: 16px;">
      ${opp.application_url ? `<a href="${escapeHtml(opp.application_url)}" class="btn">Go to Submission Portal →</a>` : ''}
      <a href="https://abodid.com/opportunities" class="btn-alt">View in Desk ↗</a>
    </div>
  </div>
</body>
</html>
    `;
}

/**
 * Builds weekly/daily opportunity digest email.
 */
export function buildDigestEmailHtml(
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
                ${escapeHtml(formatOpportunityTitle(opp.title))}
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
    const resendKey = (typeof import.meta !== 'undefined' && import.meta.env?.RESEND_API_KEY) || process.env.RESEND_API_KEY;
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
                    const subject = `[${rule.label}] ${formatOpportunityTitle(opp.title)} (${opp.organisation})`;

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
    const resendKey = (typeof import.meta !== 'undefined' && import.meta.env?.RESEND_API_KEY) || process.env.RESEND_API_KEY;
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

/**
 * Builds standard rich HTML email template for nightly closest opportunity deadline briefing.
 */
export function buildClosestDeadlineEmailHtml(
    closestOpp: Opportunity,
    upcomingQueue: Opportunity[] = []
): string {
    const targetDateIso = closestOpp.deadline_at || closestOpp.event_date;
    const formattedDate = targetDateIso ? new Date(targetDateIso).toLocaleDateString('en-GB', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    }) : 'Unspecified';
    const timeRemaining = targetDateIso ? formatTimeRemaining(targetDateIso) : '';
    const cleanTitle = formatOpportunityTitle(closestOpp.title);

    const reqsHtml = (closestOpp.requirements && closestOpp.requirements.length > 0)
        ? closestOpp.requirements.map(r => `<li style="margin-bottom: 5px; color: #15130f;">${escapeHtml(r)}</li>`).join('')
        : '<li style="color: #666;">Standard portfolio/proposal prerequisites</li>';

    const queueHtml = upcomingQueue.length > 0 ? `
    <div style="margin-top: 24px; padding-top: 18px; border-top: 1.5px dashed rgba(21,19,15,0.25);">
      <div style="font-size: 12px; font-weight: 800; text-transform: uppercase; color: #5524c7; letter-spacing: 0.04em; margin-bottom: 12px;">
        Next in Pipeline (${upcomingQueue.length})
      </div>
      ${upcomingQueue.map(opp => {
        const dIso = opp.deadline_at || opp.event_date;
        const dStr = dIso ? new Date(dIso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : 'Rolling';
        const rem = dIso ? formatTimeRemaining(dIso) : '';
        return `
        <div style="background: #ffffff; border: 1.5px solid #15130f; border-radius: 8px; padding: 10px 14px; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center;">
          <div>
            <div style="font-size: 13px; font-weight: 700; color: #15130f;">${escapeHtml(formatOpportunityTitle(opp.title))}</div>
            <div style="font-size: 11px; color: #666;">${escapeHtml(opp.organisation)} · <span style="text-transform: capitalize;">${escapeHtml(opp.category)}</span></div>
          </div>
          <div style="text-align: right; font-size: 12px; font-weight: 700; color: #5524c7; white-space: nowrap; margin-left: 12px;">
            ${escapeHtml(dStr)}<br><span style="font-size: 10px; color: #777;">${escapeHtml(rem)}</span>
          </div>
        </div>
        `;
      }).join('')}
    </div>
    ` : '';

    return `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background: #fff8e8; margin: 0; padding: 24px; color: #15130f; }
  .card { max-width: 600px; margin: 0 auto; background: #ffffff; border: 2.5px solid #15130f; border-radius: 16px; padding: 26px; box-shadow: 5px 5px 0px #15130f; }
  .badge { display: inline-block; background: #ffe44f; color: #15130f; padding: 5px 12px; font-weight: 800; font-size: 12px; border-radius: 6px; text-transform: uppercase; border: 1.5px solid #15130f; margin-bottom: 14px; letter-spacing: 0.03em; }
  .title { font-size: 22px; font-weight: 800; line-height: 1.25; margin: 0 0 6px; color: #15130f; letter-spacing: -0.015em; }
  .org { font-size: 15px; font-weight: 600; color: #5524c7; margin: 0 0 18px; }
  .deadline-box { background: #fff8e8; border: 1.5px solid #15130f; border-radius: 10px; padding: 14px 16px; margin-bottom: 16px; box-shadow: 2px 2px 0px #15130f; }
  .deadline-label { font-size: 11px; font-weight: 800; text-transform: uppercase; color: #666; letter-spacing: 0.04em; margin-bottom: 4px; }
  .deadline-val { font-size: 17px; font-weight: 800; color: #15130f; }
  .action-box { background: #ffe44f; border: 2px solid #15130f; border-radius: 10px; padding: 14px 16px; margin-bottom: 16px; }
  .btn-primary { display: inline-block; background: #2444ca; color: #fff8e8 !important; font-weight: 700; text-decoration: none; padding: 10px 18px; border-radius: 8px; border: 1.5px solid #15130f; margin-right: 8px; }
  .btn-secondary { display: inline-block; background: #ffffff; color: #15130f !important; font-weight: 700; text-decoration: none; padding: 10px 18px; border-radius: 8px; border: 1.5px solid #15130f; }
</style>
</head>
<body>
  <div class="card">
    <div class="badge">⏳ Closest Upcoming Deadline · ${escapeHtml(closestOpp.category.toUpperCase())}</div>
    <h1 class="title">${escapeHtml(cleanTitle)}</h1>
    <div class="org">${escapeHtml(closestOpp.organisation)}</div>

    <div class="deadline-box">
      <div class="deadline-label">Application Deadline</div>
      <div class="deadline-val">📅 ${escapeHtml(formattedDate)} · <span style="color: #b91c1c;">${escapeHtml(timeRemaining)}</span></div>
    </div>

    ${closestOpp.next_action ? `
    <div class="action-box">
      <div class="deadline-label" style="color: #15130f;">Next Immediate Action</div>
      <div style="font-size: 15px; font-weight: 700; color: #15130f;">🎯 ${escapeHtml(closestOpp.next_action)}</div>
    </div>` : ''}

    ${closestOpp.summary ? `
    <div style="background: #f8fafc; border: 1px solid rgba(21,19,15,0.15); border-radius: 8px; padding: 12px 14px; margin-bottom: 16px; font-size: 13px; color: #333; line-height: 1.5;">
      <strong>Brief Summary:</strong> ${escapeHtml(closestOpp.summary)}
    </div>` : ''}

    <div style="background: #fff8e8; border: 1px solid rgba(21,19,15,0.2); border-radius: 8px; padding: 12px 14px; margin-bottom: 18px;">
      <div class="deadline-label">Requirements & Eligibility</div>
      <ul style="margin: 6px 0 0 0; padding-left: 20px; font-size: 13px;">
        ${reqsHtml}
      </ul>
    </div>

    <div style="margin-top: 18px;">
      ${closestOpp.application_url ? `<a href="${escapeHtml(closestOpp.application_url)}" class="btn-primary" target="_blank">Apply Now ↗</a>` : ''}
      <a href="https://abodid.com/opportunities" class="btn-secondary" target="_blank">Open Opportunities Radar ↗</a>
    </div>

    ${queueHtml}
  </div>
</body>
</html>
    `;
}

/**
 * Deterministically generates and sends the nightly closest deadline digest email.
 * Sends exactly 1 email focusing on the single closest upcoming opportunity deadline.
 */
export async function sendNightlyClosestDeadlineDigest(customRecipient?: string): Promise<{
    success: boolean;
    oppTitle?: string;
    recipient?: string;
    deadlineFormatted?: string;
    error?: string;
}> {
    const resendKey = (typeof import.meta !== 'undefined' && import.meta.env?.RESEND_API_KEY) || process.env.RESEND_API_KEY;
    const recipient = customRecipient || RECIPIENT_EMAIL;

    if (!resendKey || !recipient) {
        return { success: false, error: 'Missing RESEND_API_KEY or recipient email' };
    }

    const supabase = createSupabaseServiceClient();
    if (!supabase) {
        return { success: false, error: 'Missing Supabase service client' };
    }

    const now = Date.now();

    // Fetch active actionable opportunities
    const { data: opportunities, error } = await supabase
        .from('opportunities')
        .select('*')
        .in('status', ['inbox', 'interested', 'preparing', 'registered', 'attending']);

    if (error || !opportunities || opportunities.length === 0) {
        return { success: false, error: error?.message || 'No active opportunities found' };
    }

    // Filter and sort by closest future deadline
    const upcomingWithDeadlines = (opportunities as Opportunity[])
        .filter(opp => opp.deadline_at && new Date(opp.deadline_at).getTime() >= now)
        .sort((a, b) => new Date(a.deadline_at!).getTime() - new Date(b.deadline_at!).getTime());

    if (upcomingWithDeadlines.length === 0) {
        return { success: true, error: 'No upcoming deadlines remaining on radar' };
    }

    const closestOpp = upcomingWithDeadlines[0];
    const upcomingQueue = upcomingWithDeadlines.slice(1, 5);

    const timeRemaining = formatTimeRemaining(closestOpp.deadline_at!);
    const cleanTitle = formatOpportunityTitle(closestOpp.title);

    const emailHtml = buildClosestDeadlineEmailHtml(closestOpp, upcomingQueue);
    const resend = new Resend(resendKey);

    const { error: sendError } = await resend.emails.send({
        from: SENDER_EMAIL,
        to: recipient,
        subject: `⏳ Urgent Deadline: ${cleanTitle} (${timeRemaining})`,
        html: emailHtml,
    });

    if (sendError) {
        return { success: false, error: sendError.message };
    }

    return {
        success: true,
        oppTitle: cleanTitle,
        recipient,
        deadlineFormatted: `${new Date(closestOpp.deadline_at!).toLocaleDateString('en-GB')} (${timeRemaining})`,
    };
}
