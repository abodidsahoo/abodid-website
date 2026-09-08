import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildCatalog, isPortfolioKey } from '../../src/lib/photography/catalog.mjs';
import { photographyDestination } from '../../src/lib/photography/routing.mjs';
const inventory = JSON.parse(fs.readFileSync(new URL('../../src/data/photographyR2.generated.json', import.meta.url)));
test('verified exhibition catalog publishes 56 images with both variants', () => {
  const photos = buildCatalog(inventory).filter(p => p.key.startsWith('photos/originals/exhibition-photos/'));
  assert.equal(photos.length, 56);
  for (const photo of photos) {
    assert.match(photo.original, /^https:\/\/assets\.abodid\.com\/photos\/originals\/exhibition-photos\//);
    assert.match(photo.small, /\/800\/.+\.webp$/);
    assert.match(photo.large, /\/1600\/.+\.webp$/);
  }
});
test('private sets, research, and site graphics are excluded even if configured', () => {
  for (const folder of ['boudoir','punctum-experiment','invisible-punctum','profile-avatars','landing-page-01','site-assets']) {
    assert.equal(isPortfolioKey(`photos/originals/${folder}/test.jpg`, [folder]), false);
  }

  assert.equal(isPortfolioKey('photos/originals/exhibitions/../test.jpg'), false);
});
test('future nested categories support unhashed variants; missing 1600 uses an existing 800 before originals', () => {
  const key = 'photos/originals/documentary/new-series/frame.jpg';
  const objects = [key,'photos/variants/documentary/new-series/800/frame.webp','photos/variants/documentary/new-series/1600/frame.webp'].map(key => ({key}));
  const [photo] = buildCatalog(objects);
  assert.equal(photo.category, 'Documentary');
  assert.equal(photo.title, 'New Series');
  assert.match(buildCatalog(objects.slice(0,2))[0].large, /variants\/documentary\/new-series\/800\//);
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
test('renamed originals reuse variants only on an identical full ETag', () => {
 const originals=[{key:'photos/originals/editorial/new.jpg',etag:'1234567890abcdef'},{key:'photos/originals/exhibitions/old.jpg',etag:'1234567890abcdef'}];
 const variants=['800','1600'].map(size=>({key:`photos/variants/exhibitions/${size}/old-1234567890.webp`}));
 assert.match(buildCatalog([...originals,...variants])[0].large,/variants\/exhibitions\/1600\/old/);
 originals[0].etag='1234567890DIFFERENT';
 assert.match(buildCatalog([...originals,...variants])[0].large,/originals\/editorial\/new/);
});
