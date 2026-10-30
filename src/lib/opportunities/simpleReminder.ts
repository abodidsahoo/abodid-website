import type { OpportunityInputDraft } from './unifiedInput';

// Intentionally narrow: only explicit, unambiguous relative durations are
// handled locally. All complex dates, recurrent events, and attached content
// continue through the existing AI extraction path.
const NUMBER_WORDS: Record<string, number> = {
    one: 1, two: 2, three: 3, four: 4, five: 5,
    six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
};

const DURATION = /\b(?:in|after)\s+(\d{1,3}|one|two|three|four|five|six|seven|eight|nine|ten)\s+(minutes?|hours?|days?)\b/i;
const REMINDER_INTENT = /\b(?:remind\s+me|reminder|set\s+(?:a\s+)?reminder)\b/i;
const AMBIGUOUS_SCHEDULE = /\b(?:tomorrow|today|tonight|next|every|weekly|monthly|morning|afternoon|evening|noon|midnight|am|pm|at\s+\d{1,2})\b/i;
const UNIT_MS: Record<string, number> = { minute: 60_000, hour: 3_600_000, day: 86_400_000 };

export const parseSimpleReminder = (
    text: string,
    capturedAt: string,
): OpportunityInputDraft | null => {
    const normalized = text.trim().replace(/\s+/g, ' ');
    if (!REMINDER_INTENT.test(normalized) || AMBIGUOUS_SCHEDULE.test(normalized)) return null;
    const duration = DURATION.exec(normalized);
    if (!duration) return null;
    const quantity = NUMBER_WORDS[duration[1].toLowerCase()] ?? Number(duration[1]);
    const unit = duration[2].toLowerCase().replace(/s$/, '');
    const unitMs = UNIT_MS[unit];
    const maxQuantity = unit === 'day' ? 365 : unit === 'hour' ? 168 : 120;
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > maxQuantity || !unitMs) return null;
    const reference = new Date(capturedAt);
    if (!Number.isFinite(reference.getTime())) return null;
    const eventDate = new Date(reference.getTime() + quantity * unitMs).toISOString();
    const subject = normalized
        .replace(DURATION, ' ')
        .replace(/\b(?:please\s+)?(?:remind\s+me|set\s+(?:a\s+)?reminder|reminder)\b/ig, ' ')
        .replace(/^(?:to|about|for|of)\b/i, ' ')
        .replace(/\s+/g, ' ')
        .replace(/^[\s,.:;!?-]+|[\s,.:;!?-]+$/g, '')
        .slice(0, 180) || 'Personal reminder';
    return {
        title: subject,
        organisation: 'Personal',
        category: 'event',
        event_date: eventDate,
        summary: `Reminder: ${subject}. Scheduled relative to when it was submitted.`,
    };
};
