-- MANUALLY CONFIRM USER EMAIL
-- Run this if you are stuck waiting for a confirmation email.

update auth.users
set email_confirmed_at = now()
where email = 'abodidsahoo@gmail.com'; -- Replace with your email if different

-- Verify it worked
select email, email_confirmed_at from auth.users where email = 'abodidsahoo@gmail.com';
