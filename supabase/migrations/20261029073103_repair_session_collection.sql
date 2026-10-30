begin;

-- The deployed batched collector already writes these fields. Some databases
-- received confidence columns without the earlier revenue-intelligence migration.
alter table public.analytics_sessions
  add column if not exists intent_category text,
  add column if not exists intent_score integer default 0,
  add column if not exists is_returning boolean default false,
  add column if not exists converted boolean default false,
  add column if not exists conversion_type text,
  add column if not exists friction_flags jsonb default '[]'::jsonb,
  add column if not exists events jsonb default '[]'::jsonb,
  add column if not exists replay_data jsonb,
  add column if not exists device_type text,
  add column if not exists device_label text;

-- Existing RLS, grants, records, and historical qualification labels are preserved.
commit;
