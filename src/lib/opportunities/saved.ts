import type { Opportunity } from './types';

export type SavedOpportunityRow = {
    id: string;
    user_id: string;
    title: string;
    source_url: string;
    canonical_url: string;
    deadline_at: string | null;
    status: Opportunity['status'];
    priority: number;
    outcome: Opportunity['outcome'];
    content: Record<string, unknown> | null;
    notes: string | null;
    created_at: string;
    updated_at: string;
};

const nullableString = (value: unknown): string | null =>
    typeof value === 'string' && value.length > 0 ? value : null;

export const savedRowToOpportunity = (row: SavedOpportunityRow): Opportunity => {
    const content = row.content || {};
    const requirements = Array.isArray(content.requirements)
        ? content.requirements.filter((value): value is string => typeof value === 'string')
        : [];
    const completedRequirements = Array.isArray(content.completed_requirements)
        ? content.completed_requirements.filter((value): value is string => (
            typeof value === 'string' && requirements.includes(value)
        ))
        : [];

    return {
        id: row.id,
        title: row.title,
        organisation: nullableString(content.organisation) || 'Independent / Direct',
        category: (nullableString(content.category) || 'other') as Opportunity['category'],
        source_url: row.source_url,
        canonical_url: row.canonical_url,
        deadline_at: row.deadline_at,
        deadline_raw: nullableString(content.deadline_raw),
        deadline_timezone: nullableString(content.deadline_timezone),
        deadline_confidence: (nullableString(content.deadline_confidence) || 'needs_verification') as Opportunity['deadline_confidence'],
        event_date: nullableString(content.event_date),
        location: nullableString(content.location),
        requirements,
        completed_requirements: completedRequirements,
        next_action: nullableString(content.next_action),
        application_url: nullableString(content.application_url),
        meeting_url: nullableString(content.meeting_url),
        fee_or_funding: nullableString(content.fee_or_funding),
        application_fee: nullableString(content.application_fee),
        summary: nullableString(content.summary),
        status: row.status,
        outcome: row.outcome,
        created_at: row.created_at,
        updated_at: row.updated_at,
        extracted_at: nullableString(content.extracted_at) || row.created_at,
        source_hash: nullableString(content.source_hash),
        llm_model: nullableString(content.llm_model),
        llm_extraction_count: Number(content.llm_extraction_count) || 0,
        notes: row.notes,
        priority: row.priority,
    };
};

export const opportunityToSavedInsert = (userId: string, opportunity: Partial<Opportunity> & Pick<Opportunity, 'title' | 'source_url' | 'canonical_url'>) => ({
    user_id: userId,
    title: opportunity.title,
    source_url: opportunity.source_url,
    canonical_url: opportunity.canonical_url,
    deadline_at: opportunity.deadline_at || null,
    status: opportunity.status || 'inbox',
    priority: Math.min(3, Math.max(1, Number(opportunity.priority) || 1)),
    outcome: opportunity.outcome || null,
    notes: opportunity.notes || null,
    content: {
        organisation: opportunity.organisation || 'Independent / Direct',
        category: opportunity.category || 'other',
        deadline_raw: opportunity.deadline_raw || null,
        deadline_timezone: opportunity.deadline_timezone || null,
        deadline_confidence: opportunity.deadline_confidence || 'needs_verification',
        event_date: opportunity.event_date || null,
        location: opportunity.location || null,
        requirements: opportunity.requirements || [],
        completed_requirements: opportunity.completed_requirements || [],
        next_action: opportunity.next_action || null,
        application_url: opportunity.application_url || null,
        meeting_url: opportunity.meeting_url || null,
        fee_or_funding: opportunity.fee_or_funding || null,
        application_fee: opportunity.application_fee || null,
        summary: opportunity.summary || null,
        extracted_at: opportunity.extracted_at || new Date().toISOString(),
        source_hash: opportunity.source_hash || null,
        llm_model: opportunity.llm_model || null,
        llm_extraction_count: opportunity.llm_extraction_count || 0,
    },
});

export const PUBLIC_SAVED_SELECT = 'id, title, source_url, canonical_url, deadline_at, content, created_at, updated_at';
export const PRIVATE_SAVED_SELECT = 'id, user_id, title, source_url, canonical_url, deadline_at, status, priority, outcome, content, notes, created_at, updated_at';
