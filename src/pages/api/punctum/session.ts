import type { APIRoute } from "astro";
import { PUNCTUM_STUDY_ID } from "../../../data/punctumImages";
import {
  allowNewSession,
  cleanText,
  getPunctumDatabase,
  jsonResponse,
  normalizeCountryCode,
  normalizeOptionalChoice,
  validAgeBands,
  validGenders,
  verifyTurnstile,
} from "../../../lib/punctum/server";

export const prerender = false;

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
