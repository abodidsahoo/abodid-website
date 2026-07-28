import type { APIRoute } from "astro";
import {
  authorizeNetworkAdmin,
  networkJson,
  parseRequestJson,
} from "../../../../../../lib/network/api";
import { inferEmailType } from "../../../../../../lib/network/csv.js";

export const prerender = false;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DETAIL_SELECT = [
  "id", "owner_id", "source_record_key", "first_name", "last_name", "full_name",
  "linkedin_url", "source_email", "source_company", "source_position", "connected_on",
  "imported_at", "last_seen_in_export", "present_in_latest_export", "import_snapshot",
  "email", "company", "position", "city", "region", "country", "personal_website",
  "work_categories", "expertise_keywords", "outreach_goals", "relationship_tier",
  "tags", "starred", "notes", "relationship_context", "public_summary",
  "match_explanation", "employment_history", "public_links", "enrichment_sources",
  "custom_fields", "incoming_conflicts", "last_verified_at", "enrichment_status",
  "verification_state", "confidence", "has_email", "email_type", "newsletter_status",
  "newsletter_consent_source", "do_not_contact", "archived", "embedding_model",
  "embedded_at", "embedding_refresh_needed", "created_at", "updated_at",
].join(",");

const TEXT_FIELDS = new Set([
  "email",
  "company",
  "position",
  "city",
  "region",
  "country",
  "personal_website",
  "relationship_tier",
  "notes",
  "relationship_context",
  "public_summary",
  "newsletter_status",
  "newsletter_consent_source",
  "verification_state",
  "enrichment_status",
]);

const ARRAY_FIELDS = new Set([
  "work_categories",
  "expertise_keywords",
  "outreach_goals",
  "tags",
]);

const BOOLEAN_FIELDS = new Set([
  "starred",
  "do_not_contact",
  "archived",
]);

const cleanText = (value: unknown, maxLength = 10000) => {
  if (value === null) return null;
  if (typeof value !== "string") return undefined;
  const text = value.replace(/\r\n/g, "\n").trim();
  return text ? text.slice(0, maxLength) : null;
};

const cleanArray = (value: unknown) => {
  if (!Array.isArray(value)) return undefined;
  return [...new Set(
    value
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.replace(/\s+/g, " ").trim())
      .filter(Boolean),
  )].slice(0, 50);
};

const normalizeUpdates = (body: Record<string, unknown>) => {
  const updates: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(body)) {
    if (TEXT_FIELDS.has(key)) {
      const cleaned = cleanText(value, key === "notes" || key === "relationship_context" ? 20000 : 1000);
      if (cleaned !== undefined) updates[key] = cleaned;
    } else if (ARRAY_FIELDS.has(key)) {
      const cleaned = cleanArray(value);
      if (cleaned !== undefined) updates[key] = cleaned;
    } else if (BOOLEAN_FIELDS.has(key) && typeof value === "boolean") {
      updates[key] = value;
    } else if (
      key === "custom_fields"
      && value
      && typeof value === "object"
      && !Array.isArray(value)
    ) {
      updates.custom_fields = value;
    }
  }

  if (Object.prototype.hasOwnProperty.call(updates, "email")) {
    updates.email_type = inferEmailType(updates.email);
  }

  return updates;
};

const loadContact = async (supabase: any, ownerId: string, id: string) => {
  const { data, error } = await supabase
    .from("network_contacts")
    .select(DETAIL_SELECT)
    .eq("owner_id", ownerId)
    .eq("id", id)
    .single();
  return { data, error };
};

export const GET: APIRoute = async ({ request, params }) => {
  const id = params.id || "";
  if (!UUID_PATTERN.test(id)) return networkJson({ error: "Invalid contact id." }, 400);

  const authorization = await authorizeNetworkAdmin(request);
  if (authorization.response || !authorization.context) return authorization.response;
  const { supabase, user } = authorization.context;
  const { data, error } = await loadContact(supabase, user.id, id);

  if (error || !data) {
    return networkJson({ error: "Contact not found." }, error?.code === "PGRST116" ? 404 : 500);
  }
  return networkJson({ contact: data });
};

export const PATCH: APIRoute = async ({ request, params }) => {
  const id = params.id || "";
  if (!UUID_PATTERN.test(id)) return networkJson({ error: "Invalid contact id." }, 400);

  const body = await parseRequestJson(request);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return networkJson({ error: "A JSON update is required." }, 400);
  }

  const updates = normalizeUpdates(body as Record<string, unknown>);
  if (!Object.keys(updates).length) {
    return networkJson({ error: "No supported fields were provided." }, 400);
  }

  const authorization = await authorizeNetworkAdmin(request);
  if (authorization.response || !authorization.context) return authorization.response;
  const { supabase, user } = authorization.context;

  const { error: updateError } = await supabase
    .from("network_contacts")
    .update(updates)
    .eq("owner_id", user.id)
    .eq("id", id);

  if (updateError) {
    console.error("[network] Contact update failed:", updateError.message);
    return networkJson({ error: "Could not update the contact." }, 500);
  }

  const { data, error } = await loadContact(supabase, user.id, id);
  if (error || !data) return networkJson({ error: "Contact not found." }, 404);
  return networkJson({ contact: data });
};

export const DELETE: APIRoute = async ({ request, params }) => {
  const id = params.id || "";
  if (!UUID_PATTERN.test(id)) return networkJson({ error: "Invalid contact id." }, 400);

  const authorization = await authorizeNetworkAdmin(request);
  if (authorization.response || !authorization.context) return authorization.response;
  const { supabase, user } = authorization.context;

  const { data, error } = await supabase
    .from("network_contacts")
    .delete()
    .eq("owner_id", user.id)
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("[network] Contact deletion failed:", error.message);
    return networkJson({ error: "Could not delete the contact." }, 500);
  }
  if (!data) return networkJson({ error: "Contact not found." }, 404);
  return networkJson({ deleted: true, id: data.id });
};
