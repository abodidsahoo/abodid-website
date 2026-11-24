import { describe, expect, it } from 'vitest';
import { parseSimpleReminder } from '../../src/lib/opportunities/simpleReminder';

describe('No-AI simple reminders', () => {
    const capturedAt = '2026-10-30T18:30:00.000Z';

    it('parses a two-line birthday reminder without calling an AI provider', () => {
        const result = parseSimpleReminder('Remind me about my birthday\nafter 2 days', capturedAt);
        expect(result).toMatchObject({
            category: 'event',
            organisation: 'Personal',
            event_date: '2026-11-01T18:30:00.000Z',
        });
        expect(result?.title).toContain('birthday');
    });

    it('parses spelled-out durations and precise short intervals', () => {
        expect(parseSimpleReminder('Birthday reminder after two days', capturedAt)?.event_date)
            .toBe('2026-11-01T18:30:00.000Z');
        expect(parseSimpleReminder('Remind me to call Anna in 30 minutes', capturedAt)?.event_date)
            .toBe('2026-10-30T19:00:00.000Z');
    });

    it('does not guess ambiguous dates or recurrence', () => {
        expect(parseSimpleReminder('Remind me every two days', capturedAt)).toBeNull();
        expect(parseSimpleReminder('Remind me tomorrow morning', capturedAt)).toBeNull();
        expect(parseSimpleReminder('Birthday reminder next Friday', capturedAt)).toBeNull();
        expect(parseSimpleReminder('Two days of residency applications', capturedAt)).toBeNull();
    });

    it('rejects invalid timestamps and extreme durations', () => {
        expect(parseSimpleReminder('Reminder after 2 days', 'invalid-date')).toBeNull();
        expect(parseSimpleReminder('Reminder after 500 days', capturedAt)).toBeNull();
    });
});
