import type { APIRoute } from "astro";
import { Resend } from "resend";
import {
  authorizeOpportunityRequest,
  opportunityJson,
} from "../../../lib/opportunities/userAuth";
export const prerender = false;
export const GET: APIRoute = async ({ request }) => {
  const a = await authorizeOpportunityRequest(request);
  if (!a.ok) return a.response;
  const month = new Date().toISOString().slice(0, 7) + "-01";
  const [usage, member, saved, pending] = await Promise.all([
    a.serviceClient
      .from("opportunity_ai_usage")
      .select("captures")
      .eq("user_id", a.user.id)
      .eq("month_start", month)
      .maybeSingle(),
    a.serviceClient
      .from("opportunity_memberships")
      .select("ai_monthly_limit")
      .eq("user_id", a.user.id)
      .maybeSingle(),
    a.userClient
      .from("saved_opportunities")
      .select("id", { count: "exact", head: true }),
    a.serviceClient
      .from("opportunity_credit_requests")
      .select("id,delivery_status")
      .eq("user_id", a.user.id)
      .eq("status", "pending")
      .maybeSingle(),
  ]);
  if ([usage, member, saved, pending].some((r) => r.error))
    return opportunityJson(
      { error: "Your allowance could not be loaded. Please try again." },
      503,
    );
  const configured = Number(process.env.OPPORTUNITIES_AI_MONTHLY_LIMIT ?? 5);
  const defaultLimit =
    Number.isInteger(configured) && configured >= 0 && configured <= 10000
      ? configured
      : 5;
  const reset = new Date(month);
  reset.setUTCMonth(reset.getUTCMonth() + 1);
  return opportunityJson({
    used: usage.data?.captures || 0,
    limit:
      defaultLimit === 0 ? 0 : (member.data?.ai_monthly_limit ?? defaultLimit),
    saved: saved.count || 0,
    capacity: 100,
    resets_at: reset.toISOString(),
    request: pending.data,
  });
};
export const POST: APIRoute = async ({ request }) => {
  const a = await authorizeOpportunityRequest(request);
  if (!a.ok) return a.response;
  if (!a.user.email || !a.user.email_confirmed_at)
    return opportunityJson(
      { error: "A verified account email is required." },
      403,
    );
  const body = await request.json().catch(() => null);
  const message = typeof body?.message === "string" ? body.message.trim() : "";
  if (message.length < 10 || message.length > 2000)
    return opportunityJson(
      { error: "Please write between 10 and 2,000 characters." },
      400,
    );
  const key = process.env.RESEND_API_KEY || import.meta.env.RESEND_API_KEY;
  if (!key)
    return opportunityJson(
      {
        error:
          "Email is temporarily unavailable. Please email hello@abodid.com directly.",
      },
      503,
    );
  const { data, error } = await a.serviceClient
    .from("opportunity_credit_requests")
    .insert({ user_id: a.user.id, message })
    .select("id")
    .single();
  if (error?.code === "23505") {
    const existing = await a.serviceClient
      .from("opportunity_credit_requests")
      .select("delivery_status")
      .eq("user_id", a.user.id)
      .eq("status", "pending")
      .maybeSingle();
    return opportunityJson(
      existing.data?.delivery_status === "sent"
        ? { sent: true, already_requested: true }
        : {
            error:
              "Your request is recorded. Please email hello@abodid.com directly if you need to follow up.",
          },
      existing.data?.delivery_status === "sent" ? 200 : 409,
    );
  }
  if (error || !data)
    return opportunityJson(
      { error: "Your request could not be recorded. Please try again." },
      503,
    );
  try {
    const settings = await a.serviceClient
      .from("reading_digest_settings")
      .select("sender_email")
      .eq("id", true)
      .single();
    const result = await new Resend(key).emails.send(
      {
        from:
          process.env.RESEND_FROM_EMAIL ||
          import.meta.env.RESEND_FROM_EMAIL ||
          `Support team of Abodid & Co. <${settings.data?.sender_email || "hello@abodid.com"}>`,
        to: ["hello@abodid.com"],
        replyTo: a.user.email,
        subject: "Save Opportunity — request for more AI credits",
        text: `To the Support team of Abodid & Co.\n\n${message}\n\nFrom: ${a.user.email}\nUser: ${a.user.id}\nReview: https://abodid.com/admin/opportunities?user=${a.user.id}`,
      },
      { idempotencyKey: `opportunity-credits/${data.id}` },
    );
    if (result.error) throw new Error("Delivery failed");
    await a.serviceClient
      .from("opportunity_credit_requests")
      .update({ delivery_status: "sent" })
      .eq("id", data.id);
    return opportunityJson({ sent: true });
  } catch {
    await a.serviceClient
      .from("opportunity_credit_requests")
      .update({ delivery_status: "failed" })
      .eq("id", data.id);
    return opportunityJson(
      {
        error:
          "Your request is recorded, but email delivery failed. Please email hello@abodid.com directly.",
      },
      503,
    );
  }
};
