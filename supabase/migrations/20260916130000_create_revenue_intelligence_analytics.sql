begin;

-- Enhance analytics_sessions with commercial revenue and intelligence columns
alter table public.analytics_sessions
  add column if not exists intent_category text,
  add column if not exists intent_score integer default 0,
  add column if not exists is_returning boolean default false,
  add column if not exists converted boolean default false,
  add column if not exists conversion_type text,
  add column if not exists friction_flags jsonb default '[]'::jsonb,
  add column if not exists events jsonb default '[]'::jsonb,
  add column if not exists replay_data jsonb;

create index if not exists analytics_sessions_intent_category_idx
  on public.analytics_sessions (intent_category, started_at desc);

create index if not exists analytics_sessions_converted_idx
  on public.analytics_sessions (converted, started_at desc)
  where converted = true;

create index if not exists analytics_sessions_visitor_journey_idx
  on public.analytics_sessions (visitor_id, started_at asc);

commit;
