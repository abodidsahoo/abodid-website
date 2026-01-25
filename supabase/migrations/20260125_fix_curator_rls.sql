-- Allow Curators to view all resources (including pending)
do $$
begin
  if not exists (
    select 1 from pg_policies where policyname = 'Curators can view all resources.' and tablename = 'hub_resources'
  ) then
    create policy "Curators can view all resources." on public.hub_resources
      for select using (
        exists (select 1 from public.profiles where id = auth.uid() and role = 'curator')
      );
  end if;
end
$$;

-- Allow Curators to update all resources (to approve/reject)
do $$
begin
  if not exists (
    select 1 from pg_policies where policyname = 'Curators can update all resources.' and tablename = 'hub_resources'
  ) then
    create policy "Curators can update all resources." on public.hub_resources
      for update using (
        exists (select 1 from public.profiles where id = auth.uid() and role = 'curator')
      );
  end if;
end
$$;
