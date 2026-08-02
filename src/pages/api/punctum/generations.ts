import type { APIRoute } from "astro";
import { getPunctumImageById } from "../../../data/punctumImages";
import {
  validatePolygonVertices,
  type NormalizedPoint,
} from "../../../lib/punctum/geometry";
import {
  cleanText,
  getPunctumDatabase,
  isUuid,
  jsonResponse,
} from "../../../lib/punctum/server";
import { processPunctumRegion } from "../../../lib/punctum/worlds/geometry";
import {
  buildPunctumGenerationPrompt,
  getPunctumImageProvider,
  type PunctumImageProvider,
} from "../../../lib/punctum/worlds/provider";
import { getPunctumImageModelOption } from "../../../lib/punctum/worlds/model-options";
import { getPublicPunctumGenerationFailure } from "../../../lib/punctum/worlds/errors";
import {
  PUNCTUM_GENERATION_PUBLIC_SELECT,
  serializePunctumGeneration,
  type PunctumGenerationRow,
} from "../../../lib/punctum/worlds/records";
import {
  createGenerationSeed,
  getPunctumGenerationQuota,
  hashGenerationAccessToken,
  isGenerationAccessToken,
  PUNCTUM_ORIGINAL_PROMPT,
  storeGeneratedWorld,
  storePunctumArtifacts,
  type PunctumGenerationSource,
} from "../../../lib/punctum/worlds/server";

export const prerender = false;
export const maxDuration = 300;

const ANSWERS = new Set([
  "yes",
  "no",
  "still",
  "moved",
  "disappeared",
  "unsure",
]);
const ANSWER_EXPLANATIONS: Record<string, string> = {
  yes: "The punctum still feels the same in the generated world.",
  no: "The punctum feels different in the generated world.",
  still: "The original fragment still feels like the punctum in the generated world.",
  moved: "Attention moved to a different part of the generated world.",
  disappeared: "The punctum disappeared when the original context was replaced.",
  unsure: "The viewer is unsure where the punctum sits in the generated world.",
};

type PrivateGenerationRow = PunctumGenerationRow & {
  access_token_hash: string;
};

