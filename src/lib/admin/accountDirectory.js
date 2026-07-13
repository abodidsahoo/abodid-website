const TEST_EMAIL_DOMAINS = new Set(["example.com", "test.com"]);

export const normalizeAccountEmail = (value) =>
    typeof value === "string" ? value.trim().toLowerCase() : "";

const countByUserId = (rows = []) => {
    const counts = new Map();

    for (const row of rows) {
        const userId = row?.user_id || row?.submitted_by;
        if (!userId) continue;
        counts.set(userId, (counts.get(userId) || 0) + 1);
    }

    return counts;
};

export const isLikelyTestAccount = ({ email, username, fullName } = {}) => {
    const normalizedEmail = normalizeAccountEmail(email);
    const [localPart = "", domain = ""] = normalizedEmail.split("@");
    const normalizedUsername = String(username || "").trim().toLowerCase();
    const normalizedName = String(fullName || "").trim().toLowerCase();
    const startsLikeTest = (value) => /^(test|demo)(?:[\s._-]|\d|$)/i.test(value);

    return (
        TEST_EMAIL_DOMAINS.has(domain) ||
        startsLikeTest(localPart) ||
        startsLikeTest(normalizedUsername) ||
        startsLikeTest(normalizedName)
    );
};

const sortAccounts = (accounts) =>
    accounts.sort((left, right) => {
        if (left.role === "admin" && right.role !== "admin") return -1;
        if (right.role === "admin" && left.role !== "admin") return 1;

        const leftActivity = left.activity.total;
        const rightActivity = right.activity.total;
        if (leftActivity !== rightActivity) return rightActivity - leftActivity;

        return left.displayName.localeCompare(right.displayName);
    });

export const buildAccountDirectory = ({
    authUsers = [],
    profiles = [],
    subscribers = [],
    bookmarks = [],
    upvotes = [],
    resources = [],
} = {}) => {
    const profilesById = new Map(profiles.map((profile) => [profile.id, profile]));
    const subscriberEmails = new Set(
        subscribers
            .map((subscriber) => normalizeAccountEmail(subscriber.email))
            .filter(Boolean),
    );
    const bookmarkCounts = countByUserId(bookmarks);
    const upvoteCounts = countByUserId(upvotes);
    const submissionCounts = countByUserId(resources);

    const accounts = authUsers.map((authUser) => {
        const profile = profilesById.get(authUser.id) || {};
        const email = normalizeAccountEmail(authUser.email || profile.email);
        const isAnonymous = Boolean(authUser.is_anonymous);
        const likelyTest = !isAnonymous && isLikelyTestAccount({
            email,
            username: profile.username,
            fullName: profile.full_name,
        });
        const bookmarksCount = bookmarkCounts.get(authUser.id) || 0;
        const upvotesCount = upvoteCounts.get(authUser.id) || 0;
        const submissionsCount = submissionCounts.get(authUser.id) || 0;
        const anonymousLabel = `Anonymous ${authUser.id.slice(0, 6)}`;

        return {
            id: authUser.id,
            displayName:
                profile.full_name ||
                profile.username ||
                authUser.user_metadata?.full_name ||
                (isAnonymous ? anonymousLabel : email.split("@")[0] || "Unnamed account"),
            username: profile.username || null,
            email: email || null,
            avatarUrl: profile.avatar_url || authUser.user_metadata?.avatar_url || null,
            role: profile.role || "user",
            accountType: isAnonymous ? "anonymous" : likelyTest ? "test" : "person",
            isAnonymous,
            isLikelyTest: likelyTest,
            isNewsletterSubscriber: Boolean(email && subscriberEmails.has(email)),
            createdAt: authUser.created_at || null,
            lastSignInAt: authUser.last_sign_in_at || null,
            activity: {
                submissions: submissionsCount,
                bookmarks: bookmarksCount,
                upvotes: upvotesCount,
                total: submissionsCount + bookmarksCount + upvotesCount,
            },
        };
    });

    sortAccounts(accounts);

    const people = accounts.filter((account) => account.accountType === "person");
    const admins = people.filter((account) => account.role === "admin").length;
    const curators = people.filter((account) => account.role === "curator").length;
    const summary = {
        people: people.length,
        admins,
        curators,
        curationAccess: admins + curators,
        anonymous: accounts.filter((account) => account.accountType === "anonymous").length,
        testAccounts: accounts.filter((account) => account.accountType === "test").length,
        accountSubscribers: accounts.filter((account) => account.isNewsletterSubscriber).length,
        activeSubscribers: subscriberEmails.size,
        totalAccounts: accounts.length,
    };

    return { accounts, summary };
};
