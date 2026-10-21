import { describe, expect, it } from 'vitest';
import { buildOpportunitySignupEmailHtml } from '../../src/lib/opportunities/onboarding';

describe('Opportunity Tracker onboarding notification', () => {
    it('renders the minimum owner-facing signup details safely', () => {
        const html = buildOpportunitySignupEmailHtml({
            displayName: '<New User>',
            email: 'person@example.org',
            username: 'person',
            firstSeenAt: '2026-10-21T14:34:24.000Z',
            adminUrl: 'https://abodid.com/admin/opportunities/users?user=test',
        });

        expect(html).toContain('New user onboarded.');
        expect(html).toContain('&lt;New User&gt;');
        expect(html).toContain('person@example.org');
        expect(html).toContain('@person');
        expect(html).toContain('View user collection');
        expect(html).not.toContain('<New User>');
    });
});
