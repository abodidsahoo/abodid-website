export const prerender = false;

import type { APIRoute } from "astro";
import {
  authorizeAdminRequest,
  jsonResponse,
} from "../../../../lib/admin/serverAuth";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const safeExternalUrl = (value: unknown) => {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
};

export const GET: APIRoute = async ({ request, params }) => {
  const authorization = await authorizeAdminRequest(request);
  if (!authorization.ok) return authorization.response;

  const userId = String(params.id || "");
  if (!UUID_PATTERN.test(userId))
    return jsonResponse({ error: "User not found." }, 404);

  try {
    const { supabase } = authorization;
    const [membershipResult, profileResult, authResult, opportunitiesResult] =
      await Promise.all([
        supabase
          .from("opportunity_memberships")
          .select("user_id, first_seen_at, ai_monthly_limit")
          .eq("user_id", userId)
          .maybeSingle(),
        supabase
          .from("profiles")
          .select("id, username, full_name, avatar_url, is_public")
          .eq("id", userId)
          .maybeSingle(),
        supabase.auth.admin.getUserById(userId),
        supabase
          .from("saved_opportunities")
          .select(
            "id, title, source_url, deadline_at, status, content, created_at, updated_at",
          )
          .eq("user_id", userId)
          .order("created_at", { ascending: false }),
      ]);

    if (membershipResult.error || !membershipResult.data) {
      return jsonResponse(
        { error: "Opportunity Tracker user not found." },
        404,
      );
    }

    const queryError =
      profileResult.error || authResult.error || opportunitiesResult.error;
    if (queryError) throw queryError;

    const month = new Date().toISOString().slice(0, 7) + "-01";
    const [usage, requests] = await Promise.all([
      supabase.rpc("opportunity_ai_usage_summary", { p_user_id: userId }),
      supabase
        .from("opportunity_credit_requests")
        .select("message,created_at,delivery_status")
        .eq("user_id", userId)
        .eq("status", "pending")
        .maybeSingle(),
    ]);
    if (usage.error || requests.error) throw new Error("Allowance unavailable");
    const authUser = authResult.data.user;
    const profile = profileResult.data;
    return jsonResponse({
      user: {
        id: userId,
        monthlyLimit:
          membershipResult.data.ai_monthly_limit ??
          Number(process.env.OPPORTUNITIES_AI_MONTHLY_LIMIT || 5),
        aiUsed: Number(usage.data?.[0]?.used_month || 0),
        aiTotal: Number(usage.data?.[0]?.total_attempts || 0),
        creditRequest: requests.data,
        displayName:
          profile?.full_name ||
          profile?.username ||
          authUser?.email?.split("@")[0] ||
          "Unnamed user",
        username: profile?.username || null,
        email: authUser?.email || null,
        avatarUrl: profile?.avatar_url || null,
        isPublic: Boolean(profile?.is_public),
        onboardedAt: membershipResult.data.first_seen_at,
      },
      opportunities: (opportunitiesResult.data || []).map((opportunity) => ({
        id: opportunity.id,
        title: opportunity.title,
        sourceUrl: safeExternalUrl(opportunity.source_url),
        deadlineAt: opportunity.deadline_at,
        status: opportunity.status,
        organisation: opportunity.content?.organisation || null,
        category: opportunity.content?.category || null,
        createdAt: opportunity.created_at,
        updatedAt: opportunity.updated_at,
      })),
    });
  } catch (error) {
    console.error("Failed to load Opportunity Tracker collection:", error);
    return jsonResponse({ error: "Could not load this collection." }, 500);
  }
};

export const PATCH: APIRoute = async ({ request, params }) => {
  const authorization = await authorizeAdminRequest(request);
  if (!authorization.ok) return authorization.response;
  const userId = String(params.id || "");
  if (!UUID_PATTERN.test(userId))
    return jsonResponse({ error: "User not found." }, 404);
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body))
    return jsonResponse({ error: "Invalid allowance update." }, 400);
  const increment = body.increment;
  const absolute = body.monthly_limit;
  const isIncrement = increment !== undefined;
  if (
    !Number.isInteger(body.expected_limit) ||
    body.expected_limit < 0 ||
    body.expected_limit > 10000 ||
    Object.keys(body).some(
      (key) =>
        ![
          "expected_limit",
          isIncrement ? "increment" : "monthly_limit",
        ].includes(key),
    ) ||
    (isIncrement
      ? ![5, 10].includes(increment)
      : !Number.isInteger(absolute) || absolute < 0 || absolute > 10000)
  ) {
    return jsonResponse(
      {
        error:
          "Choose +5 or +10, or enter a whole monthly allowance from 0 to 10,000.",
      },
      400,
    );
  }
  const configured = Number(process.env.OPPORTUNITIES_AI_MONTHLY_LIMIT ?? 5);
  const defaultLimit =
    Number.isInteger(configured) && configured >= 0 && configured <= 10000
      ? configured
      : 5;
  const { data, error } = await authorization.supabase.rpc(
    "confirm_opportunity_ai_allowance",
    {
      p_user_id: userId,
      p_admin_id: authorization.user.id,
      p_expected_limit: body.expected_limit,
      p_default_limit: defaultLimit,
      p_increment: isIncrement ? increment : null,
      p_limit: isIncrement ? null : absolute,
    },
  );
  if (error)
    return jsonResponse(
      {
        error:
          error.code === "40001"
            ? "This allowance changed while you were reviewing it. Refresh the user and confirm again."
            : error.code === "22023"
              ? "Monthly allowance cannot exceed 10,000."
              : "The allowance could not be updated. Refresh and try again.",
      },
      error.code === "40001" ? 409 : error.code === "22023" ? 400 : 503,
    );
  return jsonResponse({ saved: true, monthly_limit: data });
};
