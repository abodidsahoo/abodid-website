export const prerender = false;

import type { APIRoute } from "astro";
import { authorizeAdminRequest, jsonResponse } from "../../../../lib/admin/serverAuth";
import { getAllUsers } from "../../../../lib/resources/admin";

export const GET: APIRoute = async ({ request }) => {
  const authorization = await authorizeAdminRequest(request);
  if (!authorization.ok) return authorization.response;

  const result = await getAllUsers();
  if (result.error) return jsonResponse({ error: result.error }, 500);
  return jsonResponse({ users: result.users });
};
