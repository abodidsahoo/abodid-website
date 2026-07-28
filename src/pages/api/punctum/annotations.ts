import type { APIRoute } from "astro";
import {
  cleanText,
  getPunctumDatabase,
  isUuid,
  jsonResponse,
} from "../../../lib/punctum/server";

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  let payload: Record<string, unknown>;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid request." }, 400);
  }

  if (!isUuid(payload.sessionId) || !isUuid(payload.responseId)) {
    return jsonResponse({ error: "Invalid response." }, 400);
  }
  const text = cleanText(payload.text, 600);
  if (!text) return jsonResponse({ error: "Write a short response first." }, 400);

  const database = getPunctumDatabase();
  if (!database) {
    return jsonResponse({ error: "The research database is unavailable." }, 503);
  }

  const { data: response, error: responseError } = await database
    .from("punctum_responses")
    .select("id, punctum_sessions!inner(public_session_id)")
    .eq("id", payload.responseId)
    .eq("punctum_sessions.public_session_id", payload.sessionId)
    .maybeSingle();
  if (responseError || !response) {
    return jsonResponse({ error: "Response not found." }, 404);
  }

  const { error } = await database.from("punctum_annotations").upsert(
    {
      response_id: response.id,
      text,
      moderation_status: "pending",
    },
    { onConflict: "response_id" },
  );
  if (error) {
    console.error("Punctum annotation save failed:", error.message);
    return jsonResponse(
      { error: "The note could not be saved. You can continue without it." },
      500,
    );
  }
  return jsonResponse({ ok: true, moderationStatus: "pending" });
};
