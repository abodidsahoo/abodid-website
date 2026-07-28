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

  const rating = Number(payload.rating);
  const review = cleanText(payload.review, 600);
  if (
    !isUuid(payload.sessionId) ||
    !Number.isInteger(rating) ||
    rating < 1 ||
    rating > 5
  ) {
    return jsonResponse({ error: "Choose a rating from 1 to 5." }, 400);
  }

  const database = getPunctumDatabase();
  if (!database) {
    return jsonResponse({ error: "The research database is unavailable." }, 503);
  }

  const { data: session, error: sessionError } = await database
    .from("punctum_sessions")
    .select("id, completed_at, metadata")
    .eq("public_session_id", payload.sessionId)
    .maybeSingle();

  if (sessionError || !session) {
    return jsonResponse({ error: "This session is no longer available." }, 404);
  }
  if (!session.completed_at) {
    return jsonResponse({ error: "Complete the experiment before rating it." }, 409);
  }

  const currentMetadata =
    session.metadata &&
    typeof session.metadata === "object" &&
    !Array.isArray(session.metadata)
      ? session.metadata
      : {};
  const { error } = await database
    .from("punctum_sessions")
    .update({
      metadata: {
        ...currentMetadata,
        feedback: {
          rating,
          review: review || null,
          submitted_at: new Date().toISOString(),
        },
      },
    })
    .eq("id", session.id);

  if (error) {
    console.error("Punctum feedback save failed:", error.message);
    return jsonResponse({ error: "Your feedback could not be saved." }, 500);
  }

  return jsonResponse({ ok: true });
};
