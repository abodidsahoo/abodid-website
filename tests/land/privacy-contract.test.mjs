import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('land records are not placed in public assets', async () => {
  const config = await readFile(new URL('../../astro.config.mjs', import.meta.url), 'utf8');
  const serviceWorker = await readFile(new URL('../../public/sw.js', import.meta.url), 'utf8');
  const middleware = await readFile(new URL('../../src/middleware.ts', import.meta.url), 'utf8');
  assert.match(config, /secureLandFiles/);
  assert.match(serviceWorker, /\/\\\/land/);
  assert.match(middleware, /api\\\/land/);
});

test('viewer interface exposes three and only three filter selects', async () => {
  const source = await readFile(new URL('../../src/components/land/LandRegisterApp.tsx', import.meta.url), 'utf8');
  const filterBlock = source.slice(source.indexOf('const renderFilters'), source.indexOf('const renderKhataList'));
  assert.equal((filterBlock.match(/<select/g) || []).length, 3);
  assert.match(source, /navigator\.canShare/);
  assert.match(source, /attach the downloaded PNG manually/);
  assert.match(source, /bhunakshaodisha\.nic\.in/);
  assert.doesNotMatch(source, /google\.maps/);
});

