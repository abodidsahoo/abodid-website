-- Migration: Add priority column to opportunities table
ALTER TABLE public.opportunities 
ADD COLUMN IF NOT EXISTS priority INTEGER NOT NULL DEFAULT 1 CHECK (priority IN (1, 2, 3));

-- Index priority for fast query sorting
CREATE INDEX IF NOT EXISTS idx_opportunities_priority ON public.opportunities(priority DESC);
