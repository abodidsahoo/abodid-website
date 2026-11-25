import { discoveryFirewallRule } from '../src/lib/subscriptions/firewall.js';

// Prints a reviewable Vercel PATCH payload; it does not change hosting settings.
process.stdout.write(`${JSON.stringify(discoveryFirewallRule(), null, 2)}\n`);
