import { createHash } from "node:crypto";
import { contactRateLimitKey } from "../contact-protection.js";
import type { SupabaseClient } from "@supabase/supabase-js";
export const digest = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export async function communityRateLimit(
  client: SupabaseClient,
  request: Request,
  scope: string,
  limit = 6,
  window = 900,
) {
  const hashed = contactRateLimitKey(request);
  if (!hashed) return true;
  const { data, error } = await client.rpc("consume_art_globe_rate_limit", {
    p_key_hash: digest(`${scope}:${hashed}`),
    p_limit: limit,
    p_window_seconds: window,
  });
  if (error)
    throw Error("The service is temporarily unavailable. Please try again.");
  return data === true;
}
export const json = (data: unknown, status = 200) =>
  Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
