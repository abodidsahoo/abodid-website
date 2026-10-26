import type { APIRoute } from "astro";
import { randomBytes } from "node:crypto";
import { createSupabaseServiceClient } from "../../../lib/supabaseServer";
import { publicName, sameOrigin } from "../../../lib/artist-globe/community";
import {
  communityRateLimit,
  digest,
  json,
} from "../../../lib/artist-globe/server";
export const prerender = false;
const cookieName = "art-wanderer";
const month = () => new Date().toISOString().slice(0, 7) + "-01";
export const GET: APIRoute = async ({ cookies }) => {
  const client = createSupabaseServiceClient();
  if (!client)
    return json({ error: "Leaderboard is temporarily unavailable." }, 503);
  const token = cookies.get(cookieName)?.value;
  const [ranking, award, mine] = await Promise.all([
    client
      .from("art_globe_wanderers")
      .select("display_name,active_seconds")
      .eq("month", month())
      .eq("public_opt_in", true)
      .gt("active_seconds", 0)
      .order("active_seconds", { ascending: false })
      .order("last_heartbeat", { ascending: true })
      .limit(10),
    client
      .from("art_globe_wanderers")
      .select("display_name,month")
      .eq("awarded", true)
      .eq("public_opt_in", true)
      .order("month", { ascending: false })
      .limit(1),
    token && /^[a-f0-9]{64}$/.test(token)
      ? client
          .from("art_globe_wanderers")
          .select("display_name,active_seconds,public_opt_in")
          .eq("month", month())
          .eq("visitor_hash", digest(token))
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  if (ranking.error || award.error || mine.error)
    return json({ error: "Leaderboard is temporarily unavailable." }, 503);
  return json({
    month: month(),
    leaders: ranking.data,
    award: award.data?.[0] || null,
    mine: mine.data,
  });
};
export const POST: APIRoute = async ({ request, cookies, url }) => {
  if (!sameOrigin(request))
    return json({ error: "Cross-site requests are not allowed." }, 403);
  let body: Record<string, unknown>;
  try {
    const raw = await request.text();
    if (raw.length > 2048) return json({ error: "Request too large." }, 413);
    body = JSON.parse(raw);
  } catch {
    return json({ error: "Invalid request." }, 400);
  }
  if (!body || typeof body !== "object" || Array.isArray(body))
    return json({ error: "Invalid request." }, 400);
  const client = createSupabaseServiceClient();
  if (!client)
    return json({ error: "Leaderboard is temporarily unavailable." }, 503);
  let token = cookies.get(cookieName)?.value;
  const validToken = token && /^[a-f0-9]{64}$/.test(token);
  if (body.action === "leave") {
    if (validToken) {
      const { error } = await client
        .from("art_globe_wanderers")
        .update({ public_opt_in: false })
        .eq("visitor_hash", digest(token!));
      if (error)
        return json({ error: "Could not leave. Please try again." }, 503);
    }
    cookies.delete(cookieName, { path: "/" });
    return json({ success: true });
  }
  let name: string | null = null;
  if (body.action === "join") {
    try {
      name = publicName(body.name);
    } catch (error) {
      return json({ error: (error as Error).message }, 400);
    }
    try {
      if (
        !(await communityRateLimit(
          client,
          request,
          "art-wanderer-join",
          6,
          900,
        ))
      )
        return json({ error: "Please wait before joining again." }, 429);
    } catch {
      return json({ error: "Please try again shortly." }, 503);
    }
    if (!validToken) token = randomBytes(32).toString("hex");
  } else if (body.action !== "heartbeat" || !validToken) {
    return json({ error: "Join the leaderboard first." }, 400);
  }
  const { data, error } = await client.rpc("record_art_globe_wandering", {
    p_visitor_hash: digest(token!),
    p_name: name,
    p_active: body.action === "heartbeat" && body.active === true,
  });
  if (error)
    return json({ error: "Your wandering time could not be saved." }, 503);
  if (name)
    cookies.set(cookieName, token!, {
      httpOnly: true,
      secure: url.protocol === "https:",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 40,
    });
  return json({ success: true, seconds: data });
};
