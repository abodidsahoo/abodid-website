import { createHash, timingSafeEqual } from "node:crypto";

const readEnvironmentValue = (name: string) => {
  const metaEnvironment = import.meta.env as Record<
    string,
    string | boolean | undefined
  >;
  const value = metaEnvironment?.[name] ?? process.env[name];
  return typeof value === "string" ? value.trim() : "";
};

const digest = (value: string) => createHash("sha256").update(value).digest();

const RATE_WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 10;
const MAX_CONCURRENT_REQUESTS = 2;
const requestWindows = new Map<string, number[]>();
const activeRequests = new Map<string, number>();

/**
 * Hashing both values before comparing keeps the buffers the same size and
 * avoids leaking a configured token's length through an early return.
 */
export const securelyMatchesBenchmarkToken = (
  candidate: string,
  expected: string,
) => timingSafeEqual(digest(candidate), digest(expected));

export const benchmarkJson = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "private, no-store, max-age=0, must-revalidate",
      Pragma: "no-cache",
      "X-Content-Type-Options": "nosniff",
    },
  });

type BenchmarkAuthorization =
  | { ok: true; development: boolean }
  | { ok: false; response: Response };

/**
 * The benchmark is deliberately frictionless in local development. A deployed
 * build fails closed unless both the feature flag and a secret token exist.
 */
export const authorizeOpportunityAiBenchmark = (
  request: Request,
): BenchmarkAuthorization => {
  const isProduction =
    import.meta.env.PROD || process.env.NODE_ENV === "production";
  if (!isProduction) {
    const hostname = new URL(request.url).hostname
      .replace(/^\[|\]$/g, "")
      .toLowerCase();
    if (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "::1"
    ) {
      return { ok: true, development: true };
    }
    return {
      ok: false,
      response: benchmarkJson(
        { error: "Local benchmark requests must use a loopback address." },
        403,
      ),
    };
  }

  const enabled =
    readEnvironmentValue("OPPORTUNITY_AI_BENCHMARK_ENABLED").toLowerCase() ===
    "true";
  const expectedToken = readEnvironmentValue("OPPORTUNITY_AI_BENCHMARK_TOKEN");
  if (!enabled || !expectedToken) {
    return {
      ok: false,
      response: benchmarkJson(
        { error: "Experimental benchmark is unavailable." },
        404,
      ),
    };
  }

  const candidate = request.headers.get("x-benchmark-token")?.trim() || "";
  if (!securelyMatchesBenchmarkToken(candidate, expectedToken)) {
    return {
      ok: false,
      response: benchmarkJson({ error: "Unauthorized." }, 401),
    };
  }

  return { ok: true, development: false };
};

type BenchmarkSlot =
  | { ok: true; release: () => void }
  | { ok: false; response: Response };

/**
 * Best-effort, per-instance protection for the only endpoint that can spend
 * money. The feature flag and secret remain the primary production boundary.
 */
export const acquireOpportunityAiBenchmarkSlot = (
  request: Request,
): BenchmarkSlot => {
  const forwardedFor =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "";
  const token = request.headers.get("x-benchmark-token")?.trim() || "";
  const key = createHash("sha256")
    .update(`${forwardedFor}|${token}|${new URL(request.url).hostname}`)
    .digest("hex");
  const now = Date.now();
  const recent = (requestWindows.get(key) || []).filter(
    (timestamp) => now - timestamp < RATE_WINDOW_MS,
  );

  if (recent.length >= MAX_REQUESTS_PER_WINDOW) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((RATE_WINDOW_MS - (now - recent[0])) / 1_000),
    );
    const response = benchmarkJson(
      { error: "Benchmark rate limit reached. Try again shortly." },
      429,
    );
    response.headers.set("Retry-After", String(retryAfterSeconds));
    return { ok: false, response };
  }

  const active = activeRequests.get(key) || 0;
  if (active >= MAX_CONCURRENT_REQUESTS) {
    const response = benchmarkJson(
      { error: "Too many benchmark comparisons are already running." },
      429,
    );
    response.headers.set("Retry-After", "5");
    return { ok: false, response };
  }

  recent.push(now);
  requestWindows.set(key, recent);
  activeRequests.set(key, active + 1);
  let released = false;

  return {
    ok: true,
    release: () => {
      if (released) return;
      released = true;
      const next = Math.max(0, (activeRequests.get(key) || 1) - 1);
      if (next === 0) activeRequests.delete(key);
      else activeRequests.set(key, next);
    },
  };
};
