import assert from 'node:assert/strict';
import test from 'node:test';

import {
    getNewsletterFirstName,
    personalizeNewsletterMessage,
} from '../../src/lib/newsletter/personalization.js';

test('uses the first part of a subscriber name', () => {
    assert.equal(getNewsletterFirstName('  Ada Lovelace  '), 'Ada');
});

test('replaces the first-name token throughout the message', () => {
    assert.equal(
        personalizeNewsletterMessage('<p>Hi {{first_name}},</p><p>For {{ FIRST_NAME }}.</p>', 'Ada Lovelace'),
        '<p>Hi Ada,</p><p>For Ada.</p>',
    );
});

test('uses a natural fallback when a subscriber has no saved name', () => {
    assert.equal(
        personalizeNewsletterMessage('<p>Hi {{first_name}},</p>', null),
        '<p>Hi there,</p>',
    );
});

test('escapes subscriber names before inserting them into email HTML', () => {
    assert.equal(
        personalizeNewsletterMessage('<p>Hi {{first_name}},</p>', '<Ada> Lovelace'),
        '<p>Hi &lt;Ada&gt;,</p>',
    );
});
