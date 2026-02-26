-- Harden profile provisioning during auth signup.
-- Prevents auth/v1/signup 500 errors caused by profile constraint failures.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_username text;
  base_username text;
  candidate_username text;
  full_name_value text;
  suffix integer := 0;
begin
  requested_username := coalesce(
    nullif(trim(new.raw_user_meta_data->>'username'), ''),
    split_part(coalesce(new.email, ''), '@', 1),
    'user'
  );

  base_username := lower(regexp_replace(requested_username, '[^a-z0-9_]', '', 'g'));
  base_username := left(base_username, 24);

  if char_length(base_username) < 3 then
    base_username := 'user' || right(new.id::text, 6);
  end if;

  candidate_username := base_username;

  while exists (
    select 1
    from public.profiles
    where username = candidate_username
  ) loop
    suffix := suffix + 1;
    candidate_username := left(base_username, 24 - char_length(suffix::text)) || suffix::text;
  end loop;

  full_name_value := coalesce(
    nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
    split_part(coalesce(new.email, ''), '@', 1),
    candidate_username
  );

  insert into public.profiles (id, username, full_name, avatar_url, role)
  values (
    new.id,
    candidate_username,
    full_name_value,
    new.raw_user_meta_data->>'avatar_url',
    'user'
  )
  on conflict (id) do update
  set
    username = excluded.username,
    full_name = coalesce(public.profiles.full_name, excluded.full_name),
    avatar_url = coalesce(public.profiles.avatar_url, excluded.avatar_url),
    role = coalesce(public.profiles.role, 'user');

  return new;
exception
  when others then
    -- Never block auth user creation due to profile insert edge cases.
    begin
      insert into public.profiles (id, username, full_name, role)
      values (
        new.id,
        'user' || right(new.id::text, 8),
        split_part(coalesce(new.email, ''), '@', 1),
        'user'
      )
      on conflict (id) do nothing;
    exception
      when others then
        null;
    end;

    return new;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgname = 'on_auth_user_created'
      and tgrelid = 'auth.users'::regclass
  ) then
    create trigger on_auth_user_created
      after insert on auth.users
      for each row execute function public.handle_new_user();
  end if;
end
$$;
