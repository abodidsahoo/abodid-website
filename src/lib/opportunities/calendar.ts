import type { Opportunity } from './types';

/**
 * Formats a Date object to iCalendar UTC string format: YYYYMMDDTHHmmssZ
 */
export function formatIcsDate(date: Date): string {
    return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

/**
 * Escapes text for iCalendar format.
 */
function escapeIcsText(text: string): string {
    return (text || '')
        .replace(/\\/g, '\\\\')
        .replace(/;/g, '\\;')
        .replace(/,/g, '\\,')
        .replace(/\n/g, '\\n');
}

/**
 * Generates an RFC 5545 `.ics` file content for an opportunity deadline or event.
 */
export function generateIcsFile(opp: Opportunity, mode: 'deadline' | 'event' = 'deadline'): string {
    const isDeadline = mode === 'deadline';
    const targetDateStr = isDeadline ? opp.deadline_at : (opp.event_date || opp.deadline_at);
    const startDate = targetDateStr ? new Date(targetDateStr) : new Date();

    // Set end date to 1 hour after start date for events, or same time for deadlines
    const endDate = new Date(startDate.getTime() + (isDeadline ? 30 * 60 * 1000 : 60 * 60 * 1000));
    const nowStr = formatIcsDate(new Date());
    const startStr = formatIcsDate(startDate);
    const endStr = formatIcsDate(endDate);

    const titlePrefix = isDeadline ? '[DEADLINE]' : '[EVENT]';
    const summary = `${titlePrefix} ${opp.title} (${opp.organisation})`;

    const descriptionLines = [
        `Opportunity: ${opp.title}`,
        `Organisation: ${opp.organisation}`,
        `Category: ${opp.category}`,
        opp.next_action ? `Next Action: ${opp.next_action}` : '',
        opp.requirements?.length ? `Needs: ${opp.requirements.join('; ')}` : '',
        opp.application_url ? `Application URL: ${opp.application_url}` : '',
        opp.source_url ? `Source: ${opp.source_url}` : '',
        opp.meeting_url ? `Meeting URL: ${opp.meeting_url}` : '',
        opp.summary ? `Summary: ${opp.summary}` : '',
    ].filter(Boolean).join('\n');

    const location = opp.meeting_url || opp.location || opp.application_url || opp.source_url || '';

    return [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Abodid Personal Site//Opportunity Desk//EN',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
        'BEGIN:VEVENT',
        `UID:opp-${opp.id}-${mode}@abodid.com`,
        `DTSTAMP:${nowStr}`,
        `DTSTART:${startStr}`,
        `DTEND:${endStr}`,
        `SUMMARY:${escapeIcsText(summary)}`,
        `DESCRIPTION:${escapeIcsText(descriptionLines)}`,
        location ? `LOCATION:${escapeIcsText(location)}` : '',
        opp.application_url ? `URL:${opp.application_url}` : (opp.source_url ? `URL:${opp.source_url}` : ''),
        // Alarm: 24 hours before
        'BEGIN:VALARM',
        'TRIGGER:-PT24H',
        'ACTION:DISPLAY',
        `DESCRIPTION:Reminder: ${escapeIcsText(summary)}`,
        'END:VALARM',
        // Alarm: 3 hours before
        'BEGIN:VALARM',
        'TRIGGER:-PT3H',
        'ACTION:DISPLAY',
        `DESCRIPTION:Urgent Reminder: ${escapeIcsText(summary)}`,
        'END:VALARM',
        'END:VEVENT',
        'END:VCALENDAR',
    ].filter(Boolean).join('\r\n');
}

/**
 * Generates a direct Google Calendar web URL.
 */
export function generateGoogleCalendarUrl(opp: Opportunity, mode: 'deadline' | 'event' = 'deadline'): string {
    const isDeadline = mode === 'deadline';
    const targetDateStr = isDeadline ? opp.deadline_at : (opp.event_date || opp.deadline_at);
    const startDate = targetDateStr ? new Date(targetDateStr) : new Date();
    const endDate = new Date(startDate.getTime() + (isDeadline ? 30 * 60 * 1000 : 60 * 60 * 1000));

    const startStr = formatIcsDate(startDate);
    const endStr = formatIcsDate(endDate);

    const titlePrefix = isDeadline ? '[DEADLINE]' : '[EVENT]';
    const title = `${titlePrefix} ${opp.title} (${opp.organisation})`;

    const details = [
        opp.next_action ? `Next Action: ${opp.next_action}` : '',
        opp.requirements?.length ? `Needs: ${opp.requirements.join(' · ')}` : '',
        opp.application_url ? `Apply: ${opp.application_url}` : '',
        opp.source_url ? `Source: ${opp.source_url}` : '',
        opp.summary || '',
    ].filter(Boolean).join('\n\n');

    const location = opp.meeting_url || opp.location || opp.application_url || opp.source_url || '';

    const params = new URLSearchParams({
        action: 'TEMPLATE',
        text: title,
        dates: `${startStr}/${endStr}`,
        details,
        location,
    });

    return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
