import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  insert: vi.fn(),
  rpc: vi.fn(),
  verify: vi.fn(),
  client: vi.fn(),
}));
vi.mock("../../src/lib/supabaseServer", () => ({
  createSupabaseServiceClient: mocks.client,
}));
vi.mock("../../src/lib/contact-protection.js", () => ({
  contactRateLimitKey: () => "",
  verifyContactTurnstile: mocks.verify,
}));
import { POST } from "../../src/pages/api/artist-globe/nominations";
const request = (payload: unknown, origin = "https://abodid.com") =>
  ({
    request: new Request("https://abodid.com/api/artist-globe/nominations", {
      method: "POST",
      headers: { origin, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  }) as Parameters<typeof POST>[0];
beforeEach(() => {
  vi.clearAllMocks();
  mocks.client.mockReturnValue({
    from: () => ({ insert: mocks.insert }),
    rpc: mocks.rpc,
  });
  mocks.insert.mockResolvedValue({ error: null });
  mocks.verify.mockResolvedValue({ success: true });
});
describe("nomination route", () => {
  it("saves a valid nomination only as an unpublished pending profile", async () => {
    const response = await POST(
      request({
        name: "Artist Example",
        country: "IN",
        city: "Kolkata",
        latitude: 22.56,
        longitude: 88.36,
        link: "@artist",
        turnstileToken: "token",
      }),
    );
    expect(response.status).toBe(200);
    expect(mocks.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Artist Example",
        country: "India",
        published: false,
        nomination_status: "pending",
        is_demo: false,
        nomination_link: "@artist",
      }),
    );
  });
  it("supports nominations without a known city or coordinates", async () => {
    const response = await POST(
      request({
        name: "Artist Example",
        country: "IN",
        link: "https://example.com",
      }),
    );
    expect(response.status).toBe(200);
    expect(mocks.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        current_city: "",
        latitude: null,
        longitude: null,
      }),
    );
  });
  it("rejects cross-site posts before touching storage", async () => {
    const response = await POST(
      request({ name: "Artist Example" }, "https://other.example"),
    );
    expect(response.status).toBe(403);
    expect(mocks.insert).not.toHaveBeenCalled();
  });
  it("requires successful human verification before saving", async () => {
    mocks.verify.mockResolvedValue({ success: false });
    const response = await POST(
      request({ name: "Artist Example", country: "IN", link: "@artist" }),
    );
    expect(response.status).toBe(422);
    expect(mocks.insert).not.toHaveBeenCalled();
  });
  it("returns an error instead of claiming an unsaved nomination succeeded", async () => {
    mocks.insert.mockResolvedValue({ error: { message: "unavailable" } });
    const response = await POST(
      request({ name: "Artist Example", country: "IN", link: "@artist" }),
    );
    expect(response.status).toBe(503);
  });
});
