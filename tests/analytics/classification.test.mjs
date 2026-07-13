import assert from 'node:assert/strict';
import test from 'node:test';
import {
    classifyAcquisitionSource,
    getReferrerDomain,
    isAnalyticsBot,
    isLocalAnalyticsUrl,
    isSameOriginAnalyticsRequest,
    resolveAnalyticsCountry,
    shouldTrackAnalyticsPath,
} from '../../src/lib/analytics/classification.js';

const siteOrigin = 'https://abodid.com';

test('classifies the required acquisition sources', () => {
    const cases = [
        ['https://www.google.com/search?q=abodid', 'Google'],
        ['https://chatgpt.com/c/example', 'ChatGPT'],
        ['https://www.perplexity.ai/search/example', 'Perplexity'],
        ['https://claude.ai/chat/example', 'Claude'],
        ['https://gemini.google.com/app/example', 'Gemini'],
        ['https://www.linkedin.com/feed/', 'LinkedIn'],
        ['https://t.co/example', 'X / Twitter'],
        ['https://l.instagram.com/', 'Instagram'],
        ['https://example.org/post', 'example.org'],
    ];

    for (const [referrer, expected] of cases) {
        assert.equal(classifyAcquisitionSource({ referrer, siteOrigin }), expected);
    }
});

test('UTM source takes precedence and direct or internal traffic stays unknown', () => {
    assert.equal(classifyAcquisitionSource({
        utmSource: 'linkedin',
        referrer: 'https://google.com',
        siteOrigin,
    }), 'LinkedIn');
    assert.equal(classifyAcquisitionSource({ referrer: '', siteOrigin }), 'Direct / Unknown');
    assert.equal(classifyAcquisitionSource({ referrer: 'https://abodid.com/work', siteOrigin }), 'Direct / Unknown');
    assert.equal(classifyAcquisitionSource({ utmSource: 'summer_newsletter', siteOrigin }), 'Summer Newsletter');
    assert.equal(classifyAcquisitionSource({ utmSource: 'example_campaign', siteOrigin }), 'Example Campaign');
});

test('stores only a normalized referrer domain', () => {
    assert.equal(getReferrerDomain('https://www.Example.com/private/path?q=email'), 'example.com');
    assert.equal(getReferrerDomain('not a url'), '');
});

test('excludes internal routes and automated agents', () => {
    assert.equal(shouldTrackAnalyticsPath('/work/example'), true);
    assert.equal(shouldTrackAnalyticsPath('/admin'), false);
    assert.equal(shouldTrackAnalyticsPath('/api/contact'), false);
    assert.equal(shouldTrackAnalyticsPath('/preview/project'), false);
    assert.equal(shouldTrackAnalyticsPath('/hand-tracking-test'), false);
    assert.equal(isAnalyticsBot('Mozilla/5.0 (compatible; Googlebot/2.1)'), true);
    assert.equal(isAnalyticsBot('Mozilla/5.0 AppleWebKit Safari/17.5'), false);
});

test('accepts same-origin collection and rejects cross-site collection', () => {
    const sameOrigin = new Request('https://abodid.com/api/analytics/collect', {
        headers: { origin: 'https://abodid.com', 'sec-fetch-site': 'same-origin' },
    });
    const crossSite = new Request('https://abodid.com/api/analytics/collect', {
        headers: { origin: 'https://malicious.example', 'sec-fetch-site': 'cross-site' },
    });

    assert.equal(isSameOriginAnalyticsRequest(sameOrigin), true);
    assert.equal(isSameOriginAnalyticsRequest(crossSite), false);
});

test('reads a country code without retaining an IP address', () => {
    assert.equal(resolveAnalyticsCountry(new Headers({ 'x-vercel-ip-country': 'in' })), 'IN');
    assert.equal(resolveAnalyticsCountry(new Headers()), 'Unknown');
    assert.equal(resolveAnalyticsCountry(new Headers({ 'x-vercel-ip-country': 'invalid' })), 'Unknown');
});

test('excludes local collection endpoints server-side', () => {
    assert.equal(isLocalAnalyticsUrl('http://localhost:4321/api/analytics/collect'), true);
    assert.equal(isLocalAnalyticsUrl('http://127.0.0.1:4321/api/analytics/collect'), true);
    assert.equal(isLocalAnalyticsUrl('https://abodid.com/api/analytics/collect'), false);
});
