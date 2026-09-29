begin;

alter table public.analytics_sessions
  add column if not exists human_confidence_score smallint not null default 0
    check (human_confidence_score between 0 and 100),
  add column if not exists human_confidence_tier text not null default 'filtered'
    check (human_confidence_tier in ('filtered', 'meaningful', 'high_intent', 'exceptional')),
  add column if not exists human_signals jsonb not null default '{}'::jsonb;

create index if not exists analytics_sessions_human_confidence_idx
  on public.analytics_sessions (human_confidence_tier, started_at desc);

alter table public.contact_submissions
  add column if not exists lead_quality_status text not null default 'unreviewed'
    check (lead_quality_status in ('unreviewed', 'qualified', 'unqualified', 'won', 'lost', 'spam')),
  add column if not exists lead_quality_updated_at timestamptz;

create index if not exists contact_submissions_lead_quality_idx
  on public.contact_submissions (lead_quality_status, submitted_at desc);

comment on column public.analytics_sessions.human_confidence_score is
  'Deterministic 0-100 score derived from batched active-time, scroll, click, input, page, and content signals.';
comment on column public.analytics_sessions.human_confidence_tier is
  'Dashboard qualification tier. Passive and bot-like visits remain filtered.';
comment on column public.analytics_sessions.human_signals is
  'Small aggregate signal summary. No raw IP address, pointer trail, name, or email is stored here.';
comment on column public.contact_submissions.lead_quality_status is
  'Owner feedback used to compare acquisition and journey signals with actual lead quality.';

commit;
