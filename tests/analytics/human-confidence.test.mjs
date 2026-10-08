import assert from 'node:assert/strict';
import test from 'node:test';
import {
    calculateHumanConfidence,
    HUMAN_CONFIDENCE_TIERS,
} from '../../src/lib/analytics/human-confidence.js';

test('filters one- and two-second scans but retains a visible three-second visit', () => {
    assert.equal(calculateHumanConfidence({ activeSeconds: 1 }).qualified, false);
    assert.equal(calculateHumanConfidence({ activeSeconds: 2 }).qualified, false);
    assert.equal(calculateHumanConfidence({ activeSeconds: 3 }).qualified, true);
    assert.equal(calculateHumanConfidence({ activeSeconds: 3 }).tier, HUMAN_CONFIDENCE_TIERS.MEANINGFUL);
});

test('interaction signals raise confidence for a short human visit', () => {
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

test('known bots remain filtered even after sustained activity', () => {
    const result = calculateHumanConfidence({ activeSeconds: 120, knownBot: true });
    assert.equal(result.qualified, false);
    assert.equal(result.tier, HUMAN_CONFIDENCE_TIERS.FILTERED);
});
