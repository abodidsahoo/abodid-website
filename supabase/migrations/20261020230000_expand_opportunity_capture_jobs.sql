-- Extend the durable capture queue to notes and temporary private attachments.

begin;

alter table public.opportunity_capture_jobs
  drop constraint if exists opportunity_capture_jobs_input_kind_check;

alter table public.opportunity_capture_jobs
  add constraint opportunity_capture_jobs_input_kind_check
  check (input_kind in ('url', 'text', 'attachments', 'mixed'));

alter table public.opportunity_capture_jobs
  drop constraint if exists opportunity_capture_jobs_status_check;

alter table public.opportunity_capture_jobs
  add constraint opportunity_capture_jobs_status_check
  check (status in ('uploading', 'pending', 'processing', 'succeeded', 'failed'));

alter table public.opportunity_capture_jobs
  add column if not exists source_cleanup_at timestamptz,
  add column if not exists source_cleaned_at timestamptz;

create index if not exists opportunity_capture_jobs_source_cleanup_idx
  on public.opportunity_capture_jobs (source_cleanup_at)
  where source_cleanup_at is not null and source_cleaned_at is null;

-- Server-side service-role code is the only reader/writer. No storage.objects
-- policy is created, so authenticated browser clients cannot access this bucket.
insert into storage.buckets (id, name, public, file_size_limit)
values (
  'opportunity-capture-files',
  'opportunity-capture-files',
  false,
  26214400
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit;

-- Source cleanup now runs inside the authenticated recovery worker so database
-- text and Storage objects are removed atomically from the same payload record.
do $$
begin
  perform cron.unschedule('opportunity-capture-payload-cleanup')
  where exists (
    select 1 from cron.job where jobname = 'opportunity-capture-payload-cleanup'
  );
end;
$$;

commit;
