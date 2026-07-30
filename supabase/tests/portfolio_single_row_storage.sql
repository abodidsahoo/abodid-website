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
  if to_regclass('public.portfolio_project_revisions') is not null then
    raise exception 'Legacy portfolio revision table still exists';
  end if;

  select id, title, content, lock_version
  into v_project_id, v_original_title, v_original_content, v_original_lock
  from public.portfolio_projects
  where id = v_created_project_id;

  select count(*) into v_original_backup_count
  from public.portfolio_project_backups
  where project_id = v_project_id;

  v_test_content := v_original_content || jsonb_build_object(
    'title', v_original_title || ' — first publication',
    'oneLineDescription', 'Transactional storage test',
    'context', 'Does the single-row model work?',
    'specificContribution', 'Automated verification',
    'yearStart', 2026,
    'coverUrl', 'https://example.com/portfolio-storage-test.jpg'
  );
  v_next_lock := public.portfolio_save_draft(v_project_id, v_original_lock, v_test_content);
  if v_next_lock <> v_original_lock + 1 then
    raise exception 'Save did not advance the project lock';
  end if;

  v_previous_backup_id := public.portfolio_publish_project(v_project_id);
  v_test_content := jsonb_set(
    v_test_content,
    '{title}',
    to_jsonb(v_original_title || ' — second publication'),
    true
  );
  v_next_lock := public.portfolio_save_draft(v_project_id, v_next_lock, v_test_content);
  v_new_backup_id := public.portfolio_publish_project(v_project_id);
  select count(*) into v_count
  from public.portfolio_project_backups
  where project_id = v_project_id;
  if v_count <> v_original_backup_count + 2 then
    raise exception 'Two publishes did not create exactly two backups';
  end if;
  if (select published_content->>'title' from public.portfolio_projects where id = v_project_id)
      <> v_original_title || ' — second publication' then
    raise exception 'Publish did not replace the live document';
  end if;

  perform public.portfolio_restore_revision(v_project_id, v_previous_backup_id);
  if (select content->>'title' from public.portfolio_projects where id = v_project_id)
      <> v_original_title || ' — first publication' then
    raise exception 'Restore did not reopen the previous backup';
  end if;

  if v_new_backup_id is null then raise exception 'Publish did not return a backup id'; end if;
end
$test$;

rollback;
