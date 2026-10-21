import type { Opportunity } from './types';

const ABSOLUTE_URL_PATTERN = /https?:\/\/[^\s<>()\[\]{}"']+/gi;

export type UnifiedOpportunityInputKind = 'url' | 'text' | 'attachments' | 'mixed';

export type OpportunityInputDraft = {
    title?: string;
    organisation?: string;
    category?: Opportunity['category'];
    deadline?: string;
    timezone?: string;
    event_date?: string | null;
    location?: string;
    requirements?: string[];
    next_action?: string;
    application_url?: string;
    fee_or_funding?: string;
    application_fee?: string;
    summary?: string;
};

const trimUrlPunctuation = (value: string) => value.replace(/[.,;:!?]+$/, '');

export const extractOpportunityUrls = (value: string) => (
    value.match(ABSOLUTE_URL_PATTERN)?.map(trimUrlPunctuation) || []
);

export const isUrlOnlyOpportunityInput = (value: string) => {
    const trimmed = value.trim();
    const urls = extractOpportunityUrls(trimmed);
    if (urls.length !== 1 || urls[0] !== trimmed) return false;

    try {
        const parsed = new URL(trimmed);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
        return false;
    }
};

export const classifyUnifiedOpportunityInput = (
    value: string,
    attachmentCount: number,
): UnifiedOpportunityInputKind => {
    const hasText = value.trim().length > 0;
    if (attachmentCount > 0 && hasText) return 'mixed';
    if (attachmentCount > 0) return 'attachments';
    if (isUrlOnlyOpportunityInput(value)) return 'url';
    return 'text';
};

export const normalizeOpportunityMatchValue = (value: string | null | undefined) => (
    value || ''
).normalize('NFKC').toLocaleLowerCase('en').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

export const findOpportunityDataDuplicate = (
    candidates: Opportunity[],
    proposed: Pick<Opportunity, 'title' | 'organisation'> & Partial<Pick<Opportunity, 'deadline_at'>>,
) => {
    const title = normalizeOpportunityMatchValue(proposed.title);
    const organisation = normalizeOpportunityMatchValue(proposed.organisation);
    const deadlineDay = proposed.deadline_at?.slice(0, 10) || '';

    if (!title) return null;
    return candidates.find((candidate) => {
        if (normalizeOpportunityMatchValue(candidate.title) !== title) return false;
        const sameOrganisation = organisation.length > 0
            && normalizeOpportunityMatchValue(candidate.organisation) === organisation;
        const sameDeadline = deadlineDay.length > 0 && candidate.deadline_at?.slice(0, 10) === deadlineDay;
        return sameOrganisation || sameDeadline;
    }) || null;
};

export const buildExtractedOpportunityPayload = ({
    draft,
    input,
    directEntryId,
}: {
    draft: OpportunityInputDraft;
    input: string;
    directEntryId: string;
}) => {
    const inputUrl = extractOpportunityUrls(input)[0];
    const sourceUrl = inputUrl || draft.application_url || `https://direct.entry/opportunity/${directEntryId}`;

    return {
        title: draft.title || 'Untitled Opportunity',
        organisation: draft.organisation || 'Independent / Direct',
        category: draft.category || 'other',
        source_url: sourceUrl,
        status: 'reviewing',
        is_high_priority: false,
        deadline: draft.deadline || '',
        timezone: draft.timezone || '',
        event_date: draft.event_date || '',
        location: draft.location || '',
        requirements: draft.requirements || [],
        next_action: draft.next_action || '',
        application_url: draft.application_url || '',
        fee_or_funding: draft.fee_or_funding || '',
        application_fee: draft.application_fee || '',
        summary: draft.summary || '',
        notes: input.trim().slice(0, 20_000),
        reminder_at_target: /\bremind\s+me\b/i.test(input),
    };
};
