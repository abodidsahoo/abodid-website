import assert from 'node:assert/strict';
import test from 'node:test';

import middleware, { config } from '../middleware.js';

const route = (url) => middleware(new Request(url));

const assertRewrite = (url, expected) => {
  const response = route(url);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('x-middleware-rewrite'), expected);
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

test('lab owns experiment, robots, and sitemap routes', () => {
  assertRewrite('https://lab.abodid.com/', '/lab');
  assertRewrite('https://lab.abodid.com/punctum/about', '/lab/punctum/about');
  assertRewrite('https://lab.abodid.com/image-flick', '/lab/image-flick');
  assertRewrite('https://lab.abodid.com/robots.txt', '/lab-robots.txt');
  assertRewrite('https://lab.abodid.com/sitemap.xml', '/lab-sitemap.xml');

  const exposedInternalPath = route('https://lab.abodid.com/lab/punctum');
  assert.equal(exposedInternalPath.status, 308);
  assert.equal(exposedInternalPath.headers.get('location'), 'https://lab.abodid.com/punctum');

  const unrelated = route('https://lab.abodid.com/about');
  assert.equal(unrelated.status, 308);
  assert.equal(unrelated.headers.get('location'), 'https://abodid.com/about');
});

test('primary legacy product paths redirect while admin passes through unchanged', () => {
  const resources = route('https://abodid.com/resources/example?from=old');
  assert.equal(resources.status, 308);
  assert.equal(resources.headers.get('location'), 'https://curation.abodid.com/resource/example?from=old');

  const lab = route('https://abodid.com/lab/punctum/results');
  assert.equal(lab.status, 308);
  assert.equal(lab.headers.get('location'), 'https://lab.abodid.com/punctum/results');

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
