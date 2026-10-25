import { describe, expect, it } from 'vitest';
import { cleanOpportunityListingUrl } from '../../src/lib/opportunities/listingUrl';

describe('Opportunity listing links', () => {
    it('removes campaign and chat referral tracking while preserving page identity', () => {
        expect(cleanOpportunityListingUrl('https://example.com/listing?id=42&utm_source=chatgpt.com&utm_medium=share&fbclid=abc&ref=chatgpt.com#eligibility'))
            .toBe('https://example.com/listing?id=42#eligibility');
    });

    it('unwraps a known redirect and cleans the destination', () => {
        const destination = 'https://example.com/opportunities?opportunity=10&gclid=abc';
        expect(cleanOpportunityListingUrl(`https://www.linkedin.com/safety/go?url=${encodeURIComponent(destination)}`))
            .toBe('https://example.com/opportunities?opportunity=10');
    });

    it('preserves functional form query parameters', () => {
        expect(cleanOpportunityListingUrl('https://docs.google.com/forms/d/e/abc/viewform?entry.123=Artist&utm_campaign=share'))
            .toBe('https://docs.google.com/forms/d/e/abc/viewform?entry.123=Artist');
    });

    it('hides missing, unsafe, and synthetic direct-entry links', () => {
        for (const url of [null, '', 'not a url', 'javascript:alert(1)', 'https://direct.entry/opportunity/123']) {
            expect(cleanOpportunityListingUrl(url)).toBeNull();
        }
    });
});
