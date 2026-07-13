import assert from "node:assert/strict";
import test from "node:test";
import {
    buildAccountDirectory,
    isLikelyTestAccount,
    normalizeAccountEmail,
} from "../../src/lib/admin/accountDirectory.js";

test("normalizes email addresses before matching newsletter consent", () => {
    assert.equal(normalizeAccountEmail("  Person@Example.org "), "person@example.org");
    assert.equal(normalizeAccountEmail(null), "");
});

test("uses conservative signals to separate likely test accounts", () => {
    assert.equal(isLikelyTestAccount({ email: "alex@test.com" }), true);
    assert.equal(isLikelyTestAccount({ email: "test7feb@gmail.com" }), true);
    assert.equal(isLikelyTestAccount({ fullName: "Test User" }), true);
    assert.equal(isLikelyTestAccount({ email: "tester@gmail.com" }), false);
    assert.equal(isLikelyTestAccount({ fullName: "Demoiselle Smith" }), false);
});

test("builds separate people, anonymous, and test account groups with activity", () => {
    const result = buildAccountDirectory({
        authUsers: [
            {
                id: "person-1",
                email: "person@example.org",
                created_at: "2026-01-01T00:00:00Z",
                last_sign_in_at: "2026-02-01T00:00:00Z",
                is_anonymous: false,
                user_metadata: {},
            },
            {
                id: "anon-123456",
                email: null,
                created_at: "2026-01-02T00:00:00Z",
                last_sign_in_at: "2026-01-02T00:00:00Z",
                is_anonymous: true,
                user_metadata: {},
            },
            {
                id: "test-1",
                email: "demo@example.com",
                created_at: "2026-01-03T00:00:00Z",
                last_sign_in_at: null,
                is_anonymous: false,
                user_metadata: {},
            },
        ],
        profiles: [
            { id: "person-1", full_name: "Real Person", username: "person", role: "curator" },
            { id: "anon-123456", full_name: null, username: null, role: "user" },
            { id: "test-1", full_name: "Demo User", username: "demo", role: "user" },
        ],
        subscribers: [{ email: "PERSON@example.org" }, { email: "only-subscriber@example.org" }],
        bookmarks: [{ user_id: "anon-123456" }, { user_id: "person-1" }],
        upvotes: [{ user_id: "anon-123456" }, { user_id: "anon-123456" }],
        resources: [{ submitted_by: "person-1" }],
    });

    assert.deepEqual(result.summary, {
        people: 1,
        admins: 0,
        curators: 1,
        curationAccess: 1,
        anonymous: 1,
        testAccounts: 1,
        accountSubscribers: 1,
        activeSubscribers: 2,
        totalAccounts: 3,
    });

    const person = result.accounts.find((account) => account.id === "person-1");
    const anonymous = result.accounts.find((account) => account.id === "anon-123456");

    assert.equal(person.accountType, "person");
    assert.equal(person.isNewsletterSubscriber, true);
    assert.deepEqual(person.activity, {
        submissions: 1,
        bookmarks: 1,
        upvotes: 0,
        total: 2,
    });

    assert.equal(anonymous.accountType, "anonymous");
    assert.equal(anonymous.displayName, "Anonymous anon-1");
    assert.deepEqual(anonymous.activity, {
        submissions: 0,
        bookmarks: 1,
        upvotes: 2,
        total: 3,
    });
});
