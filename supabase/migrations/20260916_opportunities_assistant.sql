-- Migration: Opportunities Assistant
-- Tables: opportunities, notification_log, opportunity_events

-- 1. Create opportunities table
CREATE TABLE IF NOT EXISTS public.opportunities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    organisation TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('job', 'open_call', 'residency', 'conference', 'event', 'grant', 'fellowship', 'other')),
    source_url TEXT NOT NULL,
    canonical_url TEXT NOT NULL,
    deadline_at TIMESTAMPTZ,
    deadline_raw TEXT,
    deadline_timezone TEXT,
    deadline_confidence TEXT DEFAULT 'needs_verification' CHECK (deadline_confidence IN ('exact', 'date_only', 'estimated', 'needs_verification', 'none', 'rolling')),
    event_date TIMESTAMPTZ,
    location TEXT,
    requirements JSONB NOT NULL DEFAULT '[]'::jsonb,
    next_action TEXT,
    application_url TEXT,
    meeting_url TEXT,
    fee_or_funding TEXT,
    summary TEXT,
    status TEXT NOT NULL DEFAULT 'inbox' CHECK (status IN ('inbox', 'interested', 'preparing', 'submitted', 'registered', 'attending', 'done', 'dismissed')),
    outcome TEXT CHECK (outcome IS NULL OR outcome IN ('accepted', 'rejected', 'attended', 'withdrawn', 'expired', 'unknown')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    extracted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    source_hash TEXT,
    llm_model TEXT,
    llm_extraction_count INTEGER NOT NULL DEFAULT 1,
    notes TEXT
);

-- Unique index on canonical_url to prevent duplicate ingestion
CREATE UNIQUE INDEX IF NOT EXISTS idx_opportunities_canonical_url ON public.opportunities(canonical_url);
CREATE INDEX IF NOT EXISTS idx_opportunities_deadline_at ON public.opportunities(deadline_at);
CREATE INDEX IF NOT EXISTS idx_opportunities_status ON public.opportunities(status);
CREATE INDEX IF NOT EXISTS idx_opportunities_category ON public.opportunities(category);
CREATE INDEX IF NOT EXISTS idx_opportunities_created_at ON public.opportunities(created_at DESC);

-- 2. Create notification_log table
CREATE TABLE IF NOT EXISTS public.notification_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    opportunity_id UUID NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
    notification_type TEXT NOT NULL,
    scheduled_for TIMESTAMPTZ NOT NULL,
    sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    status TEXT NOT NULL DEFAULT 'sent'
);

-- Unique constraint to guarantee zero duplicate notification emails
CREATE UNIQUE INDEX IF NOT EXISTS idx_notification_log_opp_type ON public.notification_log(opportunity_id, notification_type);
CREATE INDEX IF NOT EXISTS idx_notification_log_sent_at ON public.notification_log(sent_at DESC);

-- 3. Create opportunity_events table for lightweight event analytics
CREATE TABLE IF NOT EXISTS public.opportunity_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    opportunity_id UUID REFERENCES public.opportunities(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL CHECK (event_type IN (
        'opportunity_saved',
        'marked_interested',
        'started_preparing',
        'submitted',
        'registered',
        'attending',
        'dismissed',
        'expired_without_action',
        'manually_edited',
        're_extracted',
        'status_changed',
        'deleted'
    )),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_opportunity_events_opp_id ON public.opportunity_events(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_opportunity_events_type ON public.opportunity_events(event_type);
CREATE INDEX IF NOT EXISTS idx_opportunity_events_created_at ON public.opportunity_events(created_at DESC);

-- 4. Automatic updated_at trigger function
CREATE OR REPLACE FUNCTION public.handle_opportunities_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_opportunities_updated_at ON public.opportunities;
CREATE TRIGGER set_opportunities_updated_at
    BEFORE UPDATE ON public.opportunities
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_opportunities_updated_at();

-- 5. Row Level Security (RLS)
ALTER TABLE public.opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunity_events ENABLE ROW LEVEL SECURITY;

-- Service role has full access (used by server endpoints)
DROP POLICY IF EXISTS "Service role full access on opportunities" ON public.opportunities;
CREATE POLICY "Service role full access on opportunities" ON public.opportunities
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role' OR current_user = 'service_role');

DROP POLICY IF EXISTS "Service role full access on notification_log" ON public.notification_log;
CREATE POLICY "Service role full access on notification_log" ON public.notification_log
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role' OR current_user = 'service_role');

DROP POLICY IF EXISTS "Service role full access on opportunity_events" ON public.opportunity_events;
CREATE POLICY "Service role full access on opportunity_events" ON public.opportunity_events
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role' OR current_user = 'service_role');
