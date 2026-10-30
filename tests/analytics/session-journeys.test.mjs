import assert from 'node:assert/strict';
import test from 'node:test';
import { formatSessionPath, getMostEngagedPage, isVisibleSession, selectSessionCards, describeSession } from '../../src/lib/analytics/session-journeys.js';

test('five-second review boundary retains uncertain visits without establishing human status', () => {
    const session = { total_engaged_seconds: 5, human_confidence_tier: 'meaningful', human_signals: { activeSeconds: 5 } };
    assert.equal(isVisibleSession(session), true);
    assert.equal(isVisibleSession({ ...session, total_engaged_seconds: 4 }), false);
    assert.equal(isVisibleSession({ ...session, human_confidence_tier: 'filtered' }), true);
    assert.equal(isVisibleSession({ ...session, human_confidence_tier: 'filtered', human_signals: {} }), true);
});

test('most attention aggregates repeat visits to a page rather than selecting the longest single view', () => {
    assert.deepEqual(getMostEngagedPage([
        { path: '/work', engagedSeconds: 20 },
        { path: '/about', engagedSeconds: 30 },
        { path: '/work', title: 'Work', engagedSeconds: 25 },
    ]), { path: '/work', title: 'Work', engagedSeconds: 45 });
    assert.equal(getMostEngagedPage([]), null);
});

test('cards expose at least twenty visits, filter short visits and spam, and sort longest without mutating input', () => {
    const sessions = Array.from({ length: 25 }, (_, index) => ({ id: index, activeSeconds: 5 + index, startedAt: new Date(2026, 9, 1, 0, index).toISOString() }));
    const input = [...sessions, { id: 'missing-duration' }, { id: 'short', activeSeconds: 4 }, { id: 'spam', activeSeconds: 500, conversion: { status: 'spam' } }];
    const newest = selectSessionCards(input);
    assert.equal(newest.length, 20);
    assert.equal(newest[0].id, 24);
    assert.equal(selectSessionCards(input, { sort: 'longest' })[0].activeSeconds, 29);
    assert.equal(selectSessionCards(input, { filter: 'long' }).length, 0);
    assert.equal(input[0].id, 0);
    assert.equal(selectSessionCards(input, { limit: 40 }).length, 25);
});

test('missing GA4 entries never masquerade as real pages or home', () => {
    assert.equal(formatSessionPath('(not set)'), 'Entry page unavailable');
    assert.equal(formatSessionPath(''), 'Entry page unavailable');
    assert.equal(formatSessionPath('/'), 'Home');
    assert.equal(formatSessionPath('/photo-stories?utm_source=test'), 'Photo Stories');
});


test('short visits with new behavioural evidence remain visible while older duration-only visits stay unconfirmed', () => {
    const signals = { evidenceVersion: 2, evidenceLevel: 'likely_human' };
    assert.equal(isVisibleSession({ total_engaged_seconds: 2, human_signals: signals }), true);
    const journeys = [{ activeSeconds: 2, signals }, { activeSeconds: 30, signals: { activeSeconds: 30 } }];
    assert.equal(selectSessionCards(journeys, { filter: 'human' }).length, 1);
    assert.equal(selectSessionCards(journeys, { filter: 'uncertain' }).length, 1);
});

test('session paragraph explains discovery, entry, attention and last page without inventing a direct referral', () => {
    const text = describeSession({ country: 'IN', source: 'LinkedIn', landingPage: '/work', activeSeconds: 125,
        mostEngagedPage: { path: '/photography', engagedSeconds: 90 }, exitPage: '/contact' });
    assert.match(text, /LinkedIn/);
    assert.match(text, /entered on Work/);
    assert.match(text, /2 minutes 5 seconds/);
    assert.match(text, /Photograph.*1 minute 30 seconds/);
    assert.match(text, /last recorded page was Contact/);
    assert.match(describeSession({ source: 'Direct Visit', activeSeconds: 5 }), /without a recorded referral/);
    assert.match(describeSession({ activeSeconds: 5 }), /no recorded entry/);
});
