begin;

select plan(15);

-- These fixed UUIDs exist only inside the rolled-back test transaction.
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at)
values
  ('10000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'opportunity-a@example.test', '', now(), now()),
  ('10000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'opportunity-b@example.test', '', now(), now());

update public.profiles set username = 'opportunity_a', is_public = false
where id = '10000000-0000-4000-8000-000000000001';
update public.profiles set username = 'opportunity_b', is_public = true
where id = '10000000-0000-4000-8000-000000000002';

insert into public.saved_opportunities (id, user_id, title, source_url, canonical_url, notes)
values
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'A private opportunity', 'https://example.test/a', 'https://example.test/a', 'A secret note'),
  ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002', 'B public-profile opportunity', 'https://example.test/b', 'https://example.test/b', 'B secret note');

set local role authenticated;
set local request.jwt.claims = '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}';

select results_eq(
  $$ select count(*)::bigint from public.saved_opportunities $$,
  array[1::bigint],
  'user A sees only their own saved opportunity'
);

select is(
  (select title from public.saved_opportunities limit 1),
  'A private opportunity',
  'user A cannot read user B through the owner policy'
);

select is_empty(
  $$ update public.saved_opportunities set notes = 'stolen' where id = '20000000-0000-4000-8000-000000000002' returning id $$,
  'user A cannot update user B'
);

select is_empty(
  $$ delete from public.saved_opportunities where id = '20000000-0000-4000-8000-000000000002' returning id $$,
  'user A cannot delete user B'
);

select throws_ok(
  $$ insert into public.saved_opportunities (user_id, title, source_url, canonical_url) values ('10000000-0000-4000-8000-000000000002', 'Wrong owner', 'https://example.test/c', 'https://example.test/c') $$,
  '42501',
  null,
  'user A cannot insert for user B'
);

select lives_ok(
  $$ insert into public.saved_opportunities (user_id, title, source_url, canonical_url) values ('10000000-0000-4000-8000-000000000001', 'Own row', 'https://example.test/d', 'https://example.test/d') $$,
  'user A can insert their own row'
);

select throws_ok(
  $$ update public.profiles set role = 'admin' where id = '10000000-0000-4000-8000-000000000001' $$,
  '42501',
  null,
  'user A cannot promote their role'
);

select lives_ok(
  $$ update public.profiles set is_public = true where id = '10000000-0000-4000-8000-000000000001' $$,
  'user A can update their sharing preference'
);

select results_eq(
  $$ select username from public.public_profiles where id = '10000000-0000-4000-8000-000000000002' $$,
  array['opportunity_b'::text],
  'authenticated visitors resolve another opted-in profile through the safe view'
);

select is_empty(
  $$ select role from public.profiles where id = '10000000-0000-4000-8000-000000000002' $$,
  'authenticated visitors cannot read another public profile account fields'
);

select throws_ok(
  $$ update public.profiles set username = 'settings' where id = '10000000-0000-4000-8000-000000000001' $$,
  '23514',
  null,
  'reserved usernames are rejected'
);

select throws_ok(
  $$ update public.profiles set username = 'abodid' where id = '10000000-0000-4000-8000-000000000001' $$,
  '42501',
  null,
  'the founder URL cannot be claimed by another account'
);

reset role;
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';

select is_empty(
  $$ select id from public.saved_opportunities $$,
  'anonymous visitors cannot query saved rows directly'
);

select results_eq(
  $$ select username from public.profiles order by username $$,
  array['opportunity_b'::text],
  'anonymous visitors see only opted-in profile rows'
);

select throws_ok(
  $$ select email from public.profiles $$,
  '42501',
  null,
  'anonymous visitors cannot select private profile columns'
);

select * from finish();
rollback;
