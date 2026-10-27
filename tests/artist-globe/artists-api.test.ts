import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import candidates from "../../src/data/artist-globe/research-candidates.json";
import { demoArtists } from "../../src/lib/artist-globe/data";
const mocks = vi.hoisted(() => ({
  client: vi.fn(),
  eq: vi.fn(),
  or: vi.fn(),
  result: vi.fn(),
}));
vi.mock("../../src/lib/supabaseServer", () => ({
  createSupabaseServiceClient: mocks.client,
}));
import { GET } from "../../src/pages/api/artist-globe/artists";
beforeEach(() => {
  vi.clearAllMocks();
  const query: any = {
    select: () => query,
    eq: mocks.eq,
    or: mocks.or,
    order: () => query,
    limit: () => query,
    abortSignal: mocks.result,
  };
  mocks.eq.mockReturnValue(query);
  mocks.or.mockReturnValue(query);
  mocks.client.mockReturnValue({ from: () => query });
});
afterEach(() => vi.unstubAllEnvs());
describe("atlas publication boundary", () => {
  it("production queries published rows only and never falls back to research drafts", async () => {
    vi.stubEnv("DEV", false);
    mocks.result.mockResolvedValue({ data: demoArtists, error: null });
    const response = await GET({} as any);
    const body = await response.json();
    expect(mocks.eq).toHaveBeenCalledWith("published", true);
    expect(mocks.or).not.toHaveBeenCalled();
    expect(body.artists.every((a: any) => !a.id.startsWith("atlas-csv-"))).toBe(
      true,
    );
  });
  it("production service failure preserves the demo fallback rather than disclosing drafts", async () => {
    vi.stubEnv("DEV", false);
    mocks.client.mockReturnValue(null);
    const body = await (await GET({} as any)).json();
    expect(body.mode).toBe("demo");
    expect(body.artists.every((a: any) => a.is_demo)).toBe(true);
  });
  it("production maps every published real profile and suppresses fictional demos", async () => {
    vi.stubEnv("DEV", false);
    mocks.result.mockResolvedValue({
      data: [...demoArtists, ...candidates],
      error: null,
    });
    const body = await (await GET({} as any)).json();
    expect(mocks.eq).toHaveBeenCalledWith("published", true);
    expect(body.mode).toBe("live");
    expect(body.artists).toHaveLength(216);
    expect(
      body.artists.every(
        (a: any) =>
          !a.is_demo &&
          Number.isFinite(a.latitude) &&
          Number.isFinite(a.longitude),
      ),
    ).toBe(true);
    expect(
      body.artists.filter((a: any) => a.map_placement === "city"),
    ).toHaveLength(86);
    expect(
      body.artists.filter((a: any) => a.map_placement === "country"),
    ).toHaveLength(130);
    expect(
      body.artists.filter((a: any) => a.source_latitude === null),
    ).toHaveLength(152);
  });
  it("development exposes the research preview and never substitutes proxy pins", async () => {
    vi.stubEnv("DEV", true);
    mocks.result.mockResolvedValue({
      data: [...demoArtists, ...candidates],
      error: null,
    });
    const response = await GET({} as any),
      body = await response.json();
    expect(mocks.or).toHaveBeenCalledWith(
      "published.eq.true,id.like.atlas-csv-*",
    );
    expect(body.mode).toBe("research-preview");
    expect(body.artists).toHaveLength(216);
    expect(body.artists.filter((a: any) => a.map_pin_ready)).toHaveLength(28);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
});
