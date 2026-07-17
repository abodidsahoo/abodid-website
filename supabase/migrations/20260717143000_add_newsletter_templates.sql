begin;

alter table public.newsletters
  add column if not exists template_name text,
  add column if not exists is_template boolean not null default false;

update public.newsletters
set
  is_template = true,
  template_name = coalesce(nullif(trim(subject), ''), 'Untitled newsletter format')
where status = 'draft'
  and sent_at is null
  and is_template = false;

create index if not exists newsletters_templates_updated_idx
  on public.newsletters(is_template, updated_at desc);

commit;
