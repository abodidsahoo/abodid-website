import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildCatalog, isPortfolioKey } from '../../src/lib/photography/catalog.mjs';
import { photographyDestination } from '../../src/lib/photography/routing.mjs';
const inventory = JSON.parse(fs.readFileSync(new URL('../../src/data/photographyR2.generated.json', import.meta.url)));
test('verified exhibition catalog publishes 56 images with both variants', () => {
  const photos = buildCatalog(inventory);
  assert.equal(photos.length, 56);
  for (const photo of photos) {
    assert.match(photo.original, /^https:\/\/assets\.abodid\.com\/photos\/originals\/exhibition-photos\//);
    assert.match(photo.small, /\/800\/.+\.webp$/);
    assert.match(photo.large, /\/1600\/.+\.webp$/);
  }
});
test('research and site graphics are excluded even if configured', () => {
  for (const folder of ['punctum-experiment','invisible-punctum','profile-avatars','landing-page-01','site-assets']) {
    assert.equal(isPortfolioKey(`photos/originals/${folder}/test.jpg`, [folder]), false);
  }
  assert.equal(isPortfolioKey('photos/originals/my-life/photo.jpg'), false);
  assert.equal(isPortfolioKey('photos/originals/exhibitions/../test.jpg'), false);
});
test('future nested categories support unhashed variants; pending photos stay out', () => {
  const key = 'photos/originals/documentary/new-series/frame.jpg';
  const objects = [key,'photos/variants/documentary/new-series/800/frame.webp','photos/variants/documentary/new-series/1600/frame.webp'].map(key => ({key}));
  const [photo] = buildCatalog(objects);
  assert.equal(photo.category, 'Documentary');
  assert.equal(photo.title, 'New Series');
  assert.equal(buildCatalog(objects.slice(0,2)).length, 0);
});
test('fingerprint selection uses current original rather than stale variants', () => {
  const objects = [
    {key:'photos/originals/exhibitions/frame.jpg',etag:'"1234567890abcdef"'},
    ...['800','1600'].flatMap(size=>['old','1234567890'].map(hash=>({key:`photos/variants/exhibitions/${size}/frame-${hash}.webp`}))),
  ];
  assert.match(buildCatalog(objects)[0].large, /frame-1234567890.webp$/);
});
test('domain rewrite preserves other domains and is non-recursive', () => {
  assert.equal(photographyDestination(new URL('https://photos.abodid.com/')), '/photography-portfolio');
  assert.equal(photographyDestination(new URL('https://photos.abodid.com/sitemap.xml')), '/photography-portfolio/sitemap.xml');
  assert.equal(photographyDestination(new URL('https://photos.abodid.com/photography-portfolio')), null);
  assert.equal(photographyDestination(new URL('https://abodid.com/')), null);
  assert.equal(photographyDestination(new URL('https://photos.abodid.com.evil.test/')), null);
});
