import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const h = vi.hoisted(() => ({ authorize: vi.fn(), rpc: vi.fn() }));
vi.mock("../../src/lib/admin/serverAuth", async (original) => ({
  ...(await original<typeof import("../../src/lib/admin/serverAuth")>()),
  authorizeAdminRequest: h.authorize,
}));
import { PATCH } from "../../src/pages/api/admin/opportunity-users/[id]";
const userId = "00000000-0000-4000-8000-000000000001";
const patch = (body: unknown) =>
  PATCH({
    params: { id: userId },
    request: new Request(
      "https://abodid.com/api/admin/opportunity-users/" + userId,
      { method: "PATCH", body: JSON.stringify(body && typeof body === "object" ? { expected_limit: 5, ...body } : body) },
    ),
  } as any);
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("OPPORTUNITIES_AI_MONTHLY_LIMIT", "5");
  h.authorize.mockResolvedValue({
    ok: true,
    user: { id: "verified-admin" },
    supabase: { rpc: h.rpc },
  });
  h.rpc.mockResolvedValue({ data: 10, error: null });
});
afterEach(() => vi.unstubAllEnvs());
describe("Admin one-click allowances", () => {
  it("derives the admin identity from authentication and returns the stored limit", async () => {
    const response = await patch({ increment: 5 });
    expect(await response.json()).toEqual({ saved: true, monthly_limit: 10 });
    expect(h.rpc).toHaveBeenCalledWith("confirm_opportunity_ai_allowance", {
      p_user_id: userId,
      p_admin_id: "verified-admin",
      p_increment: 5,
      p_limit: null,
      p_expected_limit: 5,
      p_default_limit: 5,
    });
  });
  it("allows exact numeric updates without resetting usage", async () => {
    h.rpc.mockResolvedValue({ data: 17, error: null });
    const response = await patch({ monthly_limit: 17 });
    expect(await response.json()).toEqual({ saved: true, monthly_limit: 17 });
    expect(h.rpc).toHaveBeenCalledWith("confirm_opportunity_ai_allowance", {
      p_user_id: userId,
      p_admin_id: "verified-admin",
      p_limit: 17,
      p_increment: null,
      p_expected_limit: 5,
      p_default_limit: 5,
    });
  });
  it.each([
    { expected_limit: "5", increment: 5 },
    { increment: -5 },
    { increment: 0 },
    { increment: 1 },
    { increment: "5" },
    { increment: 5, monthly_limit: 10 },
    { increment: 5, admin_id: "forged" },
    { monthly_limit: 1.5 },
    { monthly_limit: 10001 },
    {},
    null,
  ])("rejects invalid or ambiguous changes: %j", async (body) => {
    expect((await patch(body)).status).toBe(400);
    expect(h.rpc).not.toHaveBeenCalled();
  });
  it("denies a nonadmin without touching allowances", async () => {
    h.authorize.mockResolvedValue({
      ok: false,
      response: new Response("{}", { status: 403 }),
    });
    expect((await patch({ increment: 5 })).status).toBe(403);
    expect(h.rpc).not.toHaveBeenCalled();
  });
  it("reports an upper-bound rejection without claiming success", async () => {
    h.rpc.mockResolvedValue({ data: null, error: { code: "22023" } });
    expect((await patch({ increment: 10 })).status).toBe(400);
  });
});

it("rejects a stale confirmation with 409", async () => {
  h.rpc.mockResolvedValue({ data: null, error: { code: "40001" } });
  expect((await patch({ increment: 5 })).status).toBe(409);
});
