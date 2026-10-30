import { beforeEach, describe, expect, it, vi } from "vitest";
const h = vi.hoisted(() => ({
  authorize: vi.fn(),
  from: vi.fn(),
  insert: vi.fn(),
  select: vi.fn(),
  single: vi.fn(),
  eq: vi.fn(),
  update: vi.fn(),
  maybeSingle: vi.fn(),
  send: vi.fn(),
}));
vi.mock("../../src/lib/opportunities/userAuth", async (original) => ({
  ...(await original<typeof import("../../src/lib/opportunities/userAuth")>()),
  authorizeOpportunityRequest: h.authorize,
}));
vi.mock("resend", () => ({
  Resend: class {
    emails = { send: h.send };
  },
}));
import { POST } from "../../src/pages/api/opportunities/usage";
const user = {
  id: "owner",
  email: "owner@example.org",
  email_confirmed_at: "2026-10-30",
};
const post = (extra = {}) =>
  POST({
    request: new Request("https://abodid.com/api/opportunities/usage", {
      method: "POST",
      body: JSON.stringify({
        message: "Hello Support team, please increase my allowance.",
        ...extra,
      }),
    }),
  } as any);
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("RESEND_API_KEY", "nonsecret-test");
  h.from.mockReturnValue(h);
  h.insert.mockReturnValue(h);
  h.update.mockReturnValue(h);
  h.select.mockReturnValue(h);
  h.eq.mockReturnValue(h);
  h.single.mockResolvedValue({
    data: { id: "request-1", sender_email: "sender@example.org" },
    error: null,
  });
  h.maybeSingle.mockResolvedValue({ data: null, error: null });
  h.send.mockResolvedValue({ data: { id: "email-1" }, error: null });
  h.authorize.mockResolvedValue({
    ok: true,
    user,
    serviceClient: { from: h.from },
  });
});
import { afterEach } from "vitest";
afterEach(() => vi.unstubAllEnvs());
describe("Credit request delivery", () => {
  it("requires authentication before any storage or mail call", async () => {
    h.authorize.mockResolvedValue({
      ok: false,
      response: new Response("{}", { status: 401 }),
    });
    expect((await post()).status).toBe(401);
    expect(h.send).not.toHaveBeenCalled();
    expect(h.from).not.toHaveBeenCalled();
  });
  it("uses only the token owner as reply-to and a fixed support recipient", async () => {
    expect(
      (
        await post({
          user_id: "forged",
          email: "forged@example.org",
          to: "forged@example.org",
        })
      ).status,
    ).toBe(200);
    expect(h.insert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: "owner" }),
    );
    expect(h.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: ["hello@abodid.com"],
        replyTo: "owner@example.org",
      }),
      { idempotencyKey: "opportunity-credits/request-1" },
    );
  });
  it("does not send a second email for an existing pending request", async () => {
    h.single.mockResolvedValueOnce({ error: { code: "23505" }, data: null });
    h.maybeSingle.mockResolvedValue({ data: { delivery_status: "sent" } });
    expect((await post()).status).toBe(200);
    expect(h.send).not.toHaveBeenCalled();
  });
  it("reports delivery failure without claiming success", async () => {
    h.send.mockResolvedValue({ error: { message: "provider error" } });
    expect((await post()).status).toBe(503);
    expect(h.update).toHaveBeenCalledWith({ delivery_status: "failed" });
  });
  it("rejects an unverified email before sending", async () => {
    h.authorize.mockResolvedValue({
      ok: true,
      user: { ...user, email_confirmed_at: null },
    });
    expect((await post()).status).toBe(403);
    expect(h.send).not.toHaveBeenCalled();
  });
  it("rejects empty messages", async () => {
    expect((await post({ message: "" })).status).toBe(400);
    expect(h.send).not.toHaveBeenCalled();
  });
});
