import { z } from 'zod';

export const OpportunityCategorySchema = z.enum([
    'job',
    'open_call',
    'residency',
    'conference',
    'event',
    'grant',
    'fellowship',
    'other',
]);

export type OpportunityCategory = z.infer<typeof OpportunityCategorySchema>;

export const OpportunityStatusSchema = z.enum([
    'inbox',
    'interested',
    'preparing',
    'submitted',
    'registered',
    'attending',
    'done',
    'dismissed',
]);

export type OpportunityStatus = z.infer<typeof OpportunityStatusSchema>;

export const OpportunityOutcomeSchema = z.enum([
    'accepted',
    'rejected',
    'attended',
    'withdrawn',
    'expired',
    'unknown',
]).nullable().optional();

export type OpportunityOutcome = z.infer<typeof OpportunityOutcomeSchema>;

export const DeadlineConfidenceSchema = z.enum([
    'exact',
    'date_only',
    'estimated',
    'needs_verification',
    'none',
    'rolling',
]);

export type DeadlineConfidence = z.infer<typeof DeadlineConfidenceSchema>;

export interface Opportunity {
    id: string;
    title: string;
    organisation: string;
    category: OpportunityCategory;
    source_url: string;
    canonical_url: string;
    deadline_at: string | null;
    deadline_raw: string | null;
    deadline_timezone: string | null;
    deadline_confidence: DeadlineConfidence;
    event_date: string | null;
    location: string | null;
    requirements: string[];
    next_action: string | null;
    application_url: string | null;
    meeting_url: string | null;
    fee_or_funding: string | null;
    summary: string | null;
    status: OpportunityStatus;
    outcome: OpportunityOutcome;
    created_at: string;
    updated_at: string;
    extracted_at: string;
    source_hash: string | null;
    llm_model: string | null;
    llm_extraction_count: number;
    notes: string | null;
}

export const LLMExtractionOutputSchema = z.object({
    title: z.string().default('Untitled Opportunity'),
    organisation: z.string().default('Unknown Organisation'),
    category: z.string().transform((val) => {
        const normalized = val?.toLowerCase().trim().replace(/[- ]+/g, '_');
        if (OpportunityCategorySchema.safeParse(normalized).success) {
            return normalized as OpportunityCategory;
        }
        return 'other' as OpportunityCategory;
    }),
    deadline: z.string().nullable().optional(),
    timezone: z.string().nullable().optional(),
    event_date: z.string().nullable().optional(),
    location: z.string().nullable().optional(),
    requirements: z.array(z.string()).default([]),
    next_action: z.string().nullable().optional(),
    application_url: z.string().nullable().optional(),
    meeting_url: z.string().nullable().optional(),
    fee_or_funding: z.string().nullable().optional(),
    summary: z.string().nullable().optional(),
});

export type LLMExtractionOutput = z.infer<typeof LLMExtractionOutputSchema>;

export interface CapturePayload {
    url?: string;
    title?: string;
    page_text?: string;
    password?: string;
}

export interface NotificationLogEntry {
    id: string;
    opportunity_id: string;
    notification_type: string;
    scheduled_for: string;
    sent_at: string;
    status: string;
}

export interface OpportunityEvent {
    id: string;
    opportunity_id: string | null;
    event_type: string;
    metadata: Record<string, any>;
    created_at: string;
}
