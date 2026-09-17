import { test } from 'node:test';
import assert from 'node:assert/strict';

// Test the exact regex list used by src/middleware.ts
const privatePagePatterns = [
    /^\/admin(?:\/|$)/,
    /^\/api\/admin(?:\/|$)/,
    /^\/api\/analytics(?:\/|$)/,
    /^\/api\/tracking(?:\/|$)/,
    /^\/api\/punctum(?:\/|$)/,
    /^\/api\/resources\/(?:approve|send-rejection)(?:\/|$)/,
    /^\/api\/one-photo\/submit\/?$/,
    /^\/login\/?$/,
    /^\/unauthorized\/?$/,
    /^\/unsubscribe\/?$/,
    /^\/payments\/?$/,
    /^\/club\/(?:payment-|welcome)/,
    /^\/collaboration\/measurements\/?$/,
    /^\/du-workshop-responses\/?$/,
    /^\/feedback\/?$/,
    /^\/paper-renamer\/insights(?:\/|$)/,
    /^\/research\/admin(?:\/|$)/,
    /^\/opportunities(?:\/|$)/,
    /^\/resources\/(?:admin|auth|curator|dashboard|saved|submit)(?:\/|$)/,
    /^\/resources\/.*\/edit\/?$/,
];

const isPrivate = (path) => privatePagePatterns.some((pattern) => pattern.test(path));

test('middleware: public vault and public api routes are not blocked from edge caching', () => {
    assert.equal(isPrivate('/obsidian-vault'), false);
    assert.equal(isPrivate('/obsidian-vault/'), false);
    assert.equal(isPrivate('/obsidian-vault/generative-ai'), false);
    assert.equal(isPrivate('/obsidian-vault/topic/machine-learning'), false);
    assert.equal(isPrivate('/obsidian-vault/directory'), false);
    assert.equal(isPrivate('/api/og'), false);
    assert.equal(isPrivate('/api/all-photos.json'), false);
    assert.equal(isPrivate('/api/vault-tags.json'), false);
    assert.equal(isPrivate('/api/vault-tag-search.json'), false);
    assert.equal(isPrivate('/api/blog-post.json'), false);
});

test('middleware: admin and sensitive routes remain strictly private/no-store', () => {
    assert.equal(isPrivate('/admin'), true);
    assert.equal(isPrivate('/admin/dashboard'), true);
    assert.equal(isPrivate('/api/admin/accounts'), true);
    assert.equal(isPrivate('/api/analytics/collect'), true);
    assert.equal(isPrivate('/api/tracking/pixel'), true);
    assert.equal(isPrivate('/feedback'), true);
    assert.equal(isPrivate('/login'), true);
    assert.equal(isPrivate('/unauthorized'), true);
    assert.equal(isPrivate('/payments'), true);
});
