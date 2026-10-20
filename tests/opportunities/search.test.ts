import { describe, expect, it } from 'vitest';
import {
    buildOpportunitySearchIndex,
    rankOpportunitySearch,
} from '../../src/lib/opportunities/search';
import type { Opportunity } from '../../src/lib/opportunities/types';

const opportunity = (overrides: Partial<Opportunity>): Opportunity => ({
    id: overrides.id || crypto.randomUUID(),
    title: 'Untitled opportunity',
    organisation: 'Independent',
    category: 'other',
    source_url: 'https://example.com/source',
    canonical_url: 'https://example.com/source',
    deadline_at: null,
    deadline_raw: null,
    deadline_timezone: null,
    deadline_confidence: 'none',
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
    created_at: '2026-10-16T00:00:00.000Z',
    updated_at: '2026-10-16T00:00:00.000Z',
    extracted_at: '2026-10-16T00:00:00.000Z',
    source_hash: null,
    llm_model: null,
    llm_extraction_count: 0,
    notes: null,
    is_high_priority: false,
    ...overrides,
});

describe('Opportunity fuzzy search', () => {
    const grant = opportunity({
        id: 'grant',
        title: 'Sustainable Arts Research Grant',
        organisation: 'Creative Futures Foundation',
        category: 'grant',
        requirements: ['Portfolio', 'Project proposal'],
        summary: 'Funding for climate-focused visual research.',
    });
    const conference = opportunity({
        id: 'conference',
        title: 'Design Futures Conference',
        organisation: 'IIT Bombay',
        category: 'conference',
        application_url: 'https://apply.iitb.ac.in/emerge',
        next_action: 'Submit a 300-word abstract.',
    });

    const search = (query: string) => {
        const opportunities = [conference, grant];
        return rankOpportunitySearch(
            opportunities,
            query,
            buildOpportunitySearchIndex(opportunities),
        ).map(({ id }) => id);
    };

    it('matches and prioritizes weighted title terms', () => {
        expect(search('arts grant')).toEqual(['grant']);
    });

    it('matches AI-extracted body fields and links', () => {
        expect(search('300 abstract')).toEqual(['conference']);
        expect(search('apply iitb')).toEqual(['conference']);
    });

    it('tolerates small spelling mistakes', () => {
        expect(search('sustianable')).toEqual(['grant']);
        expect(search('confrence')).toEqual(['conference']);
    });

    it('requires every query token to match somewhere in the opportunity', () => {
        expect(search('climate portfolio')).toEqual(['grant']);
        expect(search('climate abstract')).toEqual([]);
    });

    it('preserves the existing order for an empty query', () => {
        expect(search('')).toEqual(['conference', 'grant']);
    });
});
