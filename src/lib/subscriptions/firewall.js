import { SUBSCRIPTION_FEEDS } from './catalog.js';

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Prepared configuration only. Applying it requires an authenticated project
// administrator and inspection of the active challenge rule and its ordering.
export function discoveryFirewallRule() {
  const paths = [...new Set([
    ...SUBSCRIPTION_FEEDS.map((feed) => feed.path),
    '/robots.txt', '/sitemap-index.xml', '/content-sitemap.xml',
    '/vault-sitemap.xml', '/work-sitemap.xml',
  ])];
  const pathPattern = `^(?:${paths.map(escapeRegex).join('|')}|/sitemap-[0-9]+\\.xml)$`;
  return {
    action: 'rules.insert',
    value: {
      name: 'Public RSS and search discovery',
      description: 'Allow public read-only RSS, sitemap and robots requests from feed readers and search crawlers.',
      active: true,
      conditionGroup: ['GET', 'HEAD'].map((method) => ({
        conditions: [
          { type: 'host', op: 're', value: '^(?:www\\.)?abodid\\.com$' },
          { type: 'method', op: 'eq', value: method },
          { type: 'path', op: 're', value: pathPattern },
        ],
      })),
      action: { mitigate: { action: 'bypass' } },
    },
  };
}
