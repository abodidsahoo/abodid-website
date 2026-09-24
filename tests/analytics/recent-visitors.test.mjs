import assert from 'node:assert/strict';
import test from 'node:test';
import {
    describeRecentVisitor,
    formatVisitorTimeAgo,
    getRecentVisitorCount,
    getVisitorCountry,
    getVisitorSource,
    selectRecentHumanVisitors,
} from '../../src/lib/analytics/recent-visitors.js';

test('uses the exact human visitor count from the report summary', () => {
    assert.equal(getRecentVisitorCount({ summary: { visitors: 17 } }), 17);
    assert.equal(getRecentVisitorCount({ summary: { visitors: 0 } }), 0);
    assert.equal(getRecentVisitorCount({}), 0);
});

test('selects the seven newest unique visitors from the human feed', () => {
    const feed = Array.from({ length: 9 }, (_, index) => ({
        visitorId: `visitor-${index}`,
        startedAt: new Date(Date.UTC(2026, 8, 24, index)).toISOString(),
    }));
    feed.push({ visitorId: 'visitor-8', startedAt: '2026-09-24T23:00:00.000Z' });

    const selected = selectRecentHumanVisitors({ visitors: { feed } }, 7);
    assert.equal(selected.length, 7);
    assert.equal(selected[0].visitorId, 'visitor-8');
    assert.equal(new Set(selected.map((visitor) => visitor.visitorId)).size, 7);
});

test('fills the carousel from the human report journeys when the high-signal feed is short', () => {
    const report = {
        visitors: {
            feed: [{ sessionId: 'session-1', visitorId: 'visitor-1', startedAt: '2026-09-24T12:00:00.000Z' }],
        },
        journeys: Array.from({ length: 7 }, (_, index) => ({
            id: `session-${index + 1}`,
            country: 'IN',
            source: 'Google Search',
            startedAt: new Date(Date.UTC(2026, 8, 24, 11 - index)).toISOString(),
        })),
    };

    const selected = selectRecentHumanVisitors(report, 7);
    assert.equal(selected.length, 7);
    assert.equal(selected.filter((visitor) => (visitor.sessionId || visitor.id) === 'session-1').length, 1);
});

test('describes country, source, and relative time without inventing fields', () => {
    const now = Date.parse('2026-09-24T12:00:00.000Z');
    const visitor = {
        country: 'IN',
        source: 'Google',
        startedAt: '2026-09-24T06:00:00.000Z',
    };

    assert.equal(getVisitorCountry(visitor), 'India');
    assert.equal(getVisitorSource(visitor), 'Google');
    assert.equal(formatVisitorTimeAgo(visitor, now), '6 hours ago');
    assert.equal(describeRecentVisitor(visitor, now), '1 visitor from India came from Google 6 hours ago.');
});

test('describes direct traffic explicitly', () => {
    const now = Date.parse('2026-09-24T12:00:00.000Z');
    const visitor = {
        country: 'GB',
        source: 'Direct Visit',
        startedAt: '2026-09-24T11:00:00.000Z',
    };

    assert.equal(describeRecentVisitor(visitor, now), '1 visitor from United Kingdom arrived directly 1 hour ago.');
});

test('describes visitor including primary visited page when available', () => {
    const now = Date.parse('2026-09-24T12:00:00.000Z');
    const visitor1 = {
        country: 'SG',
        source: 'Direct',
        startedAt: '2026-09-20T12:00:00.000Z',
        landingPage: '/photography',
    };
    assert.equal(
        describeRecentVisitor(visitor1, now),
        '1 visitor from Singapore arrived directly 4 days ago, primarily visiting Photography.'
    );

    const visitor2 = {
        country: 'SG',
        source: 'Direct Visit',
        startedAt: '2026-09-20T12:00:00.000Z',
        entryPage: { path: '/', title: 'Home' },
    };
    assert.equal(
        describeRecentVisitor(visitor2, now),
        '1 visitor from Singapore arrived directly 4 days ago, primarily visiting the Home page.'
    );
});
