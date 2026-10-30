const countRowsByUser = (rows = []) => {
  const counts = new Map();
  for (const row of rows) {
    if (!row?.user_id) continue;
    counts.set(row.user_id, (counts.get(row.user_id) || 0) + 1);
  }
  return counts;
};

/**
 * @param {{memberships?: any[], authUsers?: any[], profiles?: any[], opportunities?: any[], defaultMonthlyLimit?: number, usage?: any[]}} options
 */
export const buildOpportunityUserDirectory = ({
  memberships = [],
  authUsers = [],
  profiles = [],
  opportunities = [],
  defaultMonthlyLimit = 5,
  usage = [],
} = {}) => {
  const authById = new Map(authUsers.map((user) => [user.id, user]));
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
  const opportunityCounts = countRowsByUser(opportunities);

  const usageById = new Map(usage.map((row) => [row.user_id, row]));
  const users = memberships
    .map((membership) => {
      const authUser = authById.get(membership.user_id) || {};
      const profile = profileById.get(membership.user_id) || {};
      const email = authUser.email || profile.email || null;
      const username = profile.username || null;

      return {
        id: membership.user_id,
        monthlyLimit: membership.ai_monthly_limit ?? defaultMonthlyLimit,
        aiUsed: Number(usageById.get(membership.user_id)?.used_month || 0),
        aiTotal: Number(usageById.get(membership.user_id)?.total_attempts || 0),
        aiRemaining: Math.max(
          0,
          (defaultMonthlyLimit === 0
            ? 0
            : (membership.ai_monthly_limit ?? defaultMonthlyLimit)) -
            Number(usageById.get(membership.user_id)?.used_month || 0),
        ),
        aiPaused: defaultMonthlyLimit === 0,
        displayName:
          profile.full_name ||
          username ||
          authUser.user_metadata?.full_name ||
          email?.split("@")[0] ||
          "Unnamed user",
        username,
        email,
        avatarUrl:
          profile.avatar_url || authUser.user_metadata?.avatar_url || null,
        onboardedAt: membership.first_seen_at,
        accountCreatedAt: authUser.created_at || null,
        opportunityCount: opportunityCounts.get(membership.user_id) || 0,
        isPublic: Boolean(profile.is_public),
        notificationStatus: membership.signup_notification_status,
        notificationSentAt: membership.signup_notification_sent_at || null,
      };
    })
    .sort(
      (left, right) =>
        new Date(right.onboardedAt || 0).getTime() -
        new Date(left.onboardedAt || 0).getTime(),
    );

  return {
    users,
    summary: {
      totalAiAttempts: users.reduce((sum, user) => sum + user.aiTotal, 0),
      monthAiAttempts: users.reduce((sum, user) => sum + user.aiUsed, 0),
      total: users.length,
      withCollection: users.filter((user) => user.opportunityCount > 0).length,
      publicCollections: users.filter((user) => user.isPublic).length,
      savedOpportunities: users.reduce(
        (total, user) => total + user.opportunityCount,
        0,
      ),
    },
  };
};
