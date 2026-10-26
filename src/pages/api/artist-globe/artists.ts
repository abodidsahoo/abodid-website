import type { APIRoute } from "astro";
import { createSupabaseServiceClient } from "../../../lib/supabaseServer";
import { demoArtists, validArtist } from "../../../lib/artist-globe/data";
export const prerender = false;
export const GET: APIRoute = async () => {
  let artists = demoArtists;
  let mode = "demo";
  try {
    const client = createSupabaseServiceClient();
    if (client) {
      const { data, error } = await client
        .from("art_globe_artists")
        .select(
          "id,artist_number,name,origin,current_city,country,latitude,longitude,disciplines,tags,biography,artist_statement,portfolio_url,instagram_url,public_email,artwork_urls,sources,is_demo",
        )
        .eq("published", true)
        .order("name")
        .limit(1000)
        .abortSignal(AbortSignal.timeout(4000));
      if (!error && data?.length) {
        artists = data.filter(validArtist);
        mode = artists.every((a) => a.is_demo) ? "demo" : "live";
      }
      if (!artists.length) {
        artists = demoArtists;
        mode = "demo";
      }
    }
  } catch {
    /* A usable local atlas is always available. */
  }
  return Response.json(
    { artists, mode },
    {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    },
  );
};
