import type { APIRoute } from "astro";
import { getPublicReadingFeed } from "../../../lib/reading/publicFeed";

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  const tag = url.searchParams.get("tag")?.trim() || null;
  const beforeDate = url.searchParams.get("before")?.trim() || null;
  if ((tag && tag.length > 100) || (beforeDate && beforeDate.length > 10)) {
    return Response.json({ error: "Invalid reading filter." }, { status: 400 });
  }

  try {
    const feed = await getPublicReadingFeed({
      topic: tag,
      beforeDate,
      includeTopics: !beforeDate,
    });
    return Response.json(feed, {
      headers: {
        "Cache-Control": "public, max-age=0, s-maxage=45",
        "Vercel-CDN-Cache-Control": "s-maxage=45",
      },
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Could not load readings." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
};
