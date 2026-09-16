import assert from 'node:assert/strict';
import test from 'node:test';
import {
    calculateRevenueFunnels,
    detectSessionFriction,
    generateSyntheticIntelligenceReport,
    inferSessionIntent,
} from '../../src/lib/analytics/intelligence.js';

test('infers commercial intent from visited paths', () => {
    const photoPages = [
        { path: '/photography', engagedSeconds: 30 },
        { path: '/photo-stories/silent-monoliths', engagedSeconds: 60 },
        { path: '/contact?service=photography', engagedSeconds: 40 },
    ];
    const photoIntent = inferSessionIntent(photoPages);
    assert.equal(photoIntent.category, 'photography');
    assert.equal(photoIntent.strength, 'High');

    const obsidianPages = [
        { path: '/obsidian-tutoring', engagedSeconds: 45 },
        { path: '/payments', engagedSeconds: 60 },
    ];
    const obsidianIntent = inferSessionIntent(obsidianPages);
    assert.equal(obsidianIntent.category, 'obsidian');

    const techPages = [
        { path: '/lab', engagedSeconds: 20 },
        { path: '/xr-showcase', engagedSeconds: 50 },
        { path: '/contact?service=creative-tech', engagedSeconds: 30 },
    ];
    const techIntent = inferSessionIntent(techPages);
    assert.equal(techIntent.category, 'creative_tech');

    const filmPages = [
        { path: '/films', engagedSeconds: 40 },
        { path: '/brands', engagedSeconds: 30 },
    ];
    const filmIntent = inferSessionIntent(filmPages);
    assert.equal(filmIntent.category, 'film_brand');
});

test('detects friction signals in sessions', () => {
    const quickExitSession = {
        totalEngagedSeconds: 3,
        pages: [{ path: '/photography' }],
        events: [],
    };
    const friction = detectSessionFriction(quickExitSession);
    assert.ok(friction.includes('quick_exit'));

    const pricingAbandonSession = {
        totalEngagedSeconds: 60,
        pages: [{ path: '/obsidian-tutoring' }, { path: '/payments' }],
        events: [],
        converted: false,
    };
    const pricingFriction = detectSessionFriction(pricingAbandonSession);
    assert.ok(pricingFriction.includes('pricing_abandoned'));

    const formAbandonSession = {
        totalEngagedSeconds: 90,
        pages: [{ path: '/contact' }],
        events: [{ type: 'form_start' }],
        converted: false,
    };
    const formFriction = detectSessionFriction(formAbandonSession);
    assert.ok(formFriction.includes('form_abandoned'));
});

test('calculates funnels and finds largest leakage point', () => {
    const sampleSessions = [
        { id: '1', pages: [{ path: '/photography' }, { path: '/photo-stories/1' }, { path: '/testimonials' }, { path: '/contact?service=photography' }], converted: true, intent_category: 'photography' },
        { id: '2', pages: [{ path: '/photography' }, { path: '/photo-stories/1' }], converted: false, intent_category: 'photography' },
        { id: '3', pages: [{ path: '/photography' }], converted: false, intent_category: 'photography' },
    ];
    const funnels = calculateRevenueFunnels(sampleSessions);
    assert.ok(funnels.photography);
    assert.equal(funnels.photography.totalDiscovery, 3);
    assert.equal(funnels.photography.totalConverted, 1);
    assert.ok(funnels.photography.largestLeakage);
});

test('generates valid progressive intelligence report', () => {
    const report = generateSyntheticIntelligenceReport('7d');
    assert.ok(report.overview.meaningfulVisitors > 0);
    assert.ok(report.overview.revenueBreakdown.length === 4);
    assert.ok(report.revenueJourneys.photography);
    assert.ok(report.revenueJourneys.obsidian);
    assert.ok(report.revenueJourneys.creative_tech);
    assert.ok(report.revenueJourneys.film_brand);
    assert.ok(report.dropoffs.diagnostics.length > 0);
    assert.ok(report.visitors.feed.length > 0);
    assert.ok(report.replays.sessions.length > 0);
});
