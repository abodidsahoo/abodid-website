-- Run against a disposable or staging database after applying portfolio migrations.
begin;
set local role anon;

do $$
begin
  begin
    perform content from public.portfolio_projects limit 1;
    if found then
      raise exception 'RLS failure: anonymous role can read editable project content';
    end if;
  exception when insufficient_privilege then
    null;
  end;

  begin
    perform content from public.portfolio_project_backups limit 1;
    if found then
      raise exception 'RLS failure: anonymous role can read project backups';
    end if;
  exception when insufficient_privilege then
    null;
  end;
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
