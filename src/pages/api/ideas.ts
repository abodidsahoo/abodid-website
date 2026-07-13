import type { APIRoute } from "astro";
import { createSupabaseServiceClient } from "../../lib/supabaseServer";

const MAX_TITLE_LENGTH = 120;
const MAX_BODY_LENGTH = 2000;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX_NOTES = 8;
const requestLog = new Map<string, number[]>();

const json = (body: unknown, status = 200, extraHeaders: Record<string, string> = {}) =>
    new Response(JSON.stringify(body), {
        status,
        headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-store",
            ...extraHeaders,
        },
    });

const getClientKey = (request: Request) => {
    const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    return request.headers.get("cf-connecting-ip")
        || forwarded
        || request.headers.get("x-real-ip")
        || "unknown";
};

const checkRateLimit = (key: string) => {
    const now = Date.now();
    const recent = (requestLog.get(key) || []).filter(
        (timestamp) => now - timestamp < RATE_LIMIT_WINDOW_MS,
    );

    if (recent.length >= RATE_LIMIT_MAX_NOTES) {
        const retryAfterMs = RATE_LIMIT_WINDOW_MS - (now - recent[0]);
        requestLog.set(key, recent);
        return Math.max(1, Math.ceil(retryAfterMs / 1000));
    }

    recent.push(now);
    requestLog.set(key, recent);
    return 0;
};

const cleanText = (value: unknown) =>
    (typeof value === "string" ? value : "")
        .replace(/\u0000/g, "")
        .trim();

export const POST: APIRoute = async ({ request, url }) => {
    try {
        const origin = request.headers.get("Origin");
        if (origin && origin !== url.origin) {
            return json({ error: "Cross-site submissions are not allowed." }, 403);
        }

        const contentLength = Number(request.headers.get("Content-Length") || 0);
        if (contentLength > 20_000) {
            return json({ error: "This note is too large." }, 413);
        }

        if (!request.headers.get("Content-Type")?.includes("application/json")) {
            return json({ error: "A JSON request is required." }, 415);
        }

        const payload = await request.json();
        if (cleanText(payload?.website)) {
            return json({ note: null }, 201);
        }

        const title = cleanText(payload?.title);
        const body = cleanText(payload?.body);

        if (!body) return json({ error: "Write a note before saving it." }, 400);
        if (title.length > MAX_TITLE_LENGTH) {
            return json({ error: `Keep the title under ${MAX_TITLE_LENGTH} characters.` }, 400);
        }
        if (body.length > MAX_BODY_LENGTH) {
            return json({ error: `Keep the note under ${MAX_BODY_LENGTH} characters.` }, 400);
        }

        const retryAfter = checkRateLimit(getClientKey(request));
        if (retryAfter) {
            return json(
                { error: "A few notes were added very quickly. Please try again shortly." },
                429,
                { "Retry-After": String(retryAfter) },
            );
        }

        const supabase = createSupabaseServiceClient();
        if (!supabase) {
            return json({ error: "The ideas board is not configured yet." }, 500);
        }

        const { data, error } = await supabase
            .from("ideas_notes")
            .insert({ title: title || null, body })
            .select("id, title, body, created_at")
            .single();

        if (error) throw error;
        return json({ note: data }, 201);
    } catch (error) {
        console.error("Ideas note submission failed:", error);
        return json({ error: "The note could not be saved just now." }, 500);
    }
};
