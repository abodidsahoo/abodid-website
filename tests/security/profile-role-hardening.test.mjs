import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const migrationUrl = new URL(
  '../../supabase/migrations/20260929213000_lock_profile_privilege_columns.sql',
  import.meta.url,
);
const loginUrl = new URL('../../src/pages/login.astro', import.meta.url);

test('authenticated clients cannot update profile privilege columns', async () => {
  const migration = await readFile(migrationUrl, 'utf8');

  assert.match(
    migration,
    /revoke update on table public\.profiles from authenticated/i,
  );
  assert.match(
    migration,
    /has_column_privilege\('authenticated', 'public\.profiles', 'role', 'UPDATE'\)/i,
  );
  assert.match(
    migration,
    /new\.role is distinct from old\.role[\s\S]*auth\.role\(\)[\s\S]*<> 'service_role'/i,
  );

  const editableList = migration.match(/column_name = any \(array\[([\s\S]*?)\]\)/i)?.[1] || '';
  assert.doesNotMatch(editableList, /'role'/i);
  assert.doesNotMatch(editableList, /'is_approved'/i);
});

test('browser signup relies on the database role default', async () => {
  const loginSource = await readFile(loginUrl, 'utf8');
  const profileUpsert = loginSource.match(
    /\.from\("profiles"\)\s*\.upsert\(([\s\S]*?)\{ onConflict: "id" \}/,
  )?.[1];

  assert.ok(profileUpsert, 'expected to find the signup profile upsert');
  assert.doesNotMatch(profileUpsert, /\brole\s*:/);
});
