-- Transactional integration check for the single-row project document model.
-- The final rollback guarantees this can run against a linked environment.
begin;

do $test$
declare
  v_admin_id uuid;
  v_created_project_id uuid;
  v_project_id uuid;
  v_original_content jsonb;
  v_test_content jsonb;
  v_original_title text;
  v_original_lock integer;
  v_original_backup_count integer;
  v_original_revision_count integer;
  v_previous_backup_id uuid;
  v_new_backup_id uuid;
  v_next_lock integer;
  v_count integer;
begin
  select id into v_admin_id
  from public.profiles
  where role = 'admin'
  limit 1;
  if v_admin_id is null then raise exception 'Test requires an admin profile'; end if;
  perform set_config('request.jwt.claim.sub', v_admin_id::text, true);

  v_created_project_id := public.portfolio_create_project('Single Row Storage Test');
  if not exists (
    select 1
    from public.portfolio_projects
    where id = v_created_project_id
      and title = 'Single Row Storage Test'
      and content->>'title' = 'Single Row Storage Test'
  ) then
    raise exception 'Create did not write a complete project row';
  end if;
  if exists (
    select 1
    from public.portfolio_project_revisions
    where project_id = v_created_project_id
  ) then
    raise exception 'Create wrote to the legacy revision table';
  end if;

  select id, title, content, lock_version
  into v_project_id, v_original_title, v_original_content, v_original_lock
  from public.portfolio_projects
  where published_content is not null
  order by published_version desc
  limit 1;
  if v_project_id is null then raise exception 'Test requires a published project'; end if;

  select count(*) into v_original_backup_count
  from public.portfolio_project_backups
  where project_id = v_project_id;
  select count(*) into v_original_revision_count
  from public.portfolio_project_revisions
  where project_id = v_project_id;
  select id into v_previous_backup_id
  from public.portfolio_project_backups
  where project_id = v_project_id
  order by version_number desc
  limit 1;

  v_test_content := jsonb_set(
    v_original_content,
    '{title}',
    to_jsonb(v_original_title || ' — storage test'),
    true
  );
  v_next_lock := public.portfolio_save_draft(v_project_id, v_original_lock, v_test_content);
  if v_next_lock <> v_original_lock + 1 then
    raise exception 'Save did not advance the project lock';
  end if;

  v_new_backup_id := public.portfolio_publish_project(v_project_id);
  select count(*) into v_count
  from public.portfolio_project_backups
  where project_id = v_project_id;
  if v_count <> v_original_backup_count + 1 then
    raise exception 'Publish did not create exactly one backup';
  end if;
  if (select published_content->>'title' from public.portfolio_projects where id = v_project_id)
      <> v_original_title || ' — storage test' then
    raise exception 'Publish did not replace the live document';
  end if;

  perform public.portfolio_restore_revision(v_project_id, v_previous_backup_id);
  if (select content->>'title' from public.portfolio_projects where id = v_project_id)
      <> v_original_title then
    raise exception 'Restore did not reopen the previous backup';
  end if;

  select count(*) into v_count
  from public.portfolio_project_revisions
  where project_id = v_project_id;
  if v_count <> v_original_revision_count then
    raise exception 'New workflow wrote to the legacy revision table';
  end if;

  if v_new_backup_id is null then raise exception 'Publish did not return a backup id'; end if;
end
$test$;

rollback;
