import assert from 'node:assert/strict';
import test from 'node:test';
import {
    emptyAnalyticsReport,
    getAnalyticsRangeStart,
    normalizeAnalyticsRange,
    normalizeAnalyticsTrafficClass,
} from '../../src/lib/analytics/reporting.js';

test('normalizes unsupported analytics ranges', () => {
    assert.equal(normalizeAnalyticsRange('30d'), '30d');
    assert.equal(normalizeAnalyticsRange('year'), '7d');
    assert.equal(normalizeAnalyticsRange(null), '7d');
});

test('defaults analytics traffic to credible human sessions', () => {
    assert.equal(normalizeAnalyticsTrafficClass('human'), 'human');
    assert.equal(normalizeAnalyticsTrafficClass('filtered'), 'filtered');
    assert.equal(normalizeAnalyticsTrafficClass('all'), 'human');
    assert.equal(normalizeAnalyticsTrafficClass(null), 'human');
});

test('builds rolling report windows', () => {
    const now = new Date('2026-07-13T12:00:00.000Z');
    assert.equal(getAnalyticsRangeStart('7d', now).toISOString(), '2026-07-06T12:00:00.000Z');
    assert.equal(getAnalyticsRangeStart('30d', now).toISOString(), '2026-06-13T12:00:00.000Z');
    assert.equal(getAnalyticsRangeStart('90d', now).toISOString(), '2026-04-14T12:00:00.000Z');
});

test('uses the admin timezone for the Today boundary', () => {
    const now = new Date('2026-07-13T12:00:00.000Z');
    const indiaOffset = -330;
    assert.equal(
        getAnalyticsRangeStart('today', now, indiaOffset).toISOString(),
        '2026-07-12T18:30:00.000Z',
    );
});

test('provides a chart-safe empty analytics report', () => {
    const report = emptyAnalyticsReport();
    assert.deepEqual(report.timeline, []);
    assert.deepEqual(report.sources, []);
    assert.equal(report.summary.pageViews, 0);
    assert.equal(report.navigation.summary.opens, 0);
    assert.equal(report.navigation.summary.selectionRate, 0);
    assert.deepEqual(report.navigation.links, []);
    assert.deepEqual(report.navigation.countries, []);
});
