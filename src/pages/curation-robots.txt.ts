import type { APIRoute } from "astro";
import { CURATION_ORIGIN } from "../lib/curationRoutes.js";

export const prerender = false;

export const GET: APIRoute = () =>
  new Response(
    [
      "User-agent: *",
      "Allow: /",
      "Disallow: /admin",
      "Disallow: /auth",
      "Disallow: /dashboard",
      "Disallow: /saved",
      "Disallow: /api/",
      `Sitemap: ${CURATION_ORIGIN}/sitemap.xml`,
      "",
    ].join("\n"),
    {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "public, max-age=300, s-maxage=3600",
      },
    },
  );
