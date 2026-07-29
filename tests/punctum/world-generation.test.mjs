import assert from "node:assert/strict";
import sharp from "sharp";
import { test } from "vitest";

import {
  getPunctumCrop,
  normalizedPolygonToPixels,
  processPunctumRegion,
} from "../../src/lib/punctum/worlds/geometry.ts";
import {
  buildGeminiImageRequest,
  buildOpenRouterImageRequest,
  buildPunctumGenerationPrompt,
  getPunctumGenerationAspectRatio,
  PUNCTUM_GEMINI_MODEL_PRIORITY,
} from "../../src/lib/punctum/worlds/provider.ts";
import {
  DEFAULT_PUNCTUM_IMAGE_MODEL_ID,
  getPunctumImageModelOption,
  PUNCTUM_IMAGE_MODEL_OPTIONS,
} from "../../src/lib/punctum/worlds/model-options.ts";
import {
  getPunctumGenerationQuota,
} from "../../src/lib/punctum/worlds/server.ts";

const normalizedSquare = [
  { x: 0.1, y: 0.2 },
  { x: 0.3, y: 0.2 },
  { x: 0.3, y: 0.5 },
  { x: 0.1, y: 0.5 },
];

test("normalized punctum coordinates retain exact pixel-space values", () => {
  const pixels = normalizedPolygonToPixels(normalizedSquare, 100, 80);
  assert.deepEqual(pixels, [
    { x: 10, y: 16 },
    { x: 30, y: 16 },
    { x: 30, y: 40 },
    { x: 10, y: 40 },
  ]);
  assert.deepEqual(getPunctumCrop(pixels, 100, 80), {
    x: 7,
    y: 13,
    width: 26,
    height: 30,
    padding: {
      left: 3,
      top: 3,
      right: 3,
      bottom: 3,
      ratio: 0.125,
    },
  });
});

test("full-resolution processing produces a masked crop, context and mask", async () => {
  const source = await sharp({
    create: {
      width: 100,
      height: 80,
      channels: 3,
      background: { r: 188, g: 104, b: 66 },
    },
  })
    .png()
    .toBuffer();
  const punctum = await processPunctumRegion({
    source,
    polygonNormalized: normalizedSquare,
  });
  const [fragment, context, mask] = await Promise.all([
    sharp(punctum.maskedFragment).metadata(),
    sharp(punctum.paddedCrop).metadata(),
    sharp(punctum.polygonMask).metadata(),
  ]);

  assert.equal(fragment.width, punctum.crop.width);
  assert.equal(fragment.height, punctum.crop.height);
  assert.equal(context.width, punctum.crop.width);
  assert.equal(context.height, punctum.crop.height);
  assert.equal(mask.width, 100);
  assert.equal(mask.height, 80);
  assert.ok(punctum.analysis.palette.length >= 1);
  assert.equal(punctum.analysis.sampledPixelCount > 0, true);
});

test("the dynamic prompt carries the explanation, palette and exact dimensions", async () => {
  const source = await sharp({
    create: {
      width: 60,
      height: 40,
      channels: 3,
      background: { r: 30, g: 90, b: 150 },
    },
  })
    .png()
    .toBuffer();
  const punctum = await processPunctumRegion({
    source,
    polygonNormalized: normalizedSquare,
  });
  const prompt = buildPunctumGenerationPrompt({
    width: 60,
    height: 40,
    viewerExplanation: "The blue edge felt like a doorway.",
    originalPrompt: "What caught you?",
    punctum,
  });

  assert.match(prompt, /exactly 60 × 40 pixels/);
  assert.match(prompt, /The blue edge felt like a doorway/);
  assert.match(prompt, new RegExp(punctum.analysis.palette[0]));
  assert.match(prompt, /exact 3:2 aspect ratio/);
  assert.match(prompt, /visual, material, and conceptual seed/);
  assert.match(prompt, /substantially greater reference strength/);
  assert.match(prompt, /24 mm, 35 mm, 50 mm, or 85 mm lens/);
  assert.match(prompt, /fine 35 mm film grain/);
  assert.match(prompt, /pores, wrinkles, fine hair, minor blemishes/);
  assert.match(prompt, /witnessed rather than composed for display/);
  assert.match(prompt, /Do not reproduce, paraphrase, or closely echo/);
  assert.match(prompt, /NEGATIVE PROMPT/);
  assert.match(prompt, /visible mask boundary/);
  assert.match(prompt, /generic futuristic/);
});

