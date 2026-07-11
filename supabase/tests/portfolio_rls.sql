-- Run against a disposable or staging database after applying portfolio migrations.
begin;
set local role anon;

do $$
begin
  if exists (
    select 1 from public.portfolio_project_revisions r
    join public.portfolio_projects p on p.draft_revision_id = r.id
    where r.state = 'draft'
  ) then
    raise exception 'RLS failure: anonymous role can read a draft revision';
  end if;
end $$;

do $$
begin
  begin
    insert into public.portfolio_projects(slug, storage_folder) values ('rls-must-fail', 'rls-must-fail');
    raise exception 'RLS failure: anonymous role inserted a project';
  exception when insufficient_privilege then
    null;
  end;
end $$;

rollback;

