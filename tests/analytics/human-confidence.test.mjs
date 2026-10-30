import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateHumanConfidence, HUMAN_CONFIDENCE_TIERS } from '../../src/lib/analytics/human-confidence.js';

const pointer = { pointerSamples: 8, pointerDistance: 180, pointerDurationMs: 720, pointerDirectionChanges: 2 };
const scrolling = { intentionalScrollSamples: 4, intentionalScrollDistance: 300, scrollBursts: 2, scrollDirectionChanges: 1 };

test('duration alone never establishes a human, including a long idle tab', () => {
    for (const activeSeconds of [1, 3, 5, 120, 10000]) {
        assert.equal(calculateHumanConfidence({ activeSeconds }).qualified, false);
    }
    assert.equal(calculateHumanConfidence({ activeSeconds: 3 }).recordable, true);
    assert.equal(calculateHumanConfidence({ activeSeconds: 0 }).recordable, false);
});

test('varied pointer movement can qualify independently of the five-second display limit', () => {
    const result = calculateHumanConfidence({ activeSeconds: 2, ...pointer });
    assert.equal(result.qualified, true);
    assert.equal(result.signals.evidenceLevel, 'likely_human');
    assert.ok(result.reasons.includes('varied_pointer_movement'));
    assert.equal(calculateHumanConfidence({ pointerSamples: 100 }).qualified, false);
});

test('programmatic scrolling and depth alone provide no human evidence', () => {
    assert.equal(calculateHumanConfidence({ activeSeconds: 30, scrollCount: 30, maxScrollDepth: 1 }).qualified, false);
    assert.equal(calculateHumanConfidence({ activeSeconds: 1, ...scrolling }).qualified, true);
});

test('touch and keyboard routes qualify without requiring mouse movement', () => {
    const keyboard = calculateHumanConfidence({ activeSeconds: 1, keyInteractions: 2, genuineClicks: 1 });
    assert.equal(keyboard.qualified, true);
    const touch = calculateHumanConfidence({ touchInteractions: 1, ...scrolling });
    assert.equal(touch.qualified, true);
    assert.equal(calculateHumanConfidence({ keyInteractions: 2 }).qualified, false);
});

test('independent evidence raises the tier without converting a heuristic score into a probability', () => {
    assert.equal(calculateHumanConfidence({ ...pointer, ...scrolling }).tier, HUMAN_CONFIDENCE_TIERS.HIGH_INTENT);
    assert.equal(calculateHumanConfidence({ ...pointer, ...scrolling, genuineClicks: 2, pageViews: 2 }).tier, HUMAN_CONFIDENCE_TIERS.EXCEPTIONAL);
});

test('client form flags, known bots, and browser automation cannot bypass qualification', () => {
    assert.equal(calculateHumanConfidence({ formSubmitted: true }).qualified, false);
    for (const excluded of [{ knownBot: true }, { webdriver: true }, { spamRejected: true }]) {
        const result = calculateHumanConfidence({ ...pointer, activeSeconds: 120, ...excluded });
        assert.equal(result.qualified, false);
        assert.equal(result.recordable, false);
        assert.equal(result.score, 0);
    }
});
