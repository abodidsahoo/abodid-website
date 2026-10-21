const countRowsByUser = (rows = []) => {
    const counts = new Map();
    for (const row of rows) {
        if (!row?.user_id) continue;
        counts.set(row.user_id, (counts.get(row.user_id) || 0) + 1);
    }
    return counts;
};

export const buildOpportunityUserDirectory = ({
    memberships = [],
    authUsers = [],
    profiles = [],
    opportunities = [],
} = {}) => {
    const authById = new Map(authUsers.map((user) => [user.id, user]));
    const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
    const opportunityCounts = countRowsByUser(opportunities);

    const users = memberships.map((membership) => {
        const authUser = authById.get(membership.user_id) || {};
        const profile = profileById.get(membership.user_id) || {};
        const email = authUser.email || profile.email || null;
        const username = profile.username || null;

        return {
            id: membership.user_id,
            displayName:
                profile.full_name
                || username
                || authUser.user_metadata?.full_name
                || email?.split('@')[0]
                || 'Unnamed user',
            username,
            email,
            avatarUrl: profile.avatar_url || authUser.user_metadata?.avatar_url || null,
            onboardedAt: membership.first_seen_at,
            accountCreatedAt: authUser.created_at || null,
            opportunityCount: opportunityCounts.get(membership.user_id) || 0,
            isPublic: Boolean(profile.is_public),
            notificationStatus: membership.signup_notification_status,
            notificationSentAt: membership.signup_notification_sent_at || null,
        };
    }).sort((left, right) => (
        new Date(right.onboardedAt || 0).getTime() - new Date(left.onboardedAt || 0).getTime()
    ));

    return {
        users,
        summary: {
            total: users.length,
            withCollection: users.filter((user) => user.opportunityCount > 0).length,
            publicCollections: users.filter((user) => user.isPublic).length,
            savedOpportunities: users.reduce((total, user) => total + user.opportunityCount, 0),
        },
    };
};
