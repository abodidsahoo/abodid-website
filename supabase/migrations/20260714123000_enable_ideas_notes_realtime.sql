-- Keep the admin Notepad view synchronized with direct database changes.
-- Realtime continues to honour the existing SELECT policy on ideas_notes.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'ideas_notes'
    ) then
      execute 'alter publication supabase_realtime add table public.ideas_notes';
    end if;
  end if;
end;
$$;
