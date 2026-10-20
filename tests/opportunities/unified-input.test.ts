import { describe, expect, it } from 'vitest';

import {
    buildExtractedOpportunityPayload,
    classifyUnifiedOpportunityInput,
    extractOpportunityUrls,
    findOpportunityDataDuplicate,
    isUrlOnlyOpportunityInput,
} from '../../src/lib/opportunities/unifiedInput';
import type { Opportunity } from '../../src/lib/opportunities/types';

const opportunity = (overrides: Partial<Opportunity> = {}): Opportunity => ({
    id: 'existing',
    title: 'Creative Research Fellowship',
    organisation: 'Example Arts Foundation',
    category: 'fellowship',
    source_url: 'https://example.org/fellowship',
    canonical_url: 'https://example.org/fellowship',
    deadline_at: '2027-01-15T00:00:00.000Z',
    deadline_raw: '2027-01-15',
    deadline_timezone: 'UTC',
    deadline_confidence: 'date_only',
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
    created_at: '2026-10-20T00:00:00.000Z',
    updated_at: '2026-10-20T00:00:00.000Z',
    extracted_at: '2026-10-20T00:00:00.000Z',
    source_hash: null,
    llm_model: null,
    llm_extraction_count: 0,
    notes: null,
    is_high_priority: false,
    ...overrides,
});

describe('unified opportunity input', () => {
    it('routes only a standalone HTTP URL through URL capture', () => {
        expect(isUrlOnlyOpportunityInput(' https://example.org/open-call ')).toBe(true);
        expect(isUrlOnlyOpportunityInput('Apply here https://example.org/open-call')).toBe(false);
        expect(classifyUnifiedOpportunityInput('https://example.org/open-call', 0)).toBe('url');
        expect(classifyUnifiedOpportunityInput('Remember to apply next week', 0)).toBe('text');
    });

    it('treats attachments plus optional notes as one combined submission', () => {
        expect(classifyUnifiedOpportunityInput('', 2)).toBe('attachments');
        expect(classifyUnifiedOpportunityInput('The deadline is Friday', 2)).toBe('mixed');
    });

    it('extracts the first embedded URL and preserves the submitted note', () => {
        const input = 'Priority lead: https://example.org/call, prepare a short proposal.';
        expect(extractOpportunityUrls(input)).toEqual(['https://example.org/call']);
        expect(buildExtractedOpportunityPayload({
            draft: { title: 'Example Call', organisation: 'Example' },
            input,
            directEntryId: 'abc',
        })).toMatchObject({
            source_url: 'https://example.org/call',
            notes: input,
        });
    });

    it('matches duplicates using normalized title and organisation or deadline', () => {
        const candidates = [opportunity()];
        expect(findOpportunityDataDuplicate(candidates, {
            title: ' creative—research fellowship ',
            organisation: 'EXAMPLE ARTS FOUNDATION',
        })?.id).toBe('existing');
        expect(findOpportunityDataDuplicate(candidates, {
            title: 'Creative Research Fellowship',
            organisation: 'A different host',
            deadline_at: '2027-01-15T18:00:00.000Z',
        })?.id).toBe('existing');
        expect(findOpportunityDataDuplicate(candidates, {
            title: 'A different fellowship',
            organisation: 'Example Arts Foundation',
        })).toBeNull();
    });
});
