import type { APIRoute } from "astro";
import {
  authorizeNetworkAdmin,
  networkJson,
  parseRequestJson,
} from "../../../../lib/network/api";
import { discoverPublicWork } from "../../../../lib/network/openrouter.js";

export const prerender = false;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const POST: APIRoute = async ({ request }) => {
  const body = await parseRequestJson(request);
  const contactId = typeof body?.contactId === "string" ? body.contactId : "";
  if (!UUID_PATTERN.test(contactId)) {
    return networkJson({ error: "A valid contact id is required." }, 400);
  }

  const authorization = await authorizeNetworkAdmin(request);
  if (authorization.response || !authorization.context) return authorization.response;
  const { supabase, user } = authorization.context;

  const { data: contact, error } = await supabase
    .from("network_contacts")
    .select([
      "id", "full_name", "linkedin_url", "source_company", "source_position",
      "company", "position", "city", "region", "country", "enrichment_sources",
    ].join(","))
    .eq("owner_id", user.id)
    .eq("id", contactId)
    .single();

  if (error || !contact) return networkJson({ error: "Contact not found." }, 404);

  await supabase
    .from("network_contacts")
    .update({ enrichment_status: "pending" })
    .eq("owner_id", user.id)
    .eq("id", contactId);

  try {
    const result = await discoverPublicWork(contact);
    const rejectedUrls = new Set(
      (Array.isArray(contact.enrichment_sources) ? contact.enrichment_sources : [])
        .filter((item: any) => item?.state === "rejected" && typeof item?.url === "string")
        .map((item: any) => item.url),
    );
    const candidates = (Array.isArray(result?.candidates) ? result.candidates : [])
      .filter((candidate: any) => !rejectedUrls.has(candidate?.url));
    await supabase
      .from("network_contacts")
      .update({ enrichment_status: "review" })
      .eq("owner_id", user.id)
      .eq("id", contactId);
    return networkJson({ ...result, candidates });
  } catch (discoveryError) {
    await supabase
      .from("network_contacts")
      .update({ enrichment_status: "failed" })
      .eq("owner_id", user.id)
      .eq("id", contactId);
    console.error(
      "[network] Public discovery failed:",
      discoveryError instanceof Error ? discoveryError.message : discoveryError,
    );
    return networkJson({
      error: discoveryError instanceof Error
        ? discoveryError.message
        : "Public discovery failed.",
    }, 502);
  }
};
