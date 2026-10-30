import { describe, expect, it } from "vitest";
import { buildOpportunityUserDirectory } from "../../src/lib/admin/opportunityUsers.js";
describe("Admin usage analytics", () => {
  it("shows used, remaining and tracked total separately", () => {
    const d = buildOpportunityUserDirectory({
      memberships: [{ user_id: "a", ai_monthly_limit: 12 }],
      usage: [{ user_id: "a", used_month: 7, total_attempts: 24 }],
    });
    expect(d.users[0]).toMatchObject({
      monthlyLimit: 12,
      aiUsed: 7,
      aiRemaining: 5,
      aiTotal: 24,
    });
    expect(d.summary).toMatchObject({
      monthAiAttempts: 7,
      totalAiAttempts: 24,
    });
  });
  it("shows no negative remaining attempts after a reduction", () => {
    const d = buildOpportunityUserDirectory({
      memberships: [{ user_id: "a", ai_monthly_limit: 3 }],
      usage: [{ user_id: "a", used_month: 7, total_attempts: 24 }],
    });
    expect(d.users[0].aiRemaining).toBe(0);
  });
  it("shows zero use and five remaining for a new account", () => {
    const d = buildOpportunityUserDirectory({
      memberships: [{ user_id: "a" }],
    });
    expect(d.users[0]).toMatchObject({ aiUsed: 0, aiRemaining: 5, aiTotal: 0 });
  });
  it("honours the global pause in remaining availability", () => {
    const d = buildOpportunityUserDirectory({
      memberships: [{ user_id: "a", ai_monthly_limit: 20 }],
      defaultMonthlyLimit: 0,
    });
    expect(d.users[0]).toMatchObject({ aiRemaining: 0, aiPaused: true });
  });
});
