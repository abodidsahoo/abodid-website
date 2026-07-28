import type { APIRoute } from "astro";
import {
  authorizeNetworkAdmin,
  networkJson,
} from "../../../../lib/network/api";

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  const authorization = await authorizeNetworkAdmin(request);
  if (authorization.response || !authorization.context) return authorization.response;
  const { supabase, user } = authorization.context;

  const { data, error } = await supabase.rpc("network_contact_facets", {
    p_owner_id: user.id,
  });

  if (error) {
    console.error("[network] Facets failed:", error.message);
    const setupMissing = /network_contact_facets|network_contacts/i.test(error.message);
    return networkJson({
      error: setupMissing
        ? "Network Intelligence has not been provisioned in Supabase yet."
        : "Could not load network filters.",
      setupRequired: setupMissing,
    }, setupMissing ? 503 : 500);
  }

  return networkJson(data || {});
};
