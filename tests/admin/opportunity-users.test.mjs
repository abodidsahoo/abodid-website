import assert from 'node:assert/strict';
import test from 'node:test';
import { buildOpportunityUserDirectory } from '../../src/lib/admin/opportunityUsers.js';

test('builds an Opportunity-only directory sorted by onboarding date', () => {
    const result = buildOpportunityUserDirectory({
        memberships: [
            { user_id: 'one', first_seen_at: '2026-10-15T12:00:00Z', signup_notification_status: 'sent' },
            { user_id: 'two', first_seen_at: '2026-10-21T12:00:00Z', signup_notification_status: 'sent' },
        ],
        authUsers: [
            { id: 'one', email: 'one@example.org', created_at: '2026-10-15T11:00:00Z', user_metadata: {} },
            { id: 'two', email: 'two@example.org', created_at: '2026-10-21T11:00:00Z', user_metadata: {} },
            { id: 'other', email: 'other@example.org', created_at: '2026-10-22T11:00:00Z', user_metadata: {} },
        ],
        profiles: [
            { id: 'one', username: 'one_user', full_name: 'One User', is_public: false },
            { id: 'two', username: 'two_user', full_name: 'Two User', is_public: true },
            { id: 'other', username: 'other_user', full_name: 'Not Onboarded', is_public: true },
        ],
        opportunities: [
            { user_id: 'one' },
            { user_id: 'one' },
        ],
    });

    assert.deepEqual(result.users.map((user) => user.id), ['two', 'one']);
    assert.equal(result.users.some((user) => user.id === 'other'), false);
    assert.deepEqual(result.summary, {
        total: 2,
        withCollection: 1,
        publicCollections: 1,
        savedOpportunities: 2,
    });
    assert.equal(result.users[1].opportunityCount, 2);
});
