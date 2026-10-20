import { describe, expect, it } from 'vitest';
import { sortRadarOpportunities } from '../../src/lib/opportunities/sorting';
import type { Opportunity } from '../../src/lib/opportunities/types';

const opportunity = (
    id: string,
    createdAt: string,
    deadlineAt: string | null,
): Opportunity => ({
    id,
    title: id,
    organisation: 'Test organisation',
    category: 'other',
    source_url: `https://example.com/${id}`,
    canonical_url: `https://example.com/${id}`,
    deadline_at: deadlineAt,
    deadline_raw: null,
    deadline_timezone: null,
    deadline_confidence: deadlineAt ? 'exact' : 'none',
    event_date: null,
    location: null,
    requirements: [],
    completed_requirements: [],
    next_action: null,
    application_url: null,
    meeting_url: null,
    fee_or_funding: null,
    application_fee: null,
    summary: null,
    status: 'reviewing',
    outcome: null,
    created_at: createdAt,
    updated_at: createdAt,
    extracted_at: createdAt,
    source_hash: null,
    llm_model: null,
    llm_extraction_count: 0,
    notes: null,
    is_high_priority: false,
});

describe('Opportunity radar sorting', () => {
    const now = Date.parse('2026-10-16T00:00:00.000Z');
    const olderUrgent = opportunity(
        'older-urgent',
        '2026-10-01T00:00:00.000Z',
        '2026-10-17T00:00:00.000Z',
    );
    const newerLater = opportunity(
        'newer-later',
        '2026-10-15T00:00:00.000Z',
        '2026-12-01T00:00:00.000Z',
    );

    it('sorts Supabase created_at timestamps newest first for Date Added', () => {
        expect(sortRadarOpportunities([olderUrgent, newerLater], 'date_added', now).map(({ id }) => id))
            .toEqual(['newer-later', 'older-urgent']);
    });

    it('preserves deadline urgency as an alternate sort', () => {
        expect(sortRadarOpportunities([newerLater, olderUrgent], 'deadline', now).map(({ id }) => id))
            .toEqual(['older-urgent', 'newer-later']);
    });
});
