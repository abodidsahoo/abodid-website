import test from 'node:test';
import assert from 'node:assert/strict';

import { matchesMoodboardQuery } from '../../src/lib/moodboardDiscovery.js';

const items = [
    { id: 'one', title: 'Brutalist garden', artistName: 'Anu', tags: ['Architecture', 'Concrete', 'Nature'] },
    { id: 'two', title: 'Soft portrait', artistName: 'Mira', tags: ['Portrait', 'Pink'] },
    { id: 'three', title: 'Concrete rhythm', artistName: '', tags: ['Architecture', 'Pattern'] },
    { id: 'four', title: 'Garden study', artistName: '', tags: ['Nature', 'Botanical'] },
];

test('fuzzy discovery matches titles, artists, and tags while tolerating small typos', () => {
    assert.equal(matchesMoodboardQuery(items[0], 'brutalist'), true);
    assert.equal(matchesMoodboardQuery(items[0], 'arhcitecture'), true);
    assert.equal(matchesMoodboardQuery(items[0], 'architectur'), true);
    assert.equal(matchesMoodboardQuery(items[1], 'mira portriat'), true);
    assert.equal(matchesMoodboardQuery(items[1], 'cobalt'), false);
});

test('an empty query keeps every image visible and unrelated terms stay excluded', () => {
    assert.equal(matchesMoodboardQuery(items[0], ''), true);
    assert.equal(matchesMoodboardQuery(items[3], 'botanical'), true);
    assert.equal(matchesMoodboardQuery(items[3], 'industrial'), false);
});
