-- The landing page offers signed-out visitors a direct path to Abodid's
-- curated collection. Keep every other user's collection private by default.
update public.profiles
set is_public = true,
    updated_at = now()
where username = 'abodid'
  and role = 'admin';
