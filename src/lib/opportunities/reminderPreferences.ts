export const DEFAULT_REMINDER_OFFSETS = [1440, 120, 30] as const;

export const reminderOffsetsFromContent = (content: Record<string, unknown>) => {
    const configured = Array.isArray(content.reminder_offsets_minutes)
        ? content.reminder_offsets_minutes
            .map(Number)
            .filter((value) => Number.isInteger(value) && value >= 0 && value <= 525600)
        : [...DEFAULT_REMINDER_OFFSETS];
    return [...new Set(configured)];
};

export const reminderKeyboard = (
    opportunityId: string,
    content: Record<string, unknown> = {},
) => {
    const enabled = new Set(reminderOffsetsFromContent(content));
    const toggle = (minutes: number, label: string) => ({
        text: `${enabled.has(minutes) ? '✅' : '⬜'} ${label}`,
        callback_data: `opportunity:reminder:${minutes}:${opportunityId}`,
    });
    return [
        [{ text: 'Open dashboard', url: 'https://abodid.com/opportunities' }],
        [toggle(1440, '1 day'), toggle(120, '2 hours')],
        [toggle(30, '30 minutes')],
        [{ text: 'Done — stop reminders', callback_data: `opportunity:done:${opportunityId}` }],
    ];
};
