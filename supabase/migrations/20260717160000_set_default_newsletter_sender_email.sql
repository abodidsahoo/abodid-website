begin;

alter table if exists public.newsletters
  alter column sender_email set default 'hello@abodid.com';

commit;
