import assert from 'node:assert/strict';
import test from 'node:test';
import {
    canonicalizeSourceUrl,
    isSpecificSourcePage,
    matchMoodboardItem,
    promoteTemporalMatches,
} from '../../scripts/backfill-moodboard-sources.mjs';

const visit = (overrides = {}) => ({
    canonical_url: 'https://www.behance.net/gallery/254281125/Anti-Myopic-Drop',
    from_visit: 0,
    profile: 'Default',
    title: 'Anti Myopic Drop :: Behance',
    url: 'https://www.behance.net/gallery/254281125/Anti-Myopic-Drop?tracking_source=feed',
    visit_id: 1,
    visited_at: Date.parse('2026-10-13T19:33:44Z') / 1000,
    ...overrides,
});

test('canonicalizes known tracking parameters from source pages', () => {
    assert.equal(
        canonicalizeSourceUrl('https://www.behance.net/gallery/254281125/Anti-Myopic-Drop?tracking_source=feed&utm_medium=social'),
        'https://www.behance.net/gallery/254281125/Anti-Myopic-Drop',
    );
});

test('rejects generic and private pages as source candidates', () => {
    assert.equal(isSpecificSourcePage('http://localhost:4321/admin/dashboard'), false);
    assert.equal(isSpecificSourcePage('https://chatgpt.com/c/private-conversation'), false);
    assert.equal(isSpecificSourcePage('https://www.behance.net/'), false);
    assert.equal(isSpecificSourcePage('https://www.behance.net/gallery/254281125/Anti-Myopic-Drop'), true);
});

test('matches a Behance page id embedded inside the stored image filename', () => {
    const result = matchMoodboardItem({
        created_at: '2026-10-13T19:33:50.652Z',
        image_url: '',
        storage_path: 'assets/photos/originals/moodboard/e5f06c254281125-6a7f04c1823fb.jpg',
        title: 'e5f06c254281125-6a7f04c1823fb',
    }, [visit()]);

    assert.equal(result?.source_url, 'https://www.behance.net/gallery/254281125/Anti-Myopic-Drop');
    assert.equal(result?.confidence, 0.995);
    assert.match(result?.evidence[0] || '', /embedded page id/);
});

test('does not guess from an unrelated page outside the upload window', () => {
    const result = matchMoodboardItem({
        created_at: '2026-10-13T19:33:50.652Z',
        image_url: '',
        storage_path: 'assets/photos/originals/moodboard/unrelated-image.jpg',
        title: 'unrelated image',
    }, [visit({
        canonical_url: 'https://example.com/articles/different-subject',
        title: 'Different subject',
        url: 'https://example.com/articles/different-subject',
        visited_at: Date.parse('2026-10-13T18:00:00Z') / 1000,
    })]);

    assert.equal(result, null);
});

test('does not use a later visit to the moodboard CDN as filename evidence', () => {
    const result = matchMoodboardItem({
        created_at: '2026-02-14T18:58:06.782Z',
        image_url: '',
        storage_path: 'assets/photos/originals/moodboard/old-image.webp',
        title: 'old image',
    }, [visit({
        canonical_url: 'https://assets.abodid.com/photos/originals/moodboard/old-image.webp',
        from_visit: 0,
        title: 'old-image.webp',
        url: 'https://assets.abodid.com/photos/originals/moodboard/old-image.webp',
        visited_at: Date.parse('2026-09-12T07:23:53Z') / 1000,
    })]);

    assert.equal(result, null);
});

test('prefers distinctive filename words over a merely closer unrelated page', () => {
    const result = matchMoodboardItem({
        created_at: '2026-10-10T14:39:45.876Z',
        image_url: '',
        storage_path: 'assets/photos/originals/moodboard/661fadc6e7d3a4d0341db4c9-collina-strada-aw24-stronger-3.webp',
        title: 'collina strada aw24 stronger',
    }, [
        visit({
            canonical_url: 'https://www.brv.computer/projects/collina-strada',
            title: 'Collina Strada',
            url: 'https://www.brv.computer/projects/collina-strada',
            visit_id: 2,
            visited_at: Date.parse('2026-10-10T14:38:55Z') / 1000,
        }),
        visit({
            canonical_url: 'https://www.withlight.studio/projects/louis-vuitton',
            title: 'Louis Vuitton Fall / Winter 2025',
            url: 'https://www.withlight.studio/projects/louis-vuitton',
            visit_id: 3,
            visited_at: Date.parse('2026-10-10T14:39:54Z') / 1000,
        }),
    ]);

    assert.equal(result?.source_url, 'https://www.brv.computer/projects/collina-strada');
    assert.equal(result?.confidence, 0.985);
});

test('promotes visual posts and repeated timestamp clusters but leaves isolated guesses low', () => {
    const base = {
        confidence: 0.97,
        evidence: ['only specific Chrome page within the 30-second upload window'],
        score: 75,
    };
    const promoted = promoteTemporalMatches([
        { ...base, id: 'instagram', source_url: 'https://www.instagram.com/p/example' },
        { ...base, id: 'cluster-1', source_url: 'https://example.com/project/one' },
        { ...base, id: 'cluster-2', source_url: 'https://example.com/project/one' },
        { ...base, id: 'isolated', source_url: 'https://example.com/project/two' },
    ]);

    assert.equal(promoted.find((entry) => entry.id === 'instagram')?.confidence, 0.985);
    assert.equal(promoted.find((entry) => entry.id === 'cluster-1')?.confidence, 0.98);
    assert.equal(promoted.find((entry) => entry.id === 'cluster-2')?.confidence, 0.98);
    assert.equal(promoted.find((entry) => entry.id === 'isolated')?.confidence, 0.97);
});

test('uses an immediately preceding page when Chrome omitted the image referrer', () => {
    const result = matchMoodboardItem({
        created_at: '2026-10-10T14:39:45.876Z',
        image_url: '',
        storage_path: 'assets/photos/originals/moodboard/distinctive-image.jpg',
        title: 'distinctive image',
    }, [
        visit({
            canonical_url: 'https://example.com/projects/editorial',
            title: 'Editorial',
            url: 'https://example.com/projects/editorial',
            visit_id: 2,
            visited_at: Date.parse('2026-10-10T14:39:30Z') / 1000,
        }),
        visit({
            canonical_url: 'https://cdn.example.net/distinctive-image.jpg',
            from_visit: 0,
            title: 'distinctive-image.jpg',
            url: 'https://cdn.example.net/distinctive-image.jpg',
            visit_id: 3,
            visited_at: Date.parse('2026-10-10T14:39:35Z') / 1000,
        }),
    ]);

    assert.equal(result?.source_url, 'https://example.com/projects/editorial');
    assert.equal(result?.confidence, 0.985);
    assert.match(result?.evidence[0] || '', /immediately preceding/);
});

