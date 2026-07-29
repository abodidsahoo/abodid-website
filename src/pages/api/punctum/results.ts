import type { APIRoute } from "astro";
import {
  getPunctumImageBySlug,
  punctumImages,
} from "../../../data/punctumImages";
import type { PublicPunctumPolygon } from "../../../lib/punctum/demo";
import {
  cleanText,
  getPunctumDatabase,
  jsonResponse,
  PUNCTUM_MINIMUM_COHORT,
  validAgeBands,
  validGenders,
} from "../../../lib/punctum/server";
import {
  PUNCTUM_GENERATION_PUBLIC_SELECT,
  serializePunctumGeneration,
  type PunctumGenerationRow,
} from "../../../lib/punctum/worlds/records";

export const prerender = false;

type ResultRow = {
  id: string;
  polygon_vertices: Array<{ x: number; y: number }>;
  centroid_x: number;
  centroid_y: number;
  normalized_area: number;
  drawing_type: string;
  created_at: string;
  image_id: string;
  punctum_annotations:
    | {
        text: string;
        moderation_status: string;
      }
    | Array<{
        text: string;
        moderation_status: string;
      }>
    | null;
  punctum_sessions:
    | {
        age_band: string | null;
        gender: string | null;
        country_code: string | null;
      }
    | Array<{
        age_band: string | null;
        gender: string | null;
        country_code: string | null;
      }>;
};

const getSession = (row: ResultRow) =>
  Array.isArray(row.punctum_sessions)
    ? row.punctum_sessions[0]
    : row.punctum_sessions;

const getAnnotation = (row: ResultRow) =>
  Array.isArray(row.punctum_annotations)
    ? row.punctum_annotations[0]
    : row.punctum_annotations;

const safeFilter = (url: URL) => {
  const age = cleanText(url.searchParams.get("age"), 30);
  const gender = cleanText(url.searchParams.get("gender"), 30);
  const country = cleanText(url.searchParams.get("country"), 24).toUpperCase();
  return {
    age: validAgeBands.has(age) ? age : "",
    gender: validGenders.has(gender) ? gender : "",
    country: /^[A-Z]{2}$/.test(country) ? country : "",
  };
};

const countValues = (rows: ResultRow[], key: "age_band" | "gender" | "country_code") => {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const value = getSession(row)?.[key];
    if (!value || value === "prefer_not" || value === "PREFER_NOT") continue;
    counts.set(value, (counts.get(value) || 0) + 1);
  }
  return [...counts]
    .filter(([, count]) => count >= PUNCTUM_MINIMUM_COHORT)
    .map(([value, count]) => ({ value, count }))
    .sort((first, second) => second.count - first.count);
};

export const GET: APIRoute = async ({ request }) => {
  const database = getPunctumDatabase();
  if (!database) {
    return jsonResponse({ error: "The research database is unavailable." }, 503);
  }

  const url = new URL(request.url);
  const requestedSlug = cleanText(url.searchParams.get("image"), 120);
  const requestedImage = requestedSlug
    ? getPunctumImageBySlug(requestedSlug)
    : null;
  if (requestedSlug && !requestedImage) {
    return jsonResponse({ error: "Image not found." }, 404);
  }

  let query = database
    .from("punctum_responses")
    .select(
      "id, polygon_vertices, centroid_x, centroid_y, normalized_area, drawing_type, created_at, image_id, punctum_annotations(text, moderation_status), punctum_sessions!inner(age_band, gender, country_code)",
    )
    .eq("public_visible", true)
    .eq("is_valid", true)
    .order("created_at", { ascending: true })
    .limit(3000);
  if (requestedImage) query = query.eq("image_id", requestedImage.id);

  const { data, error } = await query;
  if (error) {
    console.error("Punctum public results query failed:", error.message);
    return jsonResponse({ error: "Results are unavailable right now." }, 500);
  }

  const allRows = (data || []) as unknown as ResultRow[];
  if (!requestedImage) {
    const counts = new Map<string, number>();
    for (const row of allRows) {
      counts.set(row.image_id, (counts.get(row.image_id) || 0) + 1);
    }
    return jsonResponse(
      {
        images: punctumImages.map((image) => ({
          ...image,
          responseCount: counts.get(image.id) || 0,
        })),
        responseCount: allRows.length,
      },
      200,
      {
        "Cache-Control": "public, max-age=30, stale-while-revalidate=120",
      },
    );
  }

  const filters = safeFilter(url);
  const filteredRows = allRows.filter((row) => {
    const session = getSession(row);
    if (filters.age && session?.age_band !== filters.age) return false;
    if (filters.gender && session?.gender !== filters.gender) return false;
    if (filters.country && session?.country_code !== filters.country) return false;
    return true;
  });
  const isFiltered = Boolean(filters.age || filters.gender || filters.country);
  const suppressed =
    isFiltered && filteredRows.length < PUNCTUM_MINIMUM_COHORT;
  const publicRows = suppressed ? [] : filteredRows;
  const generationRows = new Map<string, PunctumGenerationRow[]>();
  if (publicRows.length) {
    const { data: generations, error: generationError } = await database
      .from("punctum_generations")
      .select(PUNCTUM_GENERATION_PUBLIC_SELECT)
      .in(
        "source_response_id",
        publicRows.slice(0, 18).map((row) => row.id),
      )
      .eq("status", "completed")
      .order("created_at", { ascending: true })
      .limit(300);
    if (!generationError) {
      for (const generation of (generations || []) as PunctumGenerationRow[]) {
        const existing = generationRows.get(generation.source_response_id) || [];
        existing.push(generation);
        generationRows.set(generation.source_response_id, existing);
      }
    } else if (generationError.code !== "42P01") {
      console.warn(
        "Punctum generation results query failed:",
        generationError.message,
      );
    }
  }
  const polygons: PublicPunctumPolygon[] = publicRows.map((row) => {
    const annotation = getAnnotation(row);
    const annotationIsVisible =
      annotation &&
      annotation.moderation_status !== "hidden" &&
      annotation.moderation_status !== "rejected";

    return {
      id: row.id,
      vertices: row.polygon_vertices,
      centroidX: Number(row.centroid_x),
      centroidY: Number(row.centroid_y),
      normalizedArea: Number(row.normalized_area),
      drawingType: row.drawing_type,
      createdAt: row.created_at,
      annotation: annotationIsVisible
        ? cleanText(annotation.text, 600) || undefined
        : undefined,
      generations: (generationRows.get(row.id) || []).map(
        serializePunctumGeneration,
      ),
    };
  });

  return jsonResponse(
    {
      image: requestedImage,
      polygons,
      responseCount: filteredRows.length,
      totalResponseCount: allRows.length,
      suppressed,
      minimumCohortSize: PUNCTUM_MINIMUM_COHORT,
      filters,
      availableFilters: {
        age: countValues(allRows, "age_band"),
        gender: countValues(allRows, "gender"),
        country: countValues(allRows, "country_code"),
      },
    },
    200,
    {
      "Cache-Control": "public, max-age=30, stale-while-revalidate=120",
    },
  );
};
