alter table public.brands
  add column if not exists context text not null default '';

comment on column public.brands.context is
  'Short editorial context for the work represented by this brand relationship.';
