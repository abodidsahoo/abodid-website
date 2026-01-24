-- PROMOTE USER TO ADMIN
-- Replace 'your_email@example.com' with your actual email address.

update public.profiles
set role = 'admin'
where id in (
  select id from auth.users where email = 'your_email@example.com' -- CHANGE THIS
);

-- Verify
select * from public.profiles where role = 'admin';
