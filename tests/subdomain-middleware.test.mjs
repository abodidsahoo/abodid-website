import assert from 'node:assert/strict';
import test from 'node:test';

import middleware, { config } from '../middleware.js';

const route = (url) => middleware(new Request(url));

test('uses Vercel Node routing middleware before filesystem resolution', () => {
  assert.deepEqual(config, { runtime: 'nodejs' });
});

test('curation subdomain redirects to main site /resources routes', () => {
  const root = route('https://curation.abodid.com/');
  assert.equal(root.status, 308);
  assert.equal(root.headers.get('location'), 'https://abodid.com/resources');

  const dashboard = route('https://curation.abodid.com/dashboard?view=saved');
  assert.equal(dashboard.status, 308);
  assert.equal(dashboard.headers.get('location'), 'https://abodid.com/resources/dashboard?view=saved');

  const admin = route('https://curation.abodid.com/admin');
  assert.equal(admin.status, 308);
  assert.equal(admin.headers.get('location'), 'https://abodid.com/resources/admin');

  const resource = route('https://curation.abodid.com/resource/example/edit');
  assert.equal(resource.status, 308);
  assert.equal(resource.headers.get('location'), 'https://abodid.com/resources/example/edit');
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
});

test('primary site resources, lab, and admin pass through unchanged', () => {
  const resources = route('https://abodid.com/resources/example?from=old');
  assert.equal(resources.status, 200);
  assert.equal(resources.headers.get('x-middleware-next'), '1');

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

test('photography subdomain redirects to main site photography portfolio', () => {
  const root = route('https://photos.abodid.com/');
  assert.equal(root.status, 308);
  assert.equal(root.headers.get('location'), 'https://abodid.com/photography-portfolio');
});

