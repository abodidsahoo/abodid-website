import type { SupabaseClient, User } from "@supabase/supabase-js";
import { authorizeAdminRequest, jsonResponse } from "../admin/serverAuth";

export type NetworkAdminContext = {
  supabase: SupabaseClient;
  user: User;
};

export const authorizeNetworkAdmin = async (
  request: Request,
): Promise<{ context?: NetworkAdminContext; response?: Response }> => {
  const authorization = await authorizeAdminRequest(request);
  if (!authorization.ok) return { response: authorization.response };
  return {
    context: {
      supabase: authorization.supabase,
      user: authorization.user,
    },
  };
};

export const networkJson = jsonResponse;

const cleanText = (value: unknown, maxLength = 180) => {
  if (typeof value !== "string") return null;
  const result = value.replace(/\s+/g, " ").trim();
  return result ? result.slice(0, maxLength) : null;
};

const cleanBoolean = (value: unknown) => (
  typeof value === "boolean" ? value : null
);

const cleanArray = (value: unknown) => {
  if (!Array.isArray(value)) return null;
  const result = [...new Set(
    value
      .filter((item): item is string => typeof item === "string")
      .map((item) => cleanText(item, 120))
      .filter((item): item is string => Boolean(item)),
  )].slice(0, 20);
  return result.length ? result : null;
};

const cleanDate = (value: unknown) => {
  const text = cleanText(value, 10);
  return text && /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
};

export const normalizeNetworkFilters = (value: unknown) => {
  const source = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};

  return {
    hasEmail: cleanBoolean(source.hasEmail),
    emailType: cleanText(source.emailType),
    country: cleanText(source.country),
    region: cleanText(source.region),
    city: cleanText(source.city),
    company: cleanText(source.company),
    workCategories: cleanArray(source.workCategories),
    expertiseKeywords: cleanArray(source.expertiseKeywords),
    outreachGoals: cleanArray(source.outreachGoals),
    relationshipTier: cleanText(source.relationshipTier),
    tags: cleanArray(source.tags),
    verificationState: cleanText(source.verificationState),
    enrichmentStatus: cleanText(source.enrichmentStatus),
    newsletterStatus: cleanText(source.newsletterStatus),
    doNotContact: cleanBoolean(source.doNotContact),
    connectedFrom: cleanDate(source.connectedFrom),
    connectedTo: cleanDate(source.connectedTo),
    includeArchived: source.includeArchived === true,
  };
};

export const filtersToRpcArgs = (filters: ReturnType<typeof normalizeNetworkFilters>) => ({
  p_has_email: filters.hasEmail,
  p_email_type: filters.emailType,
  p_country: filters.country,
  p_region: filters.region,
  p_city: filters.city,
  p_company: filters.company,
  p_work_categories: filters.workCategories,
  p_expertise_keywords: filters.expertiseKeywords,
  p_outreach_goals: filters.outreachGoals,
  p_relationship_tier: filters.relationshipTier,
  p_tags: filters.tags,
  p_verification_state: filters.verificationState,
  p_enrichment_status: filters.enrichmentStatus,
  p_newsletter_status: filters.newsletterStatus,
  p_do_not_contact: filters.doNotContact,
  p_connected_from: filters.connectedFrom,
  p_connected_to: filters.connectedTo,
  p_include_archived: filters.includeArchived,
});

export const parseRequestJson = async (request: Request) => {
  try {
    return await request.json();
  } catch {
    return null;
  }
};

export const safeInteger = (
  value: unknown,
  fallback: number,
  minimum: number,
  maximum: number,
) => {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed)
    ? Math.min(maximum, Math.max(minimum, parsed))
    : fallback;
};
