import assert from 'node:assert/strict';
import test from 'node:test';
import {
    formatDuration,
    normalizedAcquisitionSource,
    readableLocation,
    resolveEnquiryTitle,
    summarizeVisit,
} from '../../src/lib/contact-notification.js';

test('resolves readable enquiry titles without exposing paths or CTA names', () => {
    assert.equal(resolveEnquiryTitle({ enquiryPath: '/premiere-pro-masterclass' }), 'Premiere Pro Masterclass');
    assert.equal(resolveEnquiryTitle({ cta: 'premiere-pro-masterclass-enquiry' }), 'Premiere Pro Masterclass');
    assert.equal(resolveEnquiryTitle({ enquiryPath: '/contact' }), 'General');
});

test('summarizes only meaningful pages viewed before submission', () => {
    const summary = summarizeVisit({
        session: { started_at: '2026-07-13T10:00:00.000Z' },
        submittedAt: '2026-07-13T10:11:41.000Z',
        pageViews: [
            { page_path: '/work/invisible-punctum', page_title: 'The Invisible Punctum — Abodid', viewed_at: '2026-07-13T10:01:00Z', engaged_seconds: 277 },
            { page_path: '/work/invisible-punctum', page_title: 'The Invisible Punctum — Abodid', viewed_at: '2026-07-13T10:05:00Z', engaged_seconds: 20 },
            { page_path: '/contact', page_title: 'Contact Abodid Sahoo', viewed_at: '2026-07-13T10:10:00Z', engaged_seconds: 80 },
            { page_path: '/services', page_title: 'Services', viewed_at: '2026-07-13T10:12:00Z', engaged_seconds: 999 },
        ],
    });
    assert.equal(summary.durationSeconds, 701);
    assert.equal(summary.distinctMeaningfulPages, 1);
    assert.equal(summary.strongestPage.title, 'The Invisible Punctum');
    assert.equal(summary.strongestPage.engagedSeconds, 297);
    assert.equal(formatDuration(summary.durationSeconds), '11m 41s');
});

test('uses clean optional location and acquisition labels', () => {
    assert.equal(readableLocation({ city: 'Bhubaneswar', country: 'IN' }), 'Bhubaneswar, India');
    assert.equal(readableLocation({ country: 'GB' }), 'United Kingdom');
    assert.equal(readableLocation({ country: 'Unknown' }), '');
    assert.equal(normalizedAcquisitionSource('Google'), 'Google Search');
    assert.equal(normalizedAcquisitionSource('Direct / Unknown'), 'Direct Visit');
});
