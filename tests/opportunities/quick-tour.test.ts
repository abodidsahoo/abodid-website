import { describe, expect, it } from 'vitest';
import { opportunityTourStorageKey, readOpportunityTourStep, positionOpportunityTour } from '../../src/lib/opportunities/tour';

describe('Opportunity quick tour', () => {
    it('starts once, resumes an unfinished tour, and respects dismissal', () => {
        expect(readOpportunityTourStep(null)).toBe(0);
        expect(readOpportunityTourStep('{"step":2,"complete":false}')).toBe(2);
        expect(readOpportunityTourStep('{"step":0,"complete":true}')).toBeNull();
        expect(readOpportunityTourStep('{"step":99}')).toBe(0);
        expect(readOpportunityTourStep('broken storage')).toBe(0);
    });
    it('keeps progress scoped to the current collection owner', () => {
        expect(opportunityTourStorageKey('  Abodid  ')).toBe('opportunity-quick-tour:v1:abodid');
        expect(opportunityTourStorageKey('alice')).not.toBe(opportunityTourStorageKey('bob'));
    });
    it('places a card below the highlighted feature with an 18px gap', () => {
        const target = { top: 100, bottom: 220, left: 14, width: 292 };
        const result = positionOpportunityTour(target, { width: 292, height: 280 }, { width: 320, height: 568 });
        expect(result.top).toBe(238);
        expect(result.left).toBe(14);
        expect(result.top + 280).toBeLessThan(568);
        expect(result.placement).toBe('below');
    });
    it('flips above a feature near the viewport bottom', () => {
        const result = positionOpportunityTour({ top: 650, bottom: 694, left: 1000, width: 100 }, { width: 360, height: 260 }, { width: 1200, height: 800 });
        expect(result.placement).toBe('above');
        expect(result.top + 260).toBeLessThan(650);
        expect(result.left + 360).toBeLessThanOrEqual(1186);
    });
});
