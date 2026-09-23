import type { APIRoute } from "astro";
import { authorizeAdminRequest, jsonResponse } from "../../../lib/admin/serverAuth";
import { validDate } from "../../../lib/reading/publicFeed";

export const prerender = false;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isUuid = (value: unknown): value is string => typeof value === "string" && UUID.test(value);

export const GET: APIRoute = async ({ request }) => {
  const auth = await authorizeAdminRequest(request);
  if (!auth.ok) return auth.response;

  const { data, error } = await auth.supabase
    .from("reading_digest_deliveries")
    .select("delivery_date,status,sent_at,reading_digest_delivery_items(position,reading_digest_readings(id,title,url,source_name,published,editorial_note,thumbnail_url,editorial_order,is_editors_pick,editors_pick_until,verification_status,status))")
    .eq("status", "sent")
    .order("delivery_date", { ascending: false })
    .order("sent_at", { ascending: false })
    .limit(20);
  if (error) return jsonResponse({ error: error.message }, 500);

  const seenDates = new Set<string>();
  const days = (data ?? []).filter((delivery) => {
    if (seenDates.has(delivery.delivery_date)) return false;
    seenDates.add(delivery.delivery_date);
    return true;
  }).map((delivery) => ({
    date: delivery.delivery_date,
    readings: (delivery.reading_digest_delivery_items ?? []).map((item: any) => ({
      ...item.reading_digest_readings,
      delivery_position: item.position,
    })).filter((reading: any) => reading.id),
  }));
  return jsonResponse({ days });
};

export const PATCH: APIRoute = async ({ request }) => {
  const auth = await authorizeAdminRequest(request);
  if (!auth.ok) return auth.response;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body." }, 400);
  }
  const { supabase } = auth;

  if (body.action === "visibility" && isUuid(body.id) && typeof body.published === "boolean") {
    const { data, error } = await supabase.from("reading_digest_readings")
      .update({ published: body.published })
      .eq("id", body.id)
      .eq("verification_status", "verified")
      .in("status", ["selected", "sent"])
      .select("id")
      .maybeSingle();
    if (error) return jsonResponse({ error: error.message }, 500);
    return data ? jsonResponse({ ok: true }) : jsonResponse({ error: "Reading not found." }, 404);
  }

  if (body.action === "editorial" && isUuid(body.id)) {
    const note = typeof body.note === "string" ? body.note.trim() : "";
    const thumbnail = typeof body.thumbnail_url === "string" ? body.thumbnail_url.trim() : "";
    if (note.length > 240 || thumbnail.length > 2_000) {
      return jsonResponse({ error: "Editorial note or thumbnail URL is too long." }, 400);
    }
    if (thumbnail) {
      try {
        if (!["https:", "http:"].includes(new URL(thumbnail).protocol)) throw new Error();
      } catch {
        return jsonResponse({ error: "Thumbnail must be an HTTP(S) URL." }, 400);
      }
    }
    const { data, error } = await supabase.from("reading_digest_readings")
      .update({ editorial_note: note || null, thumbnail_url: thumbnail || null })
      .eq("id", body.id)
      .eq("verification_status", "verified")
      .in("status", ["selected", "sent"])
      .select("id")
      .maybeSingle();
    if (error) return jsonResponse({ error: error.message }, 500);
    return data ? jsonResponse({ ok: true }) : jsonResponse({ error: "Reading not found." }, 404);
  }

  if (body.action === "feature" && isUuid(body.id)) {
    const { error } = await supabase.rpc("reading_digest_set_editors_pick", { p_reading_id: body.id });
    return error ? jsonResponse({ error: error.message }, 400) : jsonResponse({ ok: true });
  }

  if (
    body.action === "reorder" && typeof body.date === "string" && validDate(body.date) &&
    Array.isArray(body.ids) && body.ids.length > 0 && body.ids.length <= 50 && body.ids.every(isUuid)
  ) {
    const { error } = await supabase.rpc("reading_digest_reorder_day", {
      p_delivery_date: body.date,
      p_reading_ids: body.ids,
    });
    return error ? jsonResponse({ error: error.message }, 400) : jsonResponse({ ok: true });
  }

  return jsonResponse({ error: "Invalid editor action." }, 400);
};
