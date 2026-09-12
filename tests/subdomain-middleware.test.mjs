import assert from 'node:assert/strict';
import test from 'node:test';

import middleware, { config } from '../middleware.js';

const route = (url) => middleware(new Request(url));

const assertRewrite = (url, expected) => {
  const response = route(url);
  assert.equal(response.status, 200);
  const rewriteTarget = response.headers.get('x-middleware-rewrite');
  assert.ok(rewriteTarget);
  const resolvedTarget = new URL(rewriteTarget, url);
  assert.equal(`${resolvedTarget.pathname}${resolvedTarget.search}`, expected);
};

test('uses Vercel Node routing middleware before filesystem resolution', () => {
  assert.deepEqual(config, { runtime: 'nodejs' });
});

test('curation owns its public application routes', () => {
  assertRewrite('https://curation.abodid.com/', '/resources');
  assertRewrite(
    'https://curation.abodid.com/dashboard?view=saved',
    '/resources/dashboard?view=saved',
  );
  assertRewrite('https://curation.abodid.com/admin', '/resources/admin');
  assertRewrite(
    'https://curation.abodid.com/resource/example/edit',
    '/resources/example/edit',
  );
});

test('curation canonicalizes old resource paths and rejects main-site routes', () => {
  const legacy = route('https://curation.abodid.com/resources/example?from=old');
  assert.equal(legacy.status, 308);
  assert.equal(legacy.headers.get('location'), 'https://curation.abodid.com/resource/example?from=old');

  const unrelated = route('https://curation.abodid.com/obsidian-vault/example');
  assert.equal(unrelated.status, 308);
  assert.equal(unrelated.headers.get('location'), 'https://abodid.com/obsidian-vault/example');
});

test('lab subdomain redirects to main site /lab routes', () => {
  const root = route('https://lab.abodid.com/');
  assert.equal(root.status, 308);
  assert.equal(root.headers.get('location'), 'https://abodid.com/lab');

  const punctum = route('https://lab.abodid.com/punctum/about');
  assert.equal(punctum.status, 308);
  assert.equal(punctum.headers.get('location'), 'https://abodid.com/lab/punctum/about');

  const flick = route('https://lab.abodid.com/image-flick');
  assert.equal(flick.status, 308);
  assert.equal(flick.headers.get('location'), 'https://abodid.com/lab/image-flick');

  const board = route('https://lab.abodid.com/photo-board');
  assert.equal(board.status, 308);
  assert.equal(board.headers.get('location'), 'https://abodid.com/lab/photo-board');

  const unrelated = route('https://lab.abodid.com/about');
  assert.equal(unrelated.status, 308);
  assert.equal(unrelated.headers.get('location'), 'https://abodid.com/about');
});

test('primary legacy product paths redirect while lab and admin pass through unchanged', () => {
  const resources = route('https://abodid.com/resources/example?from=old');
  assert.equal(resources.status, 308);
  assert.equal(resources.headers.get('location'), 'https://curation.abodid.com/resource/example?from=old');

  const legacyLab = route('https://abodid.com/research/punctum/results');
  assert.equal(legacyLab.status, 308);
  assert.equal(legacyLab.headers.get('location'), 'https://abodid.com/lab/punctum/results');

  const lab = route('https://abodid.com/lab/punctum/results');
  assert.equal(lab.status, 200);
  assert.equal(lab.headers.get('x-middleware-next'), '1');

  const response = route('https://abodid.com/admin/dashboard');
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('x-middleware-next'), '1');
  assert.equal(response.headers.get('x-middleware-rewrite'), null);
});

test('photography keeps its existing isolated routing', () => {
  assertRewrite('https://photos.abodid.com/', '/photography-portfolio');

  const unrelated = route('https://photos.abodid.com/about');
  assert.equal(unrelated.status, 308);
  assert.equal(unrelated.headers.get('location'), 'https://abodid.com/about');
});
