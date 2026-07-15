begin;

-- The old Supabase Storage-backed portfolio catalogue has been replaced by
-- media_assets/media_variants in Cloudflare R2. Keep the organisation logo
-- column useful by pointing it at the canonical catalogue before removing the
-- legacy table.
alter table public.portfolio_organisations
  drop constraint if exists portfolio_organisations_logo_media_fk;

alter table public.portfolio_organisations
  add constraint portfolio_organisations_logo_media_fk
  foreign key (logo_media_id) references public.media_assets(id) on delete set null;

drop policy if exists portfolio_storage_public_read on storage.objects;
drop policy if exists portfolio_storage_admin_insert on storage.objects;
drop policy if exists portfolio_storage_admin_update on storage.objects;
drop policy if exists portfolio_storage_admin_delete on storage.objects;

drop table if exists public.portfolio_media_assets;

-- The bucket itself is removed through the Storage API before this migration;
-- direct writes to storage system tables are intentionally blocked.

commit;
