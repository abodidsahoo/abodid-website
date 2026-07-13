import assert from 'node:assert/strict';
import test from 'node:test';

import {
    AudienceSelectionError,
    MAX_TARGETED_RECIPIENTS,
    resolveNewsletterAudience,
} from '../../src/lib/newsletter/recipientSelection.js';

const subscriberIdA = '857ea439-8a47-4774-b837-2e8c73ad57db';
const subscriberIdB = 'ddce102e-03cd-4e2b-a598-b61dcb7c60ff';

test('defaults non-test sends to all active subscribers', () => {
    assert.deepEqual(resolveNewsletterAudience(), {
        mode: 'all',
        recipientIds: [],
    });
});

test('keeps test sends isolated from broadcast audience options', () => {
    assert.deepEqual(
        resolveNewsletterAudience({
            isTest: true,
            audienceMode: 'selected',
            recipientIds: [],
        }),
        { mode: 'test', recipientIds: [] },
    );
});

test('normalizes and deduplicates selected subscriber IDs', () => {
    assert.deepEqual(
        resolveNewsletterAudience({
            audienceMode: 'selected',
            recipientIds: [subscriberIdA.toUpperCase(), subscriberIdB, subscriberIdA],
        }),
        {
            mode: 'selected',
            recipientIds: [subscriberIdA, subscriberIdB],
        },
    );
});

test('rejects targeted sends without a recipient', () => {
    assert.throws(
        () => resolveNewsletterAudience({ audienceMode: 'selected', recipientIds: [] }),
        AudienceSelectionError,
    );
});

test('rejects malformed subscriber IDs', () => {
    assert.throws(
        () => resolveNewsletterAudience({
            audienceMode: 'selected',
            recipientIds: ['not-a-subscriber-id'],
        }),
        /selected subscriber list is invalid/i,
    );
});

test('caps the size of a targeted send request', () => {
    assert.throws(
        () => resolveNewsletterAudience({
            audienceMode: 'selected',
            recipientIds: Array.from(
                { length: MAX_TARGETED_RECIPIENTS + 1 },
                () => subscriberIdA,
            ),
        }),
        new RegExp(`up to ${MAX_TARGETED_RECIPIENTS}`),
    );
});
