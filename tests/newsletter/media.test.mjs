import test from 'node:test';
import assert from 'node:assert/strict';
import {
    isNewsletterGifAsset,
    pickNewsletterMedia,
} from '../../src/lib/newsletter/media.js';

test('recognizes mood-board GIFs from each available metadata source', () => {
    assert.equal(isNewsletterGifAsset({ image_url: 'https://media.example.com/loop.gif?width=900' }), true);
    assert.equal(isNewsletterGifAsset({ image_url: 'https://cdn.example.com/transformed/123', storage_path: 'moodboard/loop.gif' }), true);
    assert.equal(isNewsletterGifAsset({ image_url: 'https://cdn.example.com/transformed/456', tags: ['motion', 'GIF'] }), true);
    assert.equal(isNewsletterGifAsset({ image_url: 'https://media.example.com/still.jpg', tags: ['image'] }), false);
});

test('selects a GIF only from eligible mood-board assets', () => {
    const gif = { publicUrl: 'https://media.example.com/loop.gif', isGif: true };
    const still = { publicUrl: 'https://media.example.com/still.jpg', isGif: false, isLandscape: true };

    assert.equal(pickNewsletterMedia([still, gif], 'gif'), gif);
});
