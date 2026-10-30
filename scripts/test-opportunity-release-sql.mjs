// Isolated PostgreSQL/WASM checks; never connects to the live project.
// Install @electric-sql/pglite in a temporary directory, then pass its module path.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
const { PGlite } = await import(pathToFileURL(process.argv[2]).href);
const db = new PGlite();
const query = async (sql, args = []) => (await db.query(sql, args)).rows;
const users = Array.from({ length: 7 }, (_, i) => `00000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`);
await db.exec(`
  create role anon; create role authenticated; create role service_role bypassrls;
  create schema auth;
  create table auth.users(id uuid primary key, is_anonymous boolean not null default false);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
  grant usage on schema auth to authenticated;
  create table public.profiles(id uuid primary key, role text default 'user');
  create table public.opportunity_memberships(user_id uuid primary key references public.profiles(id));
  alter table public.opportunity_memberships enable row level security;
  alter table public.opportunity_memberships force row level security;
`);
for (const user of users) {
  await query('insert into public.profiles(id) values($1)', [user]);
  await query('insert into auth.users(id) values($1)', [user]);
}
const existing = await readFile(new URL('../supabase/migrations/20261009120000_opportunities_multi_user.sql', import.meta.url), 'utf8');
await db.exec(existing.slice(existing.indexOf('create table if not exists public.saved_opportunities ('), existing.indexOf('create table if not exists public.saved_opportunity_notification_log')));
await db.exec(existing.slice(existing.indexOf('alter table public.saved_opportunities enable row level security;'), existing.indexOf('-- The profile row is private')));
await db.exec(await readFile(new URL('../supabase/migrations/20261020220000_create_opportunity_capture_jobs.sql', import.meta.url), 'utf8'));
await db.exec(await readFile(new URL('../supabase/migrations/20261030034306_opportunity_ai_release_limits.sql', import.meta.url), 'utf8'));
await db.exec(await readFile(new URL('../supabase/migrations/20261030034315_opportunity_capacity_and_support.sql', import.meta.url), 'utf8'));
await db.exec(await readFile(new URL('../supabase/migrations/20261030034917_opportunity_server_only_intake_activation.sql', import.meta.url), 'utf8'));
await db.exec(await readFile(new URL('../supabase/migrations/20261030040657_opportunity_admin_increment_allowance.sql', import.meta.url), 'utf8'));
const reserve = async (user, limit = 5, concurrency = 4) => (await query(
  'select * from public.reserve_opportunity_ai_capture($1,$2,$3)', [user, limit, concurrency],
))[0];
const release = lease => query('select public.release_opportunity_ai_capture($1)', [lease]);
let passed = 0;
const check = (value, message) => { assert.ok(value, message); console.log('PASS', message); passed++; };
try {
  for (let i = 0; i < 5; i++) {
    const admitted = await reserve(users[0]);
    assert.equal(admitted.allowed, true);
    await release(admitted.lease_id);
  }
  const exhausted = await reserve(users[0]);
  check(!exhausted.allowed && exhausted.reason === 'monthly' && exhausted.retry_after_seconds > 0, 'sixth AI capture is blocked until the UTC month resets');
  const other = await reserve(users[1]);
  check(other.allowed, 'a second user has an independent monthly allowance');
  const busy = await reserve(users[1]);
  check(!busy.allowed && busy.reason === 'busy', 'a user cannot start a second concurrent capture');
  check((await query('select captures from public.opportunity_ai_usage where user_id=$1',[users[1]]))[0].captures === 1, 'busy admission does not consume a capture');
  const leases = [other.lease_id];
  for (const user of users.slice(2, 5)) leases.push((await reserve(user)).lease_id);
  check((await reserve(users[5])).reason === 'busy', 'global concurrency is limited across users');
  for (const lease of leases) await release(lease);
  check((await reserve(users[5])).allowed, 'releasing capacity admits another user');
  await query("update public.opportunity_ai_leases set expires_at=now()-interval '1 second'");
  check((await reserve(users[5])).allowed, 'an expired lease recovers after a server interruption');
  await query('insert into public.opportunity_memberships values($1,8)', [users[6]]);
  check((await reserve(users[6],0)).reason === 'monthly', 'zero server allowance pauses AI even with a user entitlement');
  await query('update auth.users set is_anonymous=true where id=$1', [users[6]]);
  check((await reserve(users[6])).reason === 'authentication', 'anonymous identities cannot spend paid AI capacity through a worker');
  await query('update auth.users set is_anonymous=false where id=$1', [users[6]]);
  for (let i = 0; i < 8; i++) {
    const admitted = await reserve(users[6]);
    assert.equal(admitted.allowed, true);
    await release(admitted.lease_id);
  }
  check((await reserve(users[6])).reason === 'monthly', 'a service-managed entitlement overrides the default with an enforced upper limit');
  await query("update public.opportunity_ai_usage set month_start=month_start-interval '1 month' where user_id=$1", [users[0]]);
  check((await reserve(users[0])).allowed, 'a new UTC calendar month starts a fresh allowance');
  const acl = (await query(`select
    has_function_privilege('anon','public.reserve_opportunity_ai_capture(uuid,integer,integer)','EXECUTE') a,
    has_function_privilege('authenticated','public.reserve_opportunity_ai_capture(uuid,integer,integer)','EXECUTE') b,
    has_function_privilege('service_role','public.reserve_opportunity_ai_capture(uuid,integer,integer)','EXECUTE') c,
    has_table_privilege('authenticated','public.opportunity_ai_usage','UPDATE') d`))[0];
  check(!acl.a && !acl.b && acl.c && !acl.d, 'only the server can reserve capacity or change usage');
  check(!(await query("select has_table_privilege('authenticated','public.opportunity_capture_jobs','INSERT') as allowed"))[0].allowed,
    'raw authenticated Data API inserts cannot bypass verified job intake');

  // Run the repository's actual saved-opportunity table and ownership policies.
  await query("insert into public.saved_opportunities(user_id,title,source_url,canonical_url) values($1,'Saved result','https://example.org/call','https://example.org/call')", [users[0]]);
  await query("select set_config('request.jwt.claim.sub',$1,false)", [users[1]]);
  await db.exec('set role authenticated');
  check((await query('select * from public.saved_opportunities')).length === 0, 'user B cannot read user A saved results');
  check((await query("update public.saved_opportunities set title='Forbidden' returning id")).length === 0, 'user B cannot change user A saved results');
  await db.exec('reset role');
  await query("select set_config('request.jwt.claim.sub',$1,false)", [users[0]]);
  await db.exec('set role authenticated');
  check((await query('select * from public.saved_opportunities')).length === 1, 'saved results remain accessible after monthly exhaustion');
  await db.exec('reset role');
  for(let i=1;i<100;i++) await query("insert into public.saved_opportunities(user_id,title,source_url,canonical_url) values($1,'Capacity fixture',$2,$2)",[users[0],`https://example.org/${i}`]);
  await assert.rejects(()=>query("insert into public.saved_opportunities(user_id,title,source_url,canonical_url) values($1,'Over limit','https://example.org/overflow','https://example.org/overflow')",[users[0]]),e=>e.code==='P0100');
  check((await reserve(users[0])).reason==='capacity','full collection blocks AI before spending');
  await query("delete from public.saved_opportunities where user_id=$1 and canonical_url='https://example.org/1'",[users[0]]);
  await query("insert into public.saved_opportunities(user_id,title,source_url,canonical_url) values($1,'Freed slot','https://example.org/new','https://example.org/new')",[users[0]]);
  check((await query('select count(*)::int as n from public.saved_opportunities where user_id=$1',[users[0]]))[0].n===100,'deleting frees a slot and the 101st insert is rejected');
  check((await query('select captures from public.opportunity_ai_usage where user_id=$1 order by month_start desc limit 1',[users[0]]))[0].captures===1,'deleting a saved record never refunds monthly AI usage');
  await query("update public.profiles set role='admin' where id=$1",[users[1]]);
  await query('select public.set_opportunity_ai_allowance($1,$2,20)',[users[6],users[1]]);
  check((await query('select captures from public.opportunity_ai_usage where user_id=$1',[users[6]]))[0].captures===8,'admin increases preserve existing monthly usage');
  await assert.rejects(()=>query('select public.set_opportunity_ai_allowance($1,$2,20)',[users[6],users[2]]),e=>e.code==='42501');
  check((await query('select count(*)::int n from public.opportunity_allowance_audit'))[0].n===1,'only verified admin changes are audited and nonadmins are denied');
  const grants=(await query("select has_function_privilege('authenticated','public.set_opportunity_ai_allowance(uuid,uuid,integer)','EXECUTE') allowed"))[0];
  check(!grants.allowed,'ordinary users cannot invoke allowance changes directly');
  const first=(await query('select public.increment_opportunity_ai_allowance($1,$2,5,5) n',[users[6],users[1]]))[0].n;
  const second=(await query('select public.increment_opportunity_ai_allowance($1,$2,10,5) n',[users[6],users[1]]))[0].n;
  check(first===25 && second===35,'quick increments build on the stored allowance instead of stale browser values');
  check((await query('select captures from public.opportunity_ai_usage where user_id=$1',[users[6]]))[0].captures===8,'quick increases preserve all consumed attempts');
  await assert.rejects(()=>query('select public.increment_opportunity_ai_allowance($1,$2,5,5)',[users[6],users[2]]),e=>e.code==='42501');
  check(!(await query("select has_function_privilege('authenticated','public.increment_opportunity_ai_allowance(uuid,uuid,integer,integer)','EXECUTE') allowed"))[0].allowed,'quick increment RPC is inaccessible to ordinary users');
  await query('select public.set_opportunity_ai_allowance($1,$2,9999)',[users[6],users[1]]);
  await assert.rejects(()=>query('select public.increment_opportunity_ai_allowance($1,$2,5,5)',[users[6],users[1]]),e=>e.code==='22023');
  check((await query('select ai_monthly_limit n from public.opportunity_memberships where user_id=$1',[users[6]]))[0].n===9999,'an overflowing quick increase is rejected without changing the stored allowance');
  await query('select public.set_opportunity_ai_allowance($1,$2,20)',[users[6],users[1]]);
  const confirmed=(await query('select public.confirm_opportunity_ai_allowance($1,$2,20,5,5,null) n',[users[6],users[1]]))[0].n;
  check(confirmed===25,'confirmed quick change saves the reviewed increase');
  await assert.rejects(()=>query('select public.confirm_opportunity_ai_allowance($1,$2,20,5,5,null)',[users[6],users[1]]),e=>e.code==='40001');
  check((await query('select ai_monthly_limit n from public.opportunity_memberships where user_id=$1',[users[6]]))[0].n===25,'stale confirmations never grant unexpected additional credits');
  const stats=(await query('select * from public.opportunity_ai_usage_summary($1)',[users[0]]))[0];
  check(Number(stats.used_month)===1 && Number(stats.total_attempts)===6,'usage summary separates current-month attempts from tracked historical attempts');
  check(!(await query("select has_function_privilege('authenticated','public.opportunity_ai_usage_summary(uuid)','EXECUTE') allowed"))[0].allowed,'usage analytics are not exposed to ordinary users');
  console.log(`${passed} SQL checks passed; database discarded.`);
} finally { await db.close(); }
