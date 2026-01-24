-- Backfill Profiles from Auth Users
-- This fixes the issue where an existing user (you) is logged in but doesn't have a row in the new 'profiles' table.

insert into public.profiles (id, username, full_name, avatar_url, role)
select 
  id, 
  coalesce(raw_user_meta_data->>'user_name', email), -- Fallback to email if no username
  coalesce(raw_user_meta_data->>'full_name', email),
  raw_user_meta_data->>'avatar_url',
  'user' -- Default role
from auth.users
on conflict (id) do nothing;

-- Also, let's verify if YOU are the one logged in, and make you admin if not already
-- (Optional, but safe to run)
update public.profiles
set role = 'admin'
where id in (select id from auth.users where email = 'abodidsahoo@gmail.com');
