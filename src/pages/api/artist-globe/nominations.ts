import type { APIRoute } from "astro";
import { createSupabaseServiceClient } from "../../../lib/supabaseServer";
import {
  nominationInput,
  sameOrigin,
} from "../../../lib/artist-globe/community";
import { communityRateLimit, json } from "../../../lib/artist-globe/server";
import { verifyContactTurnstile } from "../../../lib/contact-protection.js";
import countries from "../../../lib/artist-globe/countries.json";
export const prerender = false;
export const POST: APIRoute = async ({ request }) => {
  if (!sameOrigin(request))
    return json({ error: "Cross-site submissions are not allowed." }, 403);
  if (Number(request.headers.get("content-length")) > 8192)
    return json({ error: "Submission too large." }, 413);
  let body: Record<string, unknown>;
  try {
    const raw = await request.text();
    if (raw.length > 8192) return json({ error: "Submission too large." }, 413);
    body = JSON.parse(raw);
  } catch {
    return json({ error: "Invalid submission." }, 400);
  }
  if (!body || typeof body !== "object" || Array.isArray(body))
    return json({ error: "Invalid submission." }, 400);
  if (body.fax) return json({ success: true });
  let input;
  try {
    input = nominationInput(body);
  } catch (error) {
    return json({ error: (error as Error).message }, 400);
  }
  const client = createSupabaseServiceClient();
  if (!client)
    return json({ error: "Nominations are temporarily unavailable." }, 503);
  try {
    if (!(await communityRateLimit(client, request, "artist-nomination")))
      return json(
        { error: "Please wait before sending another nomination." },
        429,
      );
    const verification = await verifyContactTurnstile({
      request,
      token: typeof body.turnstileToken === "string" ? body.turnstileToken : "",
    });
    if (!verification.success)
      return json(
        { error: "Please complete the verification and try again." },
        422,
      );
    const country = countries.find((c) => c.code === input.country)!.name;
    const { error } = await client.from("art_globe_artists").insert({
      id: `nomination-${crypto.randomUUID()}`,
      name: input.name,
      current_city: input.city,
      country,
      latitude: input.latitude,
      longitude: input.longitude,
      nomination_link: input.link,
      portfolio_url: input.link.startsWith("https://") ? input.link : null,
      is_demo: false,
      published: false,
      nomination_status: "pending",
    });
    if (error) throw error;
    return json({ success: true });
  } catch {
    return json(
      { error: "Your nomination could not be saved. Please try again." },
      503,
    );
  }
};
