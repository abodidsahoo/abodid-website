import { createSupabaseServiceClient } from "../supabaseServer";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const sessionRateLimit = new Map<string, { count: number; resetAt: number }>();
const SESSION_WINDOW_MS = 60 * 60 * 1000;
const MAX_SESSIONS_PER_WINDOW = 12;

export const PUNCTUM_MINIMUM_COHORT = 10;

export const jsonResponse = (
  body: unknown,
  status = 200,
  headers: Record<string, string> = {},
) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...headers,
    },
  });

export const cleanText = (value: unknown, maxLength: number) =>
  typeof value === "string"
    ? value.trim().replace(/\r\n/g, "\n").slice(0, maxLength)
    : "";

export const isUuid = (value: unknown): value is string =>
  typeof value === "string" && UUID_PATTERN.test(value);

export const getRequestIp = (request: Request) =>
  cleanText(
    request.headers.get("cf-connecting-ip") ||
      request.headers.get("x-real-ip") ||
      request.headers.get("x-forwarded-for")?.split(",")[0] ||
      "unknown",
    80,
  );

export const allowNewSession = (request: Request) => {
  const key = getRequestIp(request);
  const now = Date.now();
  const current = sessionRateLimit.get(key);
  if (!current || current.resetAt <= now) {
    sessionRateLimit.set(key, {
      count: 1,
      resetAt: now + SESSION_WINDOW_MS,
    });
    return { allowed: true, retryAfter: 0 };
  }
  if (current.count >= MAX_SESSIONS_PER_WINDOW) {
    return {
      allowed: false,
      retryAfter: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
    };
  }
  current.count += 1;
  return { allowed: true, retryAfter: 0 };
};

export const verifyTurnstile = async ({
  request,
  token,
}: {
  request: Request;
  token: string;
}) => {
  const requestUrl = new URL(request.url);
  const isLocalPreview =
    import.meta.env.DEV &&
    ["localhost", "127.0.0.1", "::1"].includes(requestUrl.hostname);
  if (isLocalPreview && token === "local-preview") {
    return { success: true, method: "local-preview" };
  }

  const secret =
    import.meta.env.TURNSTILE_SECRET_KEY ||
    process.env.TURNSTILE_SECRET_KEY ||
    "";
  if (!secret || !token) {
    return { success: false, method: "turnstile" };
  }

  const form = new FormData();
  form.set("secret", secret);
  form.set("response", token);
  const remoteIp = getRequestIp(request);
  if (remoteIp !== "unknown") form.set("remoteip", remoteIp);

  try {
    const response = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      { method: "POST", body: form },
    );
    if (!response.ok) return { success: false, method: "turnstile" };
    const payload = (await response.json()) as { success?: boolean };
    return { success: payload.success === true, method: "turnstile" };
  } catch {
    return { success: false, method: "turnstile" };
  }
};

export const getPunctumDatabase = () => createSupabaseServiceClient();

export const validAgeBands = new Set([
  "18-24",
  "25-34",
  "35-44",
  "45-54",
  "55-64",
  "65+",
  "prefer_not",
]);

export const validGenders = new Set([
  "woman",
  "man",
  "non_binary",
  "self_described",
  "prefer_not",
]);

export const normalizeOptionalChoice = (
  value: unknown,
  allowed: Set<string>,
) => {
  const cleaned = cleanText(value, 80);
  return cleaned && allowed.has(cleaned) ? cleaned : null;
};

export const normalizeCountryCode = (value: unknown) => {
  const cleaned = cleanText(value, 24).toUpperCase();
  return /^[A-Z]{2}$/.test(cleaned) || cleaned === "PREFER_NOT"
    ? cleaned
    : null;
};
