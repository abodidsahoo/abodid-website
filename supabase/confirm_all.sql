-- CONFIRM *ALL* PENDING USERS
-- Run this to instantly verify any account you just created, regardless of the email.

update auth.users
set email_confirmed_at = now()
where email_confirmed_at is null;

-- Verify
select email, email_confirmed_at from auth.users;
