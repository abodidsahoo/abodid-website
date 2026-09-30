import assert from 'node:assert/strict';
import test from 'node:test';

import {
    hasOwnerExclusionRequest,
    shouldLoadGoogleAnalytics,
} from '../../src/lib/analytics/google-tag-policy.js';

test('loads GA only on public abodid.com pages', () => {
    assert.equal(shouldLoadGoogleAnalytics({ hostname: 'abodid.com', pathname: '/obsidian-tutoring' }), true);
    assert.equal(shouldLoadGoogleAnalytics({ hostname: 'curation.abodid.com', pathname: '/resources' }), true);
    assert.equal(shouldLoadGoogleAnalytics({ hostname: 'localhost', pathname: '/lab/audio-visualiser' }), false);
    assert.equal(shouldLoadGoogleAnalytics({ hostname: '127.0.0.1', pathname: '/' }), false);
    assert.equal(shouldLoadGoogleAnalytics({ hostname: 'preview.vercel.app', pathname: '/' }), false);
});

test('never loads GA on internal routes or owner-excluded browsers', () => {
    assert.equal(shouldLoadGoogleAnalytics({ hostname: 'abodid.com', pathname: '/admin/dashboard' }), false);
    assert.equal(shouldLoadGoogleAnalytics({ hostname: 'abodid.com', pathname: '/work/layout-preview' }), false);
    assert.equal(shouldLoadGoogleAnalytics({ hostname: 'abodid.com', pathname: '/', cookie: 'abodid_analytics_exclude=1' }), false);
    assert.equal(shouldLoadGoogleAnalytics({ hostname: 'abodid.com', pathname: '/', storageExcluded: true }), false);
});

test('recognises the explicit owner opt-out URL', () => {
    assert.equal(hasOwnerExclusionRequest('?owner=1'), true);
    assert.equal(hasOwnerExclusionRequest('?exclude_analytics=1'), true);
    assert.equal(hasOwnerExclusionRequest('?utm_source=linkedin'), false);
});

