import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeEntries, isDistributable, excerpt } from '../../src/lib/subscriptions/entries.js';
import { SUBSCRIPTION_FEEDS, readerLinks } from '../../src/lib/subscriptions/catalog.js';

const note = (extra = {}) => ({ title: 'A public note', url: '/obsidian-vault/a-note', feeds: ['notes'], published: '2020-01-01', ...extra });

test('edits retain publication dates and IDs; dates determine ordering, independent of display order', () => {
  const first = normalizeEntries([note()])[0];
  const edited = normalizeEntries([note({ modified: '2026-01-01' })])[0];
  assert.equal(first.guid, edited.guid);
  assert.equal(first.published.toISOString(), edited.published.toISOString());
  assert.equal(edited.modified.toISOString(), '2026-01-01T00:00:00.000Z');
  const sorted = normalizeEntries([note(), note({ url: '/blog/new', feeds: ['blog'], published: '2021-01-01' })]);
  assert.equal(sorted[0].url, 'https://abodid.com/blog/new');
  assert.equal(sorted[0].guid, 'https://abodid.com/blog/new/');
});

test('canonical aliases merge categories of subscription without duplicate items', () => {
  const results = normalizeEntries([note(), note({ url: '/obsidian-vault/a-note/?from=search', feeds: ['obsidian'] }),
    note({ url: 'http://www.abodid.com/obsidian-vault/a-note#excerpt' })]);
  assert.equal(results.length, 1);
  assert.deepEqual(results[0].feeds, ['notes', 'obsidian']);
});

test('external video identifiers survive; tracking parameters do not create duplicates', () => {
  const results = normalizeEntries([
    note({ url: 'https://www.youtube.com/watch?v=one&utm_source=feed' }),
    note({ url: 'https://www.youtube.com/watch?v=two' }),
    note({ url: 'https://www.youtube.com/watch?v=one' }),
  ]);
  assert.equal(results.length, 2);
  assert.ok(results.some((entry) => entry.url === 'https://www.youtube.com/watch?v=two'));
});

test('intentional moodboard deep links identify distinct images without tracking aliases', () => {
  const images = normalizeEntries([
    note({ url: '/moodboard?photo=one&utm_source=reader', feeds: ['moodboard'] }),
    note({ url: '/moodboard?photo=two', feeds: ['moodboard'] }),
  ]);
  assert.equal(images.length, 2);
  assert.ok(images.some((entry) => entry.url === 'https://abodid.com/moodboard?photo=one'));
});

test('private, future, expired, malformed and administrative content never distributes', () => {
  const inputs = [
    note({ draft: true }), note({ private: true }), note({ published: '2999-01-01' }),
    note({ expires: '2000-01-01' }), note({ url: '/admin/secret' }),
    note({ url: 'javascript:alert(1)' }), note({ url: '/land' }),
  ];
  assert.deepEqual(normalizeEntries(inputs), []);
  for (const metadata of [{ Published: false }, { publish: 'false' }, { status: 'draft' }, { visibility: 'unlisted' }, { noindex: true }]) assert.equal(isDistributable(metadata), false);
});

test('excerpts remove markup, hidden Obsidian comments and embedded images', () => {
  assert.equal(excerpt('Hello [[world|reader]]. %%secret%% ![[image.png]] <script>bad()</script>'), 'Hello reader. bad()');
});

test('subscription catalogue has unique URLs and encoded reader deep links', () => {
  assert.equal(new Set(SUBSCRIPTION_FEEDS.map((feed) => feed.path)).size, SUBSCRIPTION_FEEDS.length);
  assert.equal(SUBSCRIPTION_FEEDS[0].path, '/rss.xml');
  const url = 'https://abodid.com/feeds/notes.xml';
  assert.ok(readerLinks(url).feedly.endsWith(encodeURIComponent(url)));
  assert.equal(new URL(readerLinks(url).inoreader).searchParams.get('add_feed'), url);
});
