import assert from 'node:assert/strict';
import test from 'node:test';
import { looksLikeRandomCharacterMessage, looksLikeSuspiciousEmail } from '../../src/lib/contact-spam.js';

test('blocks the random-token pattern used by the recent contact spam', () => {
    assert.equal(looksLikeRandomCharacterMessage('knwyZUFRAmhuOqeBocSP'), true);
    assert.equal(looksLikeRandomCharacterMessage('q7Hm92LpX4vN81Ks'), true);
    assert.equal(looksLikeRandomCharacterMessage('xxxxxxxxxxxxxxxx'), true);
    assert.equal(looksLikeRandomCharacterMessage('qzmxncbvlaksjdhf'), true);
});

test('blocks randomized and disposable email addresses', () => {
    assert.equal(looksLikeSuspiciousEmail('x9.q7.z2.k8.m4@mailinator.com'), true);
    assert.equal(looksLikeSuspiciousEmail('qz9xv7b2n4m8k6p1@example.com'), true);
    assert.equal(looksLikeSuspiciousEmail('a..b@example.com'), true);
});

test('allows plausible personal and professional email aliases', () => {
    assert.equal(looksLikeSuspiciousEmail('abodid.sahoo@example.com'), false);
    assert.equal(looksLikeSuspiciousEmail('studio+photography@example.co.uk'), false);
    assert.equal(looksLikeSuspiciousEmail('hello@creative-lab.org'), false);
});

test('allows ordinary messages, URLs, Unicode, and plausible single words', () => {
    assert.equal(looksLikeRandomCharacterMessage('I would like to discuss a photography project.'), false);
    assert.equal(looksLikeRandomCharacterMessage('Can we speak tomorrow afternoon?'), false);
    assert.equal(looksLikeRandomCharacterMessage('https://example.com/my-project'), false);
    assert.equal(looksLikeRandomCharacterMessage('मुझे आपके साथ एक परियोजना पर बात करनी है।'), false);
    assert.equal(looksLikeRandomCharacterMessage('Congratulations'), false);
    assert.equal(looksLikeRandomCharacterMessage('availabletomorrowafternoon'), false);
});
