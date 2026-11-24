import test from 'node:test';
import assert from 'node:assert/strict';
import { discoveryFirewallRule } from '../../src/lib/subscriptions/firewall.js';
import { SUBSCRIPTION_FEEDS } from '../../src/lib/subscriptions/catalog.js';

const rule = discoveryFirewallRule();
const allows = (host, method, path) => rule.value.conditionGroup.some(({ conditions }) =>
  conditions.every((condition) => {
    const value = { host, method, path }[condition.type];
    return condition.op === 're' ? new RegExp(condition.value).test(value) : value === condition.value;
  }));

test('prepared exception covers all advertised feeds and sitemap discovery', () => {
  for (const path of [...SUBSCRIPTION_FEEDS.map(feed => feed.path), '/sitemap-index.xml', '/sitemap-0.xml', '/content-sitemap.xml', '/vault-sitemap.xml', '/work-sitemap.xml', '/robots.txt']) {
    assert.equal(allows('abodid.com', 'GET', path), true, path);
    assert.equal(allows('www.abodid.com', 'HEAD', path), true, path);
  }
});

test('exception excludes writes, private paths, arbitrary feed files and unrelated hosts', () => {
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) assert.equal(allows('abodid.com', method, '/rss.xml'), false);
  for (const path of ['/admin', '/api/private', '/land', '/feeds/private.xml', '/rss.xml/secret', '/rssXxml']) assert.equal(allows('abodid.com', 'GET', path), false);
  assert.equal(allows('elsewhere.example', 'GET', '/rss.xml'), false);
});
