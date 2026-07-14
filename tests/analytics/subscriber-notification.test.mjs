import assert from 'node:assert/strict';
import test from 'node:test';
import { renderSubscriberNotification } from '../../src/lib/subscriber-notification.js';

test('subscriber notification is concise and contains no technical tracking output', () => {
    const rendered = renderSubscriberNotification({
        email: 'person@example.com',
        name: 'A Person',
        status: 'new',
        source: 'footer-newsletter',
        acquisitionSource: 'Google Search',
        location: 'Bhubaneswar, India',
        visit: {
            durationSeconds: 701,
            distinctMeaningfulPages: 4,
            strongestPage: { title: 'Premiere Pro Masterclass', engagedSeconds: 277 },
        },
        analyticsUrl: 'https://abodid.com/admin/dashboard?section=analytics&newsletterSubmission=abc',
    });

    assert.equal(rendered.subject, 'New newsletter subscriber — A Person');
    assert.match(rendered.html, /Footer newsletter/);
    assert.match(rendered.text, /11m 41s · 4 pages explored/);
    for (const forbidden of ['Session ID', 'ISO Timestamp', 'Structured Query', 'Visit Sequence', 'page_views', 'journey_']) {
        assert.doesNotMatch(rendered.html, new RegExp(forbidden, 'i'));
        assert.doesNotMatch(rendered.text, new RegExp(forbidden, 'i'));
    }
});
