-- FORCE RESET PASSWORD
-- Run this to set a temporary password for your account.
-- Extension 'pgcrypto' is usually enabled by default in Supabase Auth.

-- 1. Set password to 'password123'
update auth.users
set encrypted_password = crypt('password123', gen_salt('bf'))
where email = 'abodidsahoo@gmail.com'; -- Verify this is the correct email

-- 2. Ensure Email is Confirmed
update auth.users
set email_confirmed_at = now()
where email = 'abodidsahoo@gmail.com' and email_confirmed_at is null;

-- 3. Ensure Admin Role
update public.profiles
set role = 'admin'
where id = (select id from auth.users where email = 'abodidsahoo@gmail.com');
