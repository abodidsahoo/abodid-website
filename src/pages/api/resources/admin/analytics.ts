export const prerender = false;

import type { APIRoute } from "astro";
import { authorizeAdminRequest, jsonResponse } from "../../../../lib/admin/serverAuth";
import {
  getRecentActivity,
  getSystemStats,
  getTopBookmarkedResources,
  getTopUpvotedResources,
} from "../../../../lib/resources/analytics";

export const GET: APIRoute = async ({ request }) => {
  const authorization = await authorizeAdminRequest(request);
  if (!authorization.ok) return authorization.response;

  try {
    const [stats, topBookmarked, topUpvoted, activity] = await Promise.all([
      getSystemStats(),
      getTopBookmarkedResources(),
      getTopUpvotedResources(),
      getRecentActivity(),
    ]);
    return jsonResponse({ stats, topBookmarked, topUpvoted, activity });
  } catch (error) {
    console.error("Curation analytics failed:", error);
    return jsonResponse({ error: "Unable to load curation analytics." }, 500);
  }
};
