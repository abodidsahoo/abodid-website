import type { APIRoute } from "astro";
import {
  authorizeAdminRequest,
  jsonResponse,
} from "../../../../lib/admin/serverAuth";
import { extractXRLinkMetadata } from "../../../../lib/xr-showcase/metadata";

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const authorization = await authorizeAdminRequest(request);
  if (!authorization.ok) return authorization.response;

  try {
    const body = await request.json();
    const url = typeof body?.url === "string" ? body.url.trim() : "";
    if (!url || url.length > 2_000) {
      return jsonResponse({ error: "Enter a valid website link." }, 400);
    }

    const metadata = await extractXRLinkMetadata(url);
    return jsonResponse({ metadata });
  } catch (error) {
    console.error("Could not extract XR link metadata:", error);
    const message =
      error instanceof Error ? error.message : "Could not read metadata from this link.";
    return jsonResponse({ error: message }, 422);
  }
};