test("Gemini generation prioritizes Nano Banana Pro and preserves reference order", async () => {
  const source = await sharp({
    create: {
      width: 120,
      height: 80,
      channels: 3,
      background: { r: 30, g: 90, b: 150 },
    },
  })
    .png()
    .toBuffer();
  const punctum = await processPunctumRegion({
    source,
    polygonNormalized: normalizedSquare,
  });
  const request = buildGeminiImageRequest(
    {
      width: 120,
      height: 80,
      prompt: "Create a new photographic world.",
      seed: 1,
      punctum,
    },
    PUNCTUM_GEMINI_MODEL_PRIORITY[0],
  );
  const parts = request.input;

  assert.equal(PUNCTUM_GEMINI_MODEL_PRIORITY[0], "gemini-3-pro-image");
  assert.match(parts[1].text, /PRIMARY REFERENCE/);
  assert.equal(parts[2].data, punctum.maskedFragment.toString("base64"));
  assert.match(parts[3].text, /SECONDARY REFERENCE/);
  assert.equal(parts[4].data, punctum.paddedCrop.toString("base64"));
  assert.equal(request.response_format.type, "image");
  assert.equal(request.response_format.aspect_ratio, "3:2");
  assert.equal(request.response_format.image_size, "2K");
});

test("the public model picker has a balanced default and a closed allowlist", () => {
  assert.equal(
    DEFAULT_PUNCTUM_IMAGE_MODEL_ID,
    "google/gemini-3.1-flash-image",
  );
  assert.equal(PUNCTUM_IMAGE_MODEL_OPTIONS.length, 6);
  assert.equal(
    getPunctumImageModelOption("gemini-3-pro-image")?.id,
    "google/gemini-3-pro-image",
  );
  assert.equal(getPunctumImageModelOption("untrusted/custom-model"), undefined);
});

test("OpenRouter requests adapt resolution and controls to the selected model", async () => {
  const source = await sharp({
    create: {
      width: 120,
      height: 80,
      channels: 3,
      background: { r: 30, g: 90, b: 150 },
    },
  })
    .png()
    .toBuffer();
  const punctum = await processPunctumRegion({
    source,
    polygonNormalized: normalizedSquare,
  });
  const input = {
    width: 120,
    height: 80,
    prompt: "Create a new photographic world.",
    seed: 149,
    punctum,
  };
  const lite = buildOpenRouterImageRequest(
    input,
    "google/gemini-3.1-flash-lite-image",
    true,
  );
  const openAi = buildOpenRouterImageRequest(
    input,
    "openai/gpt-5-image-mini",
    true,
  );
  const flux = buildOpenRouterImageRequest(
    input,
    "black-forest-labs/flux.2-klein-4b",
    true,
  );

  assert.equal(lite.resolution, "1K");
  assert.equal(lite.allow_fallbacks, false);
  assert.equal(lite.input_references.length, 2);
  assert.equal("aspect_ratio" in openAi, false);
  assert.equal(openAi.quality, "medium");
  assert.equal("resolution" in openAi, false);
  assert.equal(flux.seed, 149);
  assert.equal("resolution" in flux, false);
});

test("image generation selects the nearest supported model aspect ratio", () => {
  assert.equal(getPunctumGenerationAspectRatio(1920, 1080), "16:9");
  assert.equal(getPunctumGenerationAspectRatio(1080, 1920), "9:16");
  assert.equal(getPunctumGenerationAspectRatio(1200, 1000), "5:4");
});

const quotaDatabase = ({ count, oldestCreatedAt, active }) => {
  let selectCall = 0;
  const chain = (result) => {
    const builder = {
      eq: () => builder,
      in: () => builder,
      neq: () => builder,
      gte: () => builder,
      lt: () => builder,
      order: () => builder,
      limit: () => builder,
      then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
    };
    return builder;
  };
  return {
    from: () => ({
      update: () => chain({ error: null }),
      select: () => {
        selectCall += 1;
        return selectCall === 1
          ? chain({
              count,
              data: oldestCreatedAt
                ? [{ created_at: oldestCreatedAt }]
                : [],
              error: null,
            })
          : chain({
              data: active ? [{ id: crypto.randomUUID() }] : [],
              error: null,
            });
      },
    }),
  };
};

test("durable generation quota reports the exact retry window", async () => {
  const now = Date.parse("2026-07-30T12:00:00.000Z");
  const quota = await getPunctumGenerationQuota({
    database: quotaDatabase({
      count: 4,
      oldestCreatedAt: "2026-07-30T11:30:00.000Z",
      active: false,
    }),
    sessionKeyHash: "session-hash",
    now,
    limit: 4,
  });

  assert.deepEqual(quota, {
    allowed: false,
    inProgress: false,
    limit: 4,
    used: 4,
    retryAfter: 1800,
  });
});

test("durable generation quota distinguishes an active generation", async () => {
  const quota = await getPunctumGenerationQuota({
    database: quotaDatabase({
      count: 2,
      oldestCreatedAt: "2026-07-30T11:30:00.000Z",
      active: true,
    }),
    sessionKeyHash: "session-hash",
    now: Date.parse("2026-07-30T12:00:00.000Z"),
    limit: 4,
  });

  assert.equal(quota.allowed, false);
  assert.equal(quota.inProgress, true);
  assert.equal(quota.used, 2);
  assert.equal(quota.retryAfter, 0);
});
