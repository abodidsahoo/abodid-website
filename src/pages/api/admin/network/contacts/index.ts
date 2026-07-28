import type { APIRoute } from "astro";
import {
  authorizeNetworkAdmin,
  filtersToRpcArgs,
  networkJson,
  normalizeNetworkFilters,
  parseRequestJson,
  safeInteger,
} from "../../../../../lib/network/api";
import {
  createNetworkEmbedding,
  interpretNetworkQuery,
} from "../../../../../lib/network/openrouter.js";

export const prerender = false;

const ALLOWED_SORTS = new Set([
  "relevance",
  "connected_desc",
  "connected_asc",
  "name_asc",
  "name_desc",
  "company_asc",
]);

const compactObject = (value: Record<string, unknown>) =>
  Object.fromEntries(
    Object.entries(value).filter(([, item]) => (
      item !== null
      && item !== undefined
      && item !== ""
      && (!Array.isArray(item) || item.length > 0)
    )),
  );

const runSearch = async ({
  request,
  query,
  filtersValue,
  pageValue,
  pageSizeValue,
  sortValue,
  smart,
}: {
  request: Request;
  query: unknown;
  filtersValue: unknown;
  pageValue: unknown;
  pageSizeValue: unknown;
  sortValue: unknown;
  smart: boolean;
}) => {
  const authorization = await authorizeNetworkAdmin(request);
  if (authorization.response || !authorization.context) return authorization.response;
  const { supabase, user } = authorization.context;

  const searchQuery = typeof query === "string"
    ? query.replace(/\s+/g, " ").trim().slice(0, 1000)
    : "";
  const page = safeInteger(pageValue, 1, 1, 100000);
  const pageSize = safeInteger(pageSizeValue, 100, 25, 200);
  const sort = ALLOWED_SORTS.has(String(sortValue)) ? String(sortValue) : "relevance";
  const explicitFilters = normalizeNetworkFilters(filtersValue);

  let interpretation = null;
  let queryEmbedding = null;
  let effectiveFilters = explicitFilters;
  let embeddingWarning = null;

  if (smart && searchQuery) {
    interpretation = await interpretNetworkQuery(searchQuery);
    const suggestedFilters = normalizeNetworkFilters(interpretation.suggestedFilters);
    effectiveFilters = normalizeNetworkFilters({
      ...compactObject(suggestedFilters),
      ...compactObject(explicitFilters),
    });

    try {
      queryEmbedding = await createNetworkEmbedding(
        interpretation.semanticConcept || searchQuery,
      );
    } catch (error) {
      embeddingWarning = error instanceof Error
        ? error.message
        : "Semantic embedding is unavailable.";
    }
  }

  const { data, error } = await supabase.rpc("search_network_contacts", {
    p_owner_id: user.id,
    p_query: searchQuery || null,
    p_query_embedding: queryEmbedding,
    ...filtersToRpcArgs(effectiveFilters),
    p_sort: sort,
    p_offset: (page - 1) * pageSize,
    p_limit: pageSize,
  });

  if (error) {
    console.error("[network] Contact search failed:", error.message);
    const setupMissing = /search_network_contacts|network_contacts/i.test(error.message);
    return networkJson({
      error: setupMissing
        ? "Network Intelligence has not been provisioned in Supabase yet."
        : "Could not search network contacts.",
      setupRequired: setupMissing,
    }, setupMissing ? 503 : 500);
  }

  const rows = Array.isArray(data) ? data : [];
  const contacts = rows.map((row: any) => ({
    ...(row.contact || {}),
    relevance_score: row.relevance_score,
    match_reason: row.match_reason,
  }));
  const total = Number(rows[0]?.total_count || 0);

  return networkJson({
    contacts,
    page,
    pageSize,
    total,
    hasMore: page * pageSize < total,
    smart,
    interpretation: interpretation
      ? {
          semanticConcept: interpretation.semanticConcept,
          suggestedFilters: interpretation.suggestedFilters,
          model: interpretation.model,
          warning: interpretation.warning || embeddingWarning || null,
        }
      : null,
  });
};

export const GET: APIRoute = async ({ request, url }) => {
  let filters = {};
  try {
    filters = JSON.parse(url.searchParams.get("filters") || "{}");
  } catch {
    return networkJson({ error: "Filters must be valid JSON." }, 400);
  }

  return runSearch({
    request,
    query: url.searchParams.get("query"),
    filtersValue: filters,
    pageValue: url.searchParams.get("page"),
    pageSizeValue: url.searchParams.get("pageSize"),
    sortValue: url.searchParams.get("sort"),
    smart: false,
  });
};

export const POST: APIRoute = async ({ request }) => {
  const body = await parseRequestJson(request);
  if (!body || typeof body !== "object") {
    return networkJson({ error: "A JSON search request is required." }, 400);
  }

  return runSearch({
    request,
    query: body.query,
    filtersValue: body.filters,
    pageValue: body.page,
    pageSizeValue: body.pageSize,
    sortValue: body.sort,
    smart: body.smart !== false,
  });
};
