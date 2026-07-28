import crypto from "node:crypto";
import type { APIRoute } from "astro";
import {
  authorizeNetworkAdmin,
  networkJson,
  parseRequestJson,
} from "../../../../../../lib/network/api";

export const prerender = false;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ALLOWED_STATES = new Set(["accepted", "rejected", "uncertain"]);
const ALLOWED_CONFIDENCE = new Set(["verified", "probable", "ambiguous", "stale"]);

const cleanText = (value: unknown, maxLength = 1000) => (
  typeof value === "string"
    ? value.replace(/\s+/g, " ").trim().slice(0, maxLength)
    : ""
);

const validPublicUrl = (value: unknown) => {
  const raw = cleanText(value, 2000);
  try {
    const url = new URL(raw);
    return ["http:", "https:"].includes(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
};

export const POST: APIRoute = async ({ request, params }) => {
  const id = params.id || "";
  if (!UUID_PATTERN.test(id)) return networkJson({ error: "Invalid contact id." }, 400);

  const body = await parseRequestJson(request);
  const state = cleanText(body?.state, 20);
  const candidate = body?.candidate;
  const url = validPublicUrl(candidate?.url);
  if (!ALLOWED_STATES.has(state) || !candidate || !url) {
    return networkJson({ error: "A valid evidence result and review state are required." }, 400);
  }

  const authorization = await authorizeNetworkAdmin(request);
  if (authorization.response || !authorization.context) return authorization.response;
  const { supabase, user } = authorization.context;

  const { data: contact, error: loadError } = await supabase
    .from("network_contacts")
    .select("id, public_links, enrichment_sources, personal_website")
    .eq("owner_id", user.id)
    .eq("id", id)
    .single();

  if (loadError || !contact) return networkJson({ error: "Contact not found." }, 404);

  const reviewedAt = new Date().toISOString();
  const confidence = ALLOWED_CONFIDENCE.has(cleanText(candidate.confidence, 20))
    ? cleanText(candidate.confidence, 20)
    : "ambiguous";
  const reviewedEvidence = {
    title: cleanText(candidate.title, 500) || url,
    url,
    excerpt: cleanText(candidate.excerpt, 1200),
    summary: cleanText(candidate.summary, 800),
    keyFacts: Array.isArray(candidate.keyFacts)
      ? candidate.keyFacts.map((item: unknown) => cleanText(item, 240)).filter(Boolean).slice(0, 5)
      : [],
    relevanceReason: cleanText(candidate.relevanceReason, 400),
    identityStrength: ["strong", "possible", "weak"].includes(cleanText(candidate.identityStrength, 20))
      ? cleanText(candidate.identityStrength, 20)
      : null,
    category: [
      "current_role", "portfolio", "recent_work", "recognition", "press", "other",
    ].includes(cleanText(candidate.category, 30))
      ? cleanText(candidate.category, 30)
      : "other",
    relevanceScore: Math.max(
      0,
      Math.min(100, Math.round(Number(candidate.relevanceScore) || 0)),
    ),
    sourceType: cleanText(candidate.sourceType, 80) || "public web",
    sourceDomain: cleanText(candidate.sourceDomain, 255),
    apparentDate: cleanText(candidate.apparentDate, 80) || null,
    discoveredAt: cleanText(candidate.discoveredAt, 80) || reviewedAt,
    identitySignals: Array.isArray(candidate.identitySignals)
      ? candidate.identitySignals.map((item: unknown) => cleanText(item, 80)).filter(Boolean).slice(0, 10)
      : [],
    confidence,
    state,
    reviewedAt,
    fingerprint: crypto.createHash("sha256").update(url.toLowerCase()).digest("hex"),
  };

  const publicLinks = (Array.isArray(contact.public_links) ? contact.public_links : [])
    .filter((item: any) => item?.url !== url);
  const enrichmentSources = (Array.isArray(contact.enrichment_sources) ? contact.enrichment_sources : [])
    .filter((item: any) => !(item?.url === url && item?.state === state));

  const updates: Record<string, unknown> = {
    enrichment_sources: [...enrichmentSources, reviewedEvidence].slice(-200),
    enrichment_status: state === "accepted" ? "enriched" : "review",
  };

  if (state === "accepted") {
    updates.public_links = [...publicLinks, reviewedEvidence].slice(-100);
    updates.last_verified_at = reviewedAt;
    updates.verification_state = confidence === "verified" ? "verified" : "probable";
    if (
      !contact.personal_website
      && ["portfolio", "public web"].includes(reviewedEvidence.sourceType)
      && !reviewedEvidence.sourceDomain.includes("linkedin.com")
    ) {
      updates.personal_website = url;
    }
  }

  const { error: updateError } = await supabase
    .from("network_contacts")
    .update(updates)
    .eq("owner_id", user.id)
    .eq("id", id);

  if (updateError) {
    console.error("[network] Evidence review failed:", updateError.message);
    return networkJson({ error: "Could not save the evidence review." }, 500);
  }

  return networkJson({ evidence: reviewedEvidence });
};
