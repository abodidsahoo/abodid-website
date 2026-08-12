import test from 'node:test';
import assert from 'node:assert/strict';
import {
    isNewsletterGifAsset,
    mapCloudflareNewsletterMedia,
    NEWSLETTER_EXHIBITION_FOLDER,
    pickNewsletterMedia,
    replaceFirstNewsletterImage,
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
    assert.equal(pickNewsletterMedia([still, gif], 'image'), still);
});

test('maps Cloudflare exhibition images into newsletter preview media', () => {
    const media = mapCloudflareNewsletterMedia([
        {
            id: 'exhibition-one',
            objectKey: `${NEWSLETTER_EXHIBITION_FOLDER}/installation.jpg`,
            publicUrl: 'https://photos.example.com/originals/exhibition-photos/installation.jpg',
            name: 'Installation view',
            mimeType: 'image/jpeg',
            width: 1800,
            height: 1200,
            altText: 'A gallery installation',
        },
        {
            id: 'not-an-image',
            publicUrl: 'https://photos.example.com/originals/exhibition-photos/walkthrough.mp4',
            mimeType: 'video/mp4',
        },
    ]);

    assert.equal(NEWSLETTER_EXHIBITION_FOLDER, 'originals/exhibition-photos');
    assert.deepEqual(media, [{
        id: 'exhibition-one',
        publicUrl: 'https://photos.example.com/originals/exhibition-photos/installation.jpg',
        name: 'Installation view',
        altText: 'A gallery installation',
        isGif: false,
        isLandscape: true,
    }]);
    assert.equal(pickNewsletterMedia(media, 'image'), media[0]);
});

test('replaces only the first template image with the shuffled exhibition image', () => {
    const blocks = [
        { id: 'heading', type: 'heading', text: 'Hello' },
        { id: 'first', type: 'image', imageUrl: 'https://media.example.com/moodboard/old.jpg', alt: 'Old image' },
        { id: 'second', type: 'image', imageUrl: 'https://media.example.com/moodboard/keep.jpg', alt: 'Keep image' },
    ];
    const replacement = {
        publicUrl: 'https://photos.example.com/originals/exhibition-photos/new.jpg',
        altText: 'New exhibition view',
    };

    const nextBlocks = replaceFirstNewsletterImage(blocks, replacement);

    assert.notEqual(nextBlocks, blocks);
    assert.equal(blocks[1].imageUrl, 'https://media.example.com/moodboard/old.jpg');
    assert.equal(nextBlocks[1].imageUrl, replacement.publicUrl);
    assert.equal(nextBlocks[1].alt, replacement.altText);
    assert.equal(nextBlocks[1].previewSource, 'cloudflareExhibitions');
    assert.equal(nextBlocks[2], blocks[2]);
});
