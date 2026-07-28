import type { APIRoute } from "astro";
import {
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
  if (!isUuid(payload.sessionId)) {
    return jsonResponse({ error: "Invalid session." }, 400);
  }
  const database = getPunctumDatabase();
  if (!database) {
    return jsonResponse({ error: "The research database is unavailable." }, 503);
  }
  const { error } = await database
    .from("punctum_sessions")
    .update({ completed_at: new Date().toISOString() })
    .eq("public_session_id", payload.sessionId)
    .is("completed_at", null);
  if (error) return jsonResponse({ error: "Could not complete the session." }, 500);
  return jsonResponse({ ok: true });
};
