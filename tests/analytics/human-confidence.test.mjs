import assert from 'node:assert/strict';
import test from 'node:test';
import {
    calculateHumanConfidence,
    HUMAN_CONFIDENCE_TIERS,
} from '../../src/lib/analytics/human-confidence.js';

test('does not qualify passive or scroll-only traffic', () => {
    assert.equal(calculateHumanConfidence({ activeSeconds: 90 }).qualified, false);
    assert.equal(calculateHumanConfidence({
        activeSeconds: 90,
        scrollCount: 20,
        maxScrollDepth: 0.9,
    }).qualified, false);
});

test('qualifies a short visit only after scroll, click, and human input', () => {
    const result = calculateHumanConfidence({
        activeSeconds: 8,
        scrollCount: 2,
        maxScrollDepth: 0.3,
        genuineClicks: 1,
        pointerSamples: 4,
    });
    assert.equal(result.qualified, true);
    assert.equal(result.tier, HUMAN_CONFIDENCE_TIERS.MEANINGFUL);
});

test('recognises high-intent and exceptional content journeys', () => {
    const highIntent = calculateHumanConfidence({
        activeSeconds: 35,
        pageViews: 2,
        scrollCount: 3,
        maxScrollDepth: 0.7,
        genuineClicks: 2,
        pointerSamples: 8,
        contentInteractions: 1,
    });
    assert.equal(highIntent.tier, HUMAN_CONFIDENCE_TIERS.HIGH_INTENT);

    const exceptional = calculateHumanConfidence({
        activeSeconds: 65,
        pageViews: 2,
        scrollCount: 3,
        maxScrollDepth: 0.7,
        genuineClicks: 2,
        pointerSamples: 8,
        contentInteractions: 1,
    });
    assert.equal(exceptional.tier, HUMAN_CONFIDENCE_TIERS.EXCEPTIONAL);
});

test('client form signals do not bypass human checks while rejected spam is filtered', () => {
    assert.equal(calculateHumanConfidence({ formSubmitted: true }).tier, HUMAN_CONFIDENCE_TIERS.FILTERED);
    assert.equal(calculateHumanConfidence({ formSubmitted: true, spamRejected: true }).tier, HUMAN_CONFIDENCE_TIERS.FILTERED);
});
