import { createHash, randomInt } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { NormalizedPoint } from "../geometry";
import type { ProcessedPunctum } from "./geometry";

const GENERATION_WINDOW_MS = 60 * 60 * 1000;
const STALE_GENERATION_MS = 10 * 60 * 1000;

const runtimeEnv = (name: string) =>
  String(import.meta.env[name] || process.env[name] || "").trim();

export const PUNCTUM_ORIGINAL_PROMPT =
  "What about this area caught you? Describe what you noticed, remembered, felt, or imagined.";

export const hashGenerationAccessToken = (value: string) =>
  createHash("sha256").update(value).digest("hex");

export const isGenerationAccessToken = (value: unknown): value is string =>
  typeof value === "string" &&
  value.length >= 20 &&
  value.length <= 200 &&
  /^[a-zA-Z0-9._-]+$/.test(value);

export const createGenerationSeed = () => randomInt(1, 2_147_483_647);

export const getPunctumGenerationLimit = () => {
  const configured = import.meta.env.DEV
    ? runtimeEnv("PUNCTUM_GENERATION_DEV_MAX_PER_HOUR") || "16"
    : runtimeEnv("PUNCTUM_GENERATION_MAX_PER_HOUR") || "6";
  const parsed = Number.parseInt(configured, 10);
  return Number.isFinite(parsed) ? Math.max(1, Math.min(50, parsed)) : 6;
};

export const getPunctumGenerationQuota = async ({
  database,
  sessionKeyHash,
  now = Date.now(),
  limit = getPunctumGenerationLimit(),
}: {
  database: SupabaseClient;
  sessionKeyHash: string;
  now?: number;
  limit?: number;
}) => {
  const staleBefore = new Date(now - STALE_GENERATION_MS).toISOString();
  const { error: staleError } = await database
    .from("punctum_generations")
    .update({
      status: "failed",
      error_message: "The generation timed out before it could finish.",
      updated_at: new Date(now).toISOString(),
    })
    .eq("generation_session_hash", sessionKeyHash)
    .in("status", ["pending", "processing"])
    .lt("updated_at", staleBefore);
  if (staleError) {
    throw new Error(`Generation quota could not be checked: ${staleError.message}`);
  }

  const windowStart = new Date(now - GENERATION_WINDOW_MS).toISOString();
  const [recentResult, activeResult] = await Promise.all([
    database
      .from("punctum_generations")
      .select("created_at", { count: "exact" })
      .eq("generation_session_hash", sessionKeyHash)
      .neq("status", "failed")
      .gte("created_at", windowStart)
      .order("created_at", { ascending: true })
      .limit(1),
    database
      .from("punctum_generations")
      .select("id")
      .eq("generation_session_hash", sessionKeyHash)
      .in("status", ["pending", "processing"])
      .limit(1),
  ]);
  if (recentResult.error || activeResult.error) {
    const message = recentResult.error?.message || activeResult.error?.message;
    throw new Error(`Generation quota could not be checked: ${message}`);
  }

  const used = recentResult.count || 0;
  const oldestCreatedAt = recentResult.data?.[0]?.created_at;
  const retryAfter =
    used >= limit && oldestCreatedAt
      ? Math.max(
          1,
          Math.ceil(
            (new Date(oldestCreatedAt).getTime() +
              GENERATION_WINDOW_MS -
              now) /
              1000,
          ),
        )
      : 0;

  return {
    allowed: used < limit && activeResult.data.length === 0,
    inProgress: activeResult.data.length > 0,
    limit,
    used,
    retryAfter,
  };
};

import { uploadToR2 } from "../../storage/r2Client";

export const storePunctumArtifacts = async ({
  database,
  generationId,
  punctum,
}: {
  database: SupabaseClient;
  generationId: string;
  punctum: ProcessedPunctum;
}) => {
  const basePath = `${generationId}`;
  const r2OriginalBasePath = `photos/originals/punctum-experiment/artifacts/${basePath}`;

  const [fragmentRes, cropRes, maskRes] = await Promise.all([
    uploadToR2({
      key: `${r2OriginalBasePath}/punctum.png`,
      buffer: punctum.maskedFragment,
      contentType: "image/png",
    }),
    uploadToR2({
      key: `${r2OriginalBasePath}/context.png`,
      buffer: punctum.paddedCrop,
      contentType: "image/png",
    }),
    uploadToR2({
      key: `${r2OriginalBasePath}/mask.png`,
      buffer: punctum.polygonMask,
      contentType: "image/png",
    }),
  ]);

  return {
    maskedFragmentPath: fragmentRes.publicUrl,
    contextCropPath: cropRes.publicUrl,
    maskPath: maskRes.publicUrl,
  };
};

export const storeGeneratedWorld = async ({
  database,
  sourceResponseId,
  generationId,
  buffer,
}: {
  database: SupabaseClient;
  sourceResponseId: string;
  generationId: string;
  buffer: Buffer;
}) => {
  const key = `photos/originals/punctum-experiment/generated-worlds/${sourceResponseId}/${generationId}.png`;

  const result = await uploadToR2({
    key,
    buffer,
    contentType: "image/png",
  });

  return {
    path: result.key,
    publicUrl: result.publicUrl,
  };
};

export type PunctumGenerationSource = {
  sourceResponseId: string;
  parentGenerationId: string | null;
  sourceImageId: string | null;
  sourceImageUrl: string;
  polygon: NormalizedPoint[];
  viewerExplanation: string;
  sourcePrompt: string;
  width: number;
  height: number;
};
