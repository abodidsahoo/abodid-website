-- MIGRATION: Improve New User Handling (Name & Username)

create or replace function public.handle_new_user() 
returns trigger as $$
declare
  default_username text;
begin
  -- Generate a default username from email (part before @)
  default_username := split_part(new.email, '@', 1);
  
  -- Insert into profiles
  -- We prefer metadata 'full_name' if sent via sign-in options.
  -- We default 'username' to the email prefix to avoid nulls.
  insert into public.profiles (id, full_name, avatar_url, username)
  values (
    new.id, 
    coalesce(new.raw_user_meta_data->>'full_name', default_username),
    new.raw_user_meta_data->>'avatar_url',
    coalesce(new.raw_user_meta_data->>'username', default_username)
  )
  on conflict (id) do nothing; -- Safety handle

  return new;
end;
$$ language plpgsql security definer;
