import test from 'node:test';
import assert from 'node:assert/strict';
import { applyMoodboardSearchSnapshot, getMoodboardSearchSnapshotUrl, parseMoodboardSearchSnapshot } from '../../src/lib/moodboardSearchSnapshot.js';
import { matchesMoodboardQuery } from '../../src/lib/moodboardDiscovery.js';

const builtItems = [
    { id: 'one', title: 'First', artistName: '', tags: ['old'], imageUrl: '/one.webp' },
    { id: 'two', title: 'Second', artistName: '', tags: ['kept'], imageUrl: '/two.webp' },
];
const snapshot = (items) => parseMoodboardSearchSnapshot({ schemaVersion: 1, revision: 2, generatedAt: '2026-10-28T12:00:00Z', items });

test('a later publication makes saved tags searchable without changing the image or its order', () => {
    const state = snapshot([
        { id: 'one', title: 'First', artistName: 'Mira', tags: ['old', 'negative space'] },
        { id: 'two', title: 'Second', artistName: '', tags: ['kept'] },
    ]);
    const result = applyMoodboardSearchSnapshot(builtItems, state);
    assert.equal(matchesMoodboardQuery(result[0], 'negative space'), true);
    assert.equal(matchesMoodboardQuery(result[0], 'mira'), true);
    assert.equal(result[0].imageUrl, '/one.webp');
    assert.equal(result[1], builtItems[1]);
    assert.deepEqual(builtItems[0].tags, ['old']);
});

test('invalid, duplicate or incompatible data is rejected rather than blanking the gallery', () => {
    assert.throws(() => parseMoodboardSearchSnapshot({ items: [] }));
    const item = { id: 'one', title: '', artistName: '', tags: [] };
    assert.throws(() => snapshot([item, item]));
    assert.throws(() => snapshot([{ ...item, tags: [null] }]));
    assert.equal(applyMoodboardSearchSnapshot(builtItems, null), builtItems);
});

test('publication removes withdrawn references while retaining build data newer than the file', () => {
    const newer = { ...builtItems[0], updatedAt: '2026-10-28T12:01:00Z' };
    assert.deepEqual(applyMoodboardSearchSnapshot(builtItems, snapshot([])), []);
    assert.deepEqual(applyMoodboardSearchSnapshot([newer], snapshot([])), [newer]);
    assert.deepEqual(applyMoodboardSearchSnapshot([{ ...builtItems[0], createdAt: newer.updatedAt }], snapshot([])), [{ ...builtItems[0], createdAt: newer.updatedAt }]);
});

test('the public file URL is stable and needs no API key or cache-busting timestamp', () => {
    assert.equal(getMoodboardSearchSnapshotUrl('https://example.supabase.co/'), 'https://example.supabase.co/storage/v1/object/public/moodboard-search/search-v1.json');
    assert.equal(getMoodboardSearchSnapshotUrl(''), '');
});
