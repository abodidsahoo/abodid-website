import type { APIRoute } from "astro";
import { createSupabaseServiceClient } from "../../../lib/supabaseServer";
import { demoArtists, validProfile } from "../../../lib/artist-globe/data";
export const prerender = false;
export const GET: APIRoute = async () => {
  let artists = demoArtists;
  const preview = import.meta.env.DEV;
  let mode = "demo";
  try {
    const client = createSupabaseServiceClient();
    if (client) {
      let query = client
        .from("art_globe_artists")
        .select(
          "id,artist_number,name,origin,current_city,country,latitude,longitude,disciplines,tags,biography,artist_statement,portfolio_url,instagram_url,public_email,artwork_urls,sources,is_demo,map_pin_ready,verification_status",
        );
      query = preview
        ? query.or("published.eq.true,id.like.atlas-csv-*")
        : query.eq("published", true);
      const { data, error } = await query
        .order("name")
        .limit(1000)
        .abortSignal(AbortSignal.timeout(4000));
      if (!error && data?.length) {
        artists = data.filter(validProfile);
        if (preview && artists.some((a) => a.id.startsWith("atlas-csv-")))
          artists = artists.filter((a) => !a.is_demo);
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
  if (preview && artists.every((a) => a.is_demo)) {
    const snapshot = (
      await import("../../../data/artist-globe/research-candidates.json")
    ).default;
    artists = snapshot.filter(validProfile);
    mode = "research-preview";
  }
  if (preview) {
    const { placeArtistsOnMap } =
      await import("../../../lib/artist-globe/map-placement");
    artists = placeArtistsOnMap(artists);
  }
  return Response.json(
    {
      artists,
      mode:
        preview && artists.some((a) => a.id.startsWith("atlas-csv-"))
          ? "research-preview"
          : mode,
    },
    {
      headers: {
        "Cache-Control": preview
          ? "no-store"
          : "public, s-maxage=60, stale-while-revalidate=300",
      },
    },
  );
};
