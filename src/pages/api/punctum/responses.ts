import type { APIRoute } from "astro";
import { getPunctumImageById } from "../../../data/punctumImages";
import {
  polygonArea,
  polygonCentroid,
  validatePolygonVertices,
  type NormalizedPoint,
} from "../../../lib/punctum/geometry";
import {
  cleanText,
  getPunctumDatabase,
  isUuid,
  jsonResponse,
} from "../../../lib/punctum/server";

export const prerender = false;

const DRAWING_TYPES = new Set([
  "tap",
  "short-mark",
  "line",
  "closed-mark",
  "scribble",
]);

const buildSelectionRecord = (
  payload: Record<string, unknown>,
  image: NonNullable<ReturnType<typeof getPunctumImageById>>,
) => {
  const vertices = payload.vertices as NormalizedPoint[];
  const centroid = polygonCentroid(vertices);
  const area = polygonArea(vertices);
  const requestedType = cleanText(payload.drawingType, 40);
  const drawingType = DRAWING_TYPES.has(requestedType)
    ? requestedType
    : "scribble";
  const fitScore = Number(payload.polygonFitScore);
  const brushRadius = Number(payload.brushRadius);

  return {
    image_version: image.version,
    image_checksum: image.checksum,
    polygon_vertices: vertices,
    vertex_count: vertices.length,
    centroid_x: centroid.x,
    centroid_y: centroid.y,
    normalized_area: area,
    drawing_type: drawingType,
    polygon_fit_score:
      Number.isFinite(fitScore) && fitScore >= 0 && fitScore <= 1
        ? fitScore
        : null,
    algorithm_version: "polygon-fit-v1",
    brush_radius:
      Number.isFinite(brushRadius) && brushRadius > 0 && brushRadius < 0.1
        ? brushRadius
        : 0.014,
  };
};

export const POST: APIRoute = async ({ request }) => {
  let payload: Record<string, unknown>;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid request." }, 400);
  }

  if (
    !isUuid(payload.sessionId) ||
    !isUuid(payload.imageId) ||
    !isUuid(payload.idempotencyKey)
  ) {
    return jsonResponse({ error: "Invalid session or image." }, 400);
  }
  if (!validatePolygonVertices(payload.vertices)) {
    return jsonResponse(
      { error: "The selected region is not a valid polygon." },
      400,
    );
  }

  const image = getPunctumImageById(payload.imageId);
  if (!image) return jsonResponse({ error: "Image not found." }, 404);

  const database = getPunctumDatabase();
  if (!database) {
    return jsonResponse({ error: "The research database is unavailable." }, 503);
  }

  const { data: session, error: sessionError } = await database
    .from("punctum_sessions")
    .select("id")
    .eq("public_session_id", payload.sessionId)
    .maybeSingle();
  if (sessionError || !session) {
    return jsonResponse({ error: "This session is no longer available." }, 401);
  }

  const { data, error } = await database
    .from("punctum_responses")
    .insert({
      image_id: image.id,
      session_id: session.id,
      ...buildSelectionRecord(payload, image),
      idempotency_key: payload.idempotencyKey,
      quality_flags: [],
    })
    .select("id, created_at")
    .single();

  if (error) {
    if (error.code === "23505") {
      const { data: existing } = await database
        .from("punctum_responses")
        .select("id, created_at")
        .eq("session_id", session.id)
        .eq("image_id", image.id)
        .maybeSingle();
      if (existing) {
        return jsonResponse(
          {
            ok: true,
            responseId: existing.id,
            createdAt: existing.created_at,
            alreadyRecorded: true,
          },
          200,
        );
      }
    }
    console.error("Punctum response save failed:", error.message);
    return jsonResponse(
      { error: "Your mark could not be recorded. Please try again." },
      500,
    );
  }

  return jsonResponse({
    ok: true,
    responseId: data.id,
    createdAt: data.created_at,
  });
};

export const PATCH: APIRoute = async ({ request }) => {
  let payload: Record<string, unknown>;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid request." }, 400);
  }

  if (
    !isUuid(payload.sessionId) ||
    !isUuid(payload.responseId) ||
    !isUuid(payload.imageId)
  ) {
    return jsonResponse({ error: "Invalid response or image." }, 400);
  }
  if (!validatePolygonVertices(payload.vertices)) {
    return jsonResponse(
      { error: "The selected region is not a valid polygon." },
      400,
    );
  }

  const image = getPunctumImageById(payload.imageId);
  if (!image) return jsonResponse({ error: "Image not found." }, 404);

  const database = getPunctumDatabase();
  if (!database) {
    return jsonResponse({ error: "The research database is unavailable." }, 503);
  }

  const { data: existing, error: existingError } = await database
    .from("punctum_responses")
    .select("id, created_at, punctum_sessions!inner(public_session_id)")
    .eq("id", payload.responseId)
    .eq("image_id", image.id)
    .eq("punctum_sessions.public_session_id", payload.sessionId)
    .maybeSingle();
  if (existingError || !existing) {
    return jsonResponse({ error: "Response not found." }, 404);
  }

  const { data, error } = await database
    .from("punctum_responses")
    .update({
      ...buildSelectionRecord(payload, image),
      quality_flags: [],
    })
    .eq("id", existing.id)
    .select("id, created_at")
    .single();

  if (error) {
    console.error("Punctum response update failed:", error.message);
    return jsonResponse(
      { error: "Your updated mark could not be recorded. Please try again." },
      500,
    );
  }

  return jsonResponse({
    ok: true,
    responseId: data.id,
    createdAt: data.created_at,
    updated: true,
  });
};
