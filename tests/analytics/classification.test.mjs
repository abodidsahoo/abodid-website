import assert from 'node:assert/strict';
import test from 'node:test';
import {
    classifyAcquisitionSource,
    extractClientIp,
    extractSearchKeyword,
    getReferrerDomain,
    isAnalyticsBot,
    isExcludedDeveloperLocation,
    isExcludedIpAddress,
    isLocalAnalyticsUrl,
    isSameOriginAnalyticsRequest,
    resolveAnalyticsCountry,
    resolveAnalyticsCity,
    resolveAnalyticsRegion,
    shouldTrackAnalyticsPath,
} from '../../src/lib/analytics/classification.js';

const siteOrigin = 'https://abodid.com';

test('classifies the required acquisition sources', () => {
    const cases = [
        ['https://www.google.com/search?q=abodid', 'Google Search'],
        ['https://www.bing.com/search?q=abodid', 'Bing Search'],
        ['https://chatgpt.com/c/example', 'ChatGPT'],
        ['https://www.perplexity.ai/search/example', 'Perplexity'],
        ['https://claude.ai/chat/example', 'Claude'],
        ['https://gemini.google.com/app/example', 'Gemini'],
        ['https://www.linkedin.com/feed/', 'LinkedIn'],
        ['https://t.co/example', 'X / Twitter'],
        ['https://l.instagram.com/', 'Instagram'],
        ['https://example.org/post', 'External Website'],
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
    assert.equal(classifyAcquisitionSource({ referrer: '', siteOrigin }), 'Direct Visit');
    assert.equal(classifyAcquisitionSource({ referrer: 'https://abodid.com/work', siteOrigin }), 'Direct Visit');
    assert.equal(classifyAcquisitionSource({ utmSource: 'summer_newsletter', utmMedium: 'email', siteOrigin }), 'Email Campaign');
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

test('reads an optional readable city and region from trusted hosting headers', () => {
    assert.equal(resolveAnalyticsCity(new Headers({ 'x-vercel-ip-city': 'Bhubaneswar' })), 'Bhubaneswar');
    assert.equal(resolveAnalyticsCity(new Headers({ 'x-vercel-ip-city': 'New%20York' })), 'New York');
    assert.equal(resolveAnalyticsCity(new Headers()), '');
    assert.equal(resolveAnalyticsRegion(new Headers({ 'x-vercel-ip-country-region': 'OR' })), 'OR');
});

test('excludes local collection endpoints and dev ports server-side', () => {
    assert.equal(isLocalAnalyticsUrl('http://localhost:4321/api/analytics/collect'), true);
    assert.equal(isLocalAnalyticsUrl('http://127.0.0.1:4321/api/analytics/collect'), true);
    assert.equal(isLocalAnalyticsUrl('http://192.168.1.50:3000/api/analytics/collect'), true);
    assert.equal(isLocalAnalyticsUrl('http://10.0.0.5:5173/api/analytics/collect'), true);
    assert.equal(isLocalAnalyticsUrl('https://abodid.com/api/analytics/collect'), false);
});

test('extracts client IP from proxy headers', () => {
    assert.equal(extractClientIp(new Headers({ 'x-forwarded-for': '203.0.113.195, 70.41.3.18' })), '203.0.113.195');
    assert.equal(extractClientIp(new Headers({ 'cf-connecting-ip': '198.51.100.1' })), '198.51.100.1');
    assert.equal(extractClientIp(new Headers()), '');
});

test('identifies loopback and private LAN IP addresses for exclusion', () => {
    assert.equal(isExcludedIpAddress('127.0.0.1'), true);
    assert.equal(isExcludedIpAddress('127.0.0.5'), true);
    assert.equal(isExcludedIpAddress('::1'), true);
    assert.equal(isExcludedIpAddress('192.168.1.10'), true);
    assert.equal(isExcludedIpAddress('10.0.4.20'), true);
    assert.equal(isExcludedIpAddress('172.16.0.1'), true);
    assert.equal(isExcludedIpAddress('172.31.255.255'), true);
    assert.equal(isExcludedIpAddress('8.8.8.8'), false);
});

test('identifies owner configured excluded IPs and wildcard ranges', () => {
    const customEnv = { OWNER_EXCLUDED_IPS: '203.0.113.50, 198.51.100.*' };
    assert.equal(isExcludedIpAddress('203.0.113.50', customEnv), true);
    assert.equal(isExcludedIpAddress('198.51.100.44', customEnv), true);
    assert.equal(isExcludedIpAddress('198.51.101.44', customEnv), false);
    assert.equal(isExcludedIpAddress('203.0.113.51', customEnv), false);
});

test('identifies developer locality exclusions', () => {
    const customEnv = {
        OWNER_EXCLUDED_CITIES: 'Bhubaneswar, Cuttack',
        OWNER_EXCLUDED_REGIONS: 'OR',
    };
    assert.equal(isExcludedDeveloperLocation({ city: 'Bhubaneswar' }, customEnv), true);
    assert.equal(isExcludedDeveloperLocation({ city: 'Cuttack' }, customEnv), true);
    assert.equal(isExcludedDeveloperLocation({ city: 'Mumbai' }, customEnv), false);
    assert.equal(isExcludedDeveloperLocation({ region: 'OR' }, customEnv), true);
    assert.equal(isExcludedDeveloperLocation({ region: 'MH' }, customEnv), false);
});

test('extracts search keywords from utm terms and referrer query params', () => {
    assert.equal(extractSearchKeyword({ utmTerm: 'odisha photo tour' }), 'odisha photo tour');
    assert.equal(extractSearchKeyword({ utmCampaign: 'obsidian-vault-launch' }), 'obsidian-vault-launch');
    assert.equal(extractSearchKeyword({ referrer: 'https://www.google.com/search?q=video+editing+mentor' }), 'video editing mentor');
    assert.equal(extractSearchKeyword({ referrer: 'https://www.bing.com/search?q=creative+technologist' }), 'creative technologist');
    assert.equal(extractSearchKeyword({ referrer: 'https://linkedin.com/feed' }), '');
});

