import type { APIRoute } from "astro";
import {
  getPunctumImageById,
  PUNCTUM_STUDY_ID,
} from "../../../data/punctumImages";
import { validatePolygonVertices } from "../../../lib/punctum/geometry";
import {
  allowNewSession,
  cleanText,
  getPunctumDatabase,
  isUuid,
  jsonResponse,
  normalizeCountryCode,
  normalizeOptionalChoice,
  validAgeBands,
  validGenders,
  verifyTurnstile,
} from "../../../lib/punctum/server";

export const prerender = false;

type SessionResponseRow = {
  id: string;
  image_id: string;
  polygon_vertices: Array<{ x: number; y: number }>;
  punctum_annotations:
    | { text: string; moderation_status: string }
    | Array<{ text: string; moderation_status: string }>
    | null;
};

const getAnnotation = (row: SessionResponseRow) =>
  Array.isArray(row.punctum_annotations)
    ? row.punctum_annotations[0]
    : row.punctum_annotations;

export const GET: APIRoute = async ({ request }) => {
  const sessionId = cleanText(new URL(request.url).searchParams.get("id"), 80);
  if (!isUuid(sessionId)) {
    return jsonResponse({ error: "Invalid session." }, 400);
  }

  const database = getPunctumDatabase();
  if (!database) {
    return jsonResponse({ error: "The research database is unavailable." }, 503);
  }

  const { data: session, error: sessionError } = await database
    .from("punctum_sessions")
    .select("id")
    .eq("public_session_id", sessionId)
    .maybeSingle();
  if (sessionError || !session) {
    return jsonResponse({ error: "This session is no longer available." }, 404);
  }

  const { data, error } = await database
    .from("punctum_responses")
    .select(
      "id, image_id, polygon_vertices, punctum_annotations(text, moderation_status)",
    )
    .eq("session_id", session.id)
    .eq("is_valid", true)
    .order("created_at", { ascending: true });
  if (error) {
    return jsonResponse({ error: "Your punctums could not be loaded." }, 500);
  }

  const markings = ((data || []) as unknown as SessionResponseRow[])
    .map((row) => {
      const image = getPunctumImageById(row.image_id);
      if (!image || !validatePolygonVertices(row.polygon_vertices)) return null;
      const annotation = getAnnotation(row);
      return {
        responseId: row.id,
        imageId: image.id,
        imageTitle: image.title,
        imageSlug: image.slug,
        imageUrl: image.url,
        width: image.width,
        height: image.height,
        softBackground: image.softBackground,
        vertices: row.polygon_vertices,
        annotation: cleanText(annotation?.text, 600),
      };
    })
    .filter(Boolean);

  return jsonResponse({ ok: true, markings });
};

export const POST: APIRoute = async ({ request }) => {
  const limit = allowNewSession(request);
  if (!limit.allowed) {
    return jsonResponse(
      { error: "Please wait before beginning another session." },
      429,
      { "Retry-After": String(limit.retryAfter) },
    );
  }

  let payload: Record<string, unknown>;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid request." }, 400);
  }

  if (payload.ageConfirmed !== true || payload.consentAccepted !== true) {
    return jsonResponse(
      { error: "Age confirmation and consent are required." },
      400,
    );
  }

  const verification = await verifyTurnstile({
    request,
    token: cleanText(payload.turnstileToken, 2048),
  });
  if (!verification.success) {
    return jsonResponse(
      { error: "Human verification could not be confirmed. Please try again." },
      403,
    );
  }

  const database = getPunctumDatabase();
  if (!database) {
    return jsonResponse({ error: "The research database is unavailable." }, 503);
  }

  const publicSessionId = crypto.randomUUID();
  const { data, error } = await database
    .from("punctum_sessions")
    .insert({
      public_session_id: publicSessionId,
      study_id: PUNCTUM_STUDY_ID,
      consent_version: "punctum-consent-v1",
      age_confirmed: true,
      age_band: normalizeOptionalChoice(payload.ageBand, validAgeBands),
      gender: normalizeOptionalChoice(payload.gender, validGenders),
      country_code: normalizeCountryCode(payload.countryCode),
      verification_method: verification.method,
      verified_at: new Date().toISOString(),
      metadata: {
        client_version: "punctum-web-v1",
        language: cleanText(payload.language, 20) || null,
      },
    })
    .select("public_session_id, started_at")
    .single();

  if (error) {
    console.error("Punctum session creation failed:", error.message);
    return jsonResponse(
      { error: "We could not begin the experiment. Please try again." },
      500,
    );
  }

  return jsonResponse({
    ok: true,
    sessionId: data.public_session_id,
    startedAt: data.started_at,
  });
};