const fetchImageBuffer = async (sourceUrl: string) => {
  const response = await fetch(sourceUrl, {
    signal: AbortSignal.timeout(30_000),
    headers: { Accept: "image/*" },
  });
  if (!response.ok) throw new Error("The source image could not be retrieved.");
  const contentLength = Number(response.headers.get("content-length") || 0);
  if (contentLength > 30 * 1024 * 1024) {
    throw new Error("The source image is too large to process.");
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  if (!buffer.length || buffer.length > 30 * 1024 * 1024) {
    throw new Error("The source image is empty or too large.");
  }
  return buffer;
};

const resolveInitialSource = async (
  database: NonNullable<ReturnType<typeof getPunctumDatabase>>,
  responseId: string,
): Promise<PunctumGenerationSource> => {
  const { data: response, error } = await database
    .from("punctum_responses")
    .select("id, image_id, polygon_vertices, public_visible, is_valid")
    .eq("id", responseId)
    .eq("public_visible", true)
    .eq("is_valid", true)
    .maybeSingle();
  if (error || !response) {
    throw new Error("The original response is not available.");
  }
  const image = getPunctumImageById(response.image_id);
  if (!image || !validatePolygonVertices(response.polygon_vertices)) {
    throw new Error("The source punctum is not valid.");
  }
  const { data: annotation } = await database
    .from("punctum_annotations")
    .select("text, moderation_status")
    .eq("response_id", response.id)
    .maybeSingle();
  const annotationVisible =
    annotation &&
    annotation.moderation_status !== "hidden" &&
    annotation.moderation_status !== "rejected";

  return {
    sourceResponseId: response.id,
    parentGenerationId: null,
    sourceImageId: image.id,
    sourceImageUrl: image.url,
    polygon: response.polygon_vertices as NormalizedPoint[],
    viewerExplanation: annotationVisible
      ? cleanText(annotation.text, 600)
      : "No written explanation was provided; preserve what the selected pixels reveal.",
    sourcePrompt: PUNCTUM_ORIGINAL_PROMPT,
    width: image.width,
    height: image.height,
  };
};

const resolveParentSource = async (
  database: NonNullable<ReturnType<typeof getPunctumDatabase>>,
  parentGenerationId: string,
  parentAccessToken: string,
): Promise<PunctumGenerationSource> => {
  const { data, error } = await database
    .from("punctum_generations")
    .select(
      `${PUNCTUM_GENERATION_PUBLIC_SELECT}, access_token_hash, generated_image_path`,
    )
    .eq("id", parentGenerationId)
    .eq("status", "completed")
    .maybeSingle();
  const parent = data as PrivateGenerationRow | null;
  if (error || !parent || !parent.generated_image_url) {
    throw new Error("The previous generated world is not available.");
  }
  if (
    parent.access_token_hash !== hashGenerationAccessToken(parentAccessToken)
  ) {
    throw new Error("This generation can only be continued in its original session.");
  }
  if (!validatePolygonVertices(parent.post_generation_polygon)) {
    throw new Error("Draw a new punctum before generating another world.");
  }
  const answer = parent.post_generation_answer || "unsure";

  return {
    sourceResponseId: parent.source_response_id,
    parentGenerationId: parent.id,
    sourceImageId: parent.source_image_id,
    sourceImageUrl: parent.generated_image_url,
    polygon: parent.post_generation_polygon as NormalizedPoint[],
    viewerExplanation:
      cleanText(parent.post_generation_explanation, 600) ||
      ANSWER_EXPLANATIONS[answer] ||
      ANSWER_EXPLANATIONS.unsure,
    sourcePrompt:
      "Is your punctum still the same?",
    width: parent.source_width,
    height: parent.source_height,
  };
};

const resolveSource = async (
  database: NonNullable<ReturnType<typeof getPunctumDatabase>>,
  payload: Record<string, unknown>,
) => {
  const responseId = isUuid(payload.responseId) ? payload.responseId : "";
  const parentGenerationId = isUuid(payload.parentGenerationId)
    ? payload.parentGenerationId
    : "";
  if (Boolean(responseId) === Boolean(parentGenerationId)) {
    throw new Error("Choose one response or previous generation.");
  }
  if (responseId) return resolveInitialSource(database, responseId);
  if (!isGenerationAccessToken(payload.parentAccessToken)) {
    throw new Error("The previous generation session is unavailable.");
  }
  return resolveParentSource(
    database,
    parentGenerationId,
    payload.parentAccessToken,
  );
};

const getPublicGeneration = async (
  database: NonNullable<ReturnType<typeof getPunctumDatabase>>,
  generationId: string,
) => {
  const { data, error } = await database
    .from("punctum_generations")
    .select(PUNCTUM_GENERATION_PUBLIC_SELECT)
    .eq("id", generationId)
    .maybeSingle();
  if (error || !data) return null;
  return data as PunctumGenerationRow;
};

export const GET: APIRoute = async ({ request }) => {
  const database = getPunctumDatabase();
  if (!database) {
    return jsonResponse({ error: "The research database is unavailable." }, 503);
  }
  const generationId = new URL(request.url).searchParams.get("id");
  if (!isUuid(generationId)) {
    return jsonResponse({ error: "Invalid generation." }, 400);
  }
  const selected = await getPublicGeneration(database, generationId);
  if (!selected) return jsonResponse({ error: "Generation not found." }, 404);

  const { data: family } = await database
    .from("punctum_generations")
    .select(PUNCTUM_GENERATION_PUBLIC_SELECT)
    .eq("source_response_id", selected.source_response_id)
    .eq("status", "completed")
    .order("created_at", { ascending: true })
    .limit(100);
  const byId = new Map(
    ((family || []) as PunctumGenerationRow[]).map((row) => [row.id, row]),
  );
  const lineage: PunctumGenerationRow[] = [];
  let current: PunctumGenerationRow | undefined = selected;
  while (current) {
    lineage.unshift(current);
    current = current.parent_generation_id
      ? byId.get(current.parent_generation_id)
      : undefined;
  }

  return jsonResponse({
    generation: serializePunctumGeneration(selected),
    lineage: lineage.map(serializePunctumGeneration),
  });
};

export const PATCH: APIRoute = async ({ request }) => {
  let payload: Record<string, unknown>;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid request." }, 400);
  }
  if (
    !isUuid(payload.generationId) ||
    !isGenerationAccessToken(payload.accessToken)
  ) {
    return jsonResponse({ error: "Invalid generation." }, 400);
  }
  const answer = cleanText(payload.answer, 24);
  if (!ANSWERS.has(answer)) {
    return jsonResponse({ error: "Choose yes or no." }, 400);
  }
  const polygon =
    payload.polygon === null || payload.polygon === undefined
      ? null
      : payload.polygon;
  if (polygon && !validatePolygonVertices(polygon)) {
    return jsonResponse({ error: "The new punctum is not a valid polygon." }, 400);
  }
  const database = getPunctumDatabase();
  if (!database) {
    return jsonResponse({ error: "The research database is unavailable." }, 503);
  }
  const { data: existing } = await database
    .from("punctum_generations")
    .select("id, access_token_hash")
    .eq("id", payload.generationId)
    .maybeSingle();
  if (
    !existing ||
    existing.access_token_hash !== hashGenerationAccessToken(payload.accessToken)
  ) {
    return jsonResponse({ error: "This generation session is unavailable." }, 403);
  }
  const { data, error } = await database
    .from("punctum_generations")
    .update({
      post_generation_answer: answer,
      post_generation_polygon: polygon,
      post_generation_explanation:
        cleanText(payload.explanation, 600) || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", existing.id)
    .select(PUNCTUM_GENERATION_PUBLIC_SELECT)
    .single();
  if (error || !data) {
    return jsonResponse(
      { error: "Your reflection could not be saved. Please try again." },
      500,
    );
  }
  return jsonResponse({ generation: serializePunctumGeneration(data) });
};

export const POST: APIRoute = async ({ request }) => {
  let payload: Record<string, unknown>;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid request." }, 400);
  }
  if (
    !isUuid(payload.requestId) ||
    !isGenerationAccessToken(payload.accessToken) ||
    !isGenerationAccessToken(payload.generationSessionId)
  ) {
    return jsonResponse({ error: "Invalid generation request." }, 400);
  }
  const requestedModelId = cleanText(payload.modelId, 100);
  if (requestedModelId && !getPunctumImageModelOption(requestedModelId)) {
    return jsonResponse({ error: "Choose an available image model." }, 400);
  }
  const database = getPunctumDatabase();
  if (!database) {
    return jsonResponse({ error: "The research database is unavailable." }, 503);
  }

  const accessTokenHash = hashGenerationAccessToken(payload.accessToken);
  const generationSessionHash = hashGenerationAccessToken(
    payload.generationSessionId,
  );
  const { data: duplicate } = await database
    .from("punctum_generations")
    .select(`${PUNCTUM_GENERATION_PUBLIC_SELECT}, access_token_hash`)
    .eq("idempotency_key", payload.requestId)
    .maybeSingle();
  if (duplicate) {
    if (duplicate.access_token_hash !== accessTokenHash) {
      return jsonResponse({ error: "This request ID is already in use." }, 409);
    }
    return jsonResponse({
      type: duplicate.status,
      generation: serializePunctumGeneration(duplicate),
    });
  }

  let source: PunctumGenerationSource;
  try {
    source = await resolveSource(database, payload);
  } catch (error) {
    return jsonResponse(
      {
        error:
          error instanceof Error ? error.message : "The source is not available.",
      },
      400,
    );
  }
  let quota;
  try {
    quota = await getPunctumGenerationQuota({
      database,
      sessionKeyHash: generationSessionHash,
    });
  } catch (error) {
    console.error("Punctum generation quota check failed:", error);
    return jsonResponse(
      { error: "The generation service is temporarily unavailable." },
      503,
    );
  }
  if (quota.inProgress) {
    return jsonResponse(
      {
        error:
          "An AI world is already being generated in this browser session. Let it finish before starting another.",
        code: "generation_in_progress",
        retryAfter: 10,
        limit: quota.limit,
        used: quota.used,
      },
      409,
      { "Retry-After": "10" },
    );
  }
  if (!quota.allowed) {
    return jsonResponse(
      {
        error: `You have used ${quota.used} of ${quota.limit} AI-world generations available in this session this hour.`,
        code: "generation_rate_limit",
        retryAfter: quota.retryAfter,
        limit: quota.limit,
        used: quota.used,
      },
      429,
      { "Retry-After": String(quota.retryAfter) },
    );
  }
  let provider: PunctumImageProvider;
  try {
    provider = getPunctumImageProvider(requestedModelId);
  } catch (error) {
    return jsonResponse(
      {
        error:
          error instanceof Error
            ? error.message
            : "The selected image model is unavailable.",
      },
      503,
    );
  }
  const seed = createGenerationSeed();
  const { data: inserted, error: insertError } = await database
    .from("punctum_generations")
    .insert({
      idempotency_key: payload.requestId,
      access_token_hash: accessTokenHash,
      generation_session_hash: generationSessionHash,
      source_response_id: source.sourceResponseId,
      parent_generation_id: source.parentGenerationId,
      source_image_id: source.sourceImageId,
      source_image_url: source.sourceImageUrl,
      source_polygon_normalized: source.polygon,
      source_width: source.width,
      source_height: source.height,
      viewer_explanation: source.viewerExplanation,
      source_prompt: source.sourcePrompt,
      model: provider.model,
      provider: provider.id,
      seed,
      status: "pending",
    })
    .select(PUNCTUM_GENERATION_PUBLIC_SELECT)
    .single();
  if (insertError || !inserted) {
    if (insertError?.code === "23505") {
      const { data: racedDuplicate } = await database
        .from("punctum_generations")
        .select(`${PUNCTUM_GENERATION_PUBLIC_SELECT}, access_token_hash`)
        .eq("idempotency_key", payload.requestId)
        .maybeSingle();
      if (racedDuplicate?.access_token_hash === accessTokenHash) {
        return jsonResponse({
          type: racedDuplicate.status,
          generation: serializePunctumGeneration(racedDuplicate),
        });
      }
    }
    const uniqueConflict = `${insertError?.message || ""} ${
      insertError?.details || ""
    }`;
    if (
      insertError?.code === "23505" &&
      uniqueConflict.includes(
        "punctum_generations_one_active_per_session_idx",
      )
    ) {
      return jsonResponse(
        {
          error:
            "An AI world is already being generated in this browser session. Let it finish before starting another.",
          code: "generation_in_progress",
          retryAfter: 10,
          limit: quota.limit,
          used: quota.used,
        },
        409,
        { "Retry-After": "10" },
      );
    }
    console.error("Punctum generation insert failed:", insertError?.message);
    return jsonResponse({ error: "The generation could not be started." }, 500);
  }
  const generationId = inserted.id;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let open = true;
      const emit = (event: Record<string, unknown>) => {
        if (!open) return;
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        } catch {
          open = false;
        }
      };
      try {
        emit({
          type: "processing",
          generation: serializePunctumGeneration(inserted),
        });
        await database
          .from("punctum_generations")
          .update({
            status: "processing",
            error_message: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", generationId);

        const sourceBuffer = await fetchImageBuffer(source.sourceImageUrl);
        const punctum = await processPunctumRegion({
          source: sourceBuffer,
          polygonNormalized: source.polygon,
        });
        emit({
          type: "palette",
          palette: punctum.analysis.palette,
          visualAnalysis: punctum.analysis,
        });

        const prompt = buildPunctumGenerationPrompt({
          width: punctum.sourceWidth,
          height: punctum.sourceHeight,
          viewerExplanation: source.viewerExplanation,
          originalPrompt: source.sourcePrompt,
          punctum,
        });
        const artifactPaths = await storePunctumArtifacts({
          database,
          generationId,
          punctum,
        });
        await database
          .from("punctum_generations")
          .update({
            source_polygon_pixels: punctum.polygonPixels,
            crop_x: punctum.crop.x,
            crop_y: punctum.crop.y,
            crop_width: punctum.crop.width,
            crop_height: punctum.crop.height,
            source_width: punctum.sourceWidth,
            source_height: punctum.sourceHeight,
            padding: punctum.crop.padding,
            palette: punctum.analysis.palette,
            visual_analysis: punctum.analysis,
            generation_prompt: prompt,
            model: provider.model,
            provider: provider.id,
            masked_fragment_path: artifactPaths.maskedFragmentPath,
            context_crop_path: artifactPaths.contextCropPath,
            mask_path: artifactPaths.maskPath,
            updated_at: new Date().toISOString(),
          })
          .eq("id", generationId);

        const result = await provider.generate({
          width: punctum.sourceWidth,
          height: punctum.sourceHeight,
          prompt,
          seed,
          punctum,
        });
        const stored = await storeGeneratedWorld({
          database,
          sourceResponseId: source.sourceResponseId,
          generationId,
          buffer: result.buffer,
        });
        const completedAt = new Date().toISOString();
        const { data: completed, error: completeError } = await database
          .from("punctum_generations")
          .update({
            generated_image_url: stored.publicUrl,
            generated_image_path: stored.path,
            model: result.model,
            provider: result.provider,
            status: "completed",
            error_message: null,
            completed_at: completedAt,
            updated_at: completedAt,
          })
          .eq("id", generationId)
          .select(PUNCTUM_GENERATION_PUBLIC_SELECT)
          .single();
        if (completeError || !completed) {
          throw new Error("The finished world could not be recorded.");
        }
        emit({
          type: "completed",
          generation: serializePunctumGeneration(completed),
        });
      } catch (error) {
        const publicFailure = getPublicPunctumGenerationFailure(error);
        console.error("Punctum generation failed:", error);
        await database
          .from("punctum_generations")
          .update({
            status: "failed",
            error_message: publicFailure.message,
            updated_at: new Date().toISOString(),
          })
          .eq("id", generationId);
        emit({
          type: "failed",
          error: publicFailure.message,
          code: publicFailure.code,
          generationId,
        });
      } finally {
        if (open) {
          try {
            controller.close();
          } catch {
            // The browser may have left while the server finished the record.
          }
        }
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
};
