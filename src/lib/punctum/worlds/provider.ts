import { GoogleGenAI } from "@google/genai";
import sharp from "sharp";
import type { ProcessedPunctum } from "./geometry";
import { getPunctumImageModelOption } from "./model-options";

export type PunctumGenerationInput = {
  width: number;
  height: number;
  prompt: string;
  seed: number;
  punctum: ProcessedPunctum;
};

export type PunctumGenerationOutput = {
  buffer: Buffer;
  model: string;
  provider: string;
};

export interface PunctumImageProvider {
  id: string;
  model: string;
  generate(input: PunctumGenerationInput): Promise<PunctumGenerationOutput>;
}

const runtimeEnv = (name: string) =>
  String(import.meta.env[name] || process.env[name] || "").trim();

const bufferToDataUrl = (buffer: Buffer, mimeType = "image/png") =>
  `data:${mimeType};base64,${buffer.toString("base64")}`;

export const PUNCTUM_GEMINI_MODEL_PRIORITY = [
  "gemini-3-pro-image",
  "gemini-3.1-flash-image",
  "gemini-2.5-flash-image",
] as const;

const SUPPORTED_IMAGE_ASPECT_RATIOS = [
  "1:1",
  "2:3",
  "3:2",
  "3:4",
  "4:3",
  "4:5",
  "5:4",
  "9:16",
  "16:9",
  "21:9",
] as const;

const simplifyRatio = (width: number, height: number) => {
  const greatestCommonDivisor = (first: number, second: number): number =>
    second === 0
      ? Math.abs(first)
      : greatestCommonDivisor(second, first % second);
  const divisor = greatestCommonDivisor(width, height) || 1;
  return `${Math.round(width / divisor)}:${Math.round(height / divisor)}`;
};

const parseModelList = (value: string, fallback: readonly string[]) => {
  const models = value
    .split(",")
    .map((model) => model.trim())
    .filter(Boolean);
  return models.length ? [...new Set(models)] : [...fallback];
};

const getImageResolution = (model = "") => {
  if (model.includes("gemini-3.1-flash-lite-image")) return "1K";
  if (
    model.includes("gemini-2.5-flash-image") ||
    (model.startsWith("openai/") && model.includes("image")) ||
    model.includes("flux.2-")
  ) {
    return "";
  }
  const requested = runtimeEnv("PUNCTUM_IMAGE_RESOLUTION").toUpperCase();
  return ["1K", "2K", "4K"].includes(requested) ? requested : "2K";
};

export const getPunctumGenerationAspectRatio = (
  width: number,
  height: number,
) => {
  const target = width / height;
  return SUPPORTED_IMAGE_ASPECT_RATIOS.reduce((closest, candidate) => {
    const [closestWidth, closestHeight] = closest.split(":").map(Number);
    const [candidateWidth, candidateHeight] = candidate.split(":").map(Number);
    const closestDistance = Math.abs(
      Math.log(target / (closestWidth / closestHeight)),
    );
    const candidateDistance = Math.abs(
      Math.log(target / (candidateWidth / candidateHeight)),
    );
    return candidateDistance < closestDistance ? candidate : closest;
  });
};

const finishGeneratedImage = async (
  generatedBuffer: Buffer,
  width: number,
  height: number,
) => {
  if (!generatedBuffer.length) {
    throw new Error("The image model returned an empty image.");
  }
  return sharp(generatedBuffer)
    .resize(width, height, {
      fit: "fill",
    })
    .png()
    .toBuffer();
};

export const buildGeminiImageRequest = (
  input: PunctumGenerationInput,
  model: string,
) => {
  const imageSize = getImageResolution(model);
  return {
    model,
    input: [
      { type: "text" as const, text: input.prompt },
      {
        type: "text" as const,
        text: "PRIMARY REFERENCE — the isolated polygon-masked punctum. Preserve this reference with the greatest fidelity.",
      },
      {
        type: "image" as const,
        mime_type: "image/png" as const,
        data: input.punctum.maskedFragment.toString("base64"),
      },
      {
        type: "text" as const,
        text: "SECONDARY REFERENCE — the padded contextual crop. Use this only as interpretive evidence, not as a composition to reproduce.",
      },
      {
        type: "image" as const,
        mime_type: "image/png" as const,
        data: input.punctum.paddedCrop.toString("base64"),
      },
    ],
    response_format: {
      type: "image" as const,
      mime_type: "image/jpeg" as const,
      aspect_ratio: getPunctumGenerationAspectRatio(input.width, input.height),
      ...(imageSize ? { image_size: imageSize } : {}),
    },
  };
};

const getOpenRouterAspectRatio = (
  model: string,
  width: number,
  height: number,
) => {
  if (model.startsWith("openai/gpt-5-image")) return "";
  if (model.includes("gpt-image")) {
    const ratio = width / height;
    if (ratio > 1.15) return "3:2";
    if (ratio < 0.87) return "2:3";
    return "1:1";
  }
  return getPunctumGenerationAspectRatio(width, height);
};

export const buildOpenRouterImageRequest = (
  input: PunctumGenerationInput,
  model: string,
  strictModel = false,
) => {
  const resolution = getImageResolution(model);
  const aspectRatio = getOpenRouterAspectRatio(
    model,
    input.width,
    input.height,
  );
  const supportsSeed =
    model.includes("seedream-") || model.includes("flux.2-");
  return {
    model,
    prompt: input.prompt,
    n: 1,
    ...(aspectRatio ? { aspect_ratio: aspectRatio } : {}),
    ...(resolution ? { resolution } : {}),
    ...(model.startsWith("openai/") && model.includes("image")
      ? { quality: "medium" }
      : {}),
    ...(supportsSeed ? { seed: input.seed } : {}),
    allow_fallbacks: !strictModel,
    input_references: [
      {
        type: "image_url",
        image_url: {
          url: bufferToDataUrl(input.punctum.maskedFragment),
        },
      },
      {
        type: "image_url",
        image_url: {
          url: bufferToDataUrl(input.punctum.paddedCrop),
        },
      },
    ],
  };
};

class GeminiPunctumProvider implements PunctumImageProvider {
  id = "gemini";
  model: string;
  apiKey: string;
  models: string[];

  constructor(selectedModels?: string[]) {
    const configuredModel = runtimeEnv("PUNCTUM_IMAGE_MODEL");
    this.models = selectedModels?.length
      ? selectedModels
      : parseModelList(
          runtimeEnv("PUNCTUM_GEMINI_MODELS") ||
            (configuredModel && !configuredModel.includes("/")
              ? configuredModel
              : ""),
          PUNCTUM_GEMINI_MODEL_PRIORITY,
        );
    this.model = this.models[0];
    this.apiKey = runtimeEnv("GEMINI_API_KEY") || runtimeEnv("GOOGLE_API_KEY");
  }

  async generate(
    input: PunctumGenerationInput,
  ): Promise<PunctumGenerationOutput> {
    if (!this.apiKey) {
      throw new Error("Gemini image generation is not configured.");
    }

    const client = new GoogleGenAI({ apiKey: this.apiKey });
    let lastError: Error | null = null;
    for (const model of this.models) {
      try {
        const interaction = await client.interactions.create(
          buildGeminiImageRequest(input, model),
          {
            timeout: 270_000,
            maxRetries: 0,
          },
        );
        const imageData = interaction.output_image?.data;
        if (!imageData) {
          throw new Error(
            interaction.output_text ||
              `Gemini returned no generated image (${interaction.status || "unknown status"}).`,
          );
        }

        return {
          buffer: await finishGeneratedImage(
            Buffer.from(imageData, "base64"),
            input.width,
            input.height,
          ),
          model,
          provider: this.id,
        };
      } catch (error) {
        lastError =
          error instanceof Error
            ? error
            : new Error("Gemini image generation failed.");
        console.warn(`Punctum image model ${model} failed:`, lastError.message);
      }
    }

    throw lastError || new Error("Gemini could not generate the new world.");
  }
}

class OpenRouterPunctumProvider implements PunctumImageProvider {
  id = "openrouter";
  model: string;
  apiKey: string;
  models: string[];
  strictModel: boolean;

  constructor(selectedModels?: string[], strictModel = false) {
    const configuredModel =
      runtimeEnv("PUNCTUM_OPENROUTER_IMAGE_MODELS") ||
      runtimeEnv("OPENROUTER_IMAGE_MODEL") ||
      (runtimeEnv("PUNCTUM_IMAGE_MODEL").includes("/")
        ? runtimeEnv("PUNCTUM_IMAGE_MODEL")
        : "");
    this.models = selectedModels?.length
      ? selectedModels
      : parseModelList(
          configuredModel,
          PUNCTUM_GEMINI_MODEL_PRIORITY.map((model) => `google/${model}`),
        );
    this.model = this.models[0];
    this.apiKey = runtimeEnv("OPENROUTER_API_KEY");
    this.strictModel = strictModel;
  }

  async generate(
    input: PunctumGenerationInput,
  ): Promise<PunctumGenerationOutput> {
    if (!this.apiKey) {
      throw new Error("OpenRouter image generation is not configured.");
    }

    let lastError: Error | null = null;
    for (const model of this.models) {
      try {
        const response = await fetch("https://openrouter.ai/api/v1/images", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": runtimeEnv("PUBLIC_SITE_URL") || "https://abodid.com",
            "X-Title": "Punctum AI Worlds",
          },
          body: JSON.stringify(
            buildOpenRouterImageRequest(input, model, this.strictModel),
          ),
          signal: AbortSignal.timeout(270_000),
        });

        const payload = (await response.json().catch(() => null)) as {
          data?: Array<{ b64_json?: string; url?: string }>;
          error?: { message?: string } | string;
          message?: string;
          model?: string;
        } | null;
        if (!response.ok) {
          const detail =
            typeof payload?.error === "string"
              ? payload.error
              : payload?.error?.message || payload?.message;
          throw new Error(
            detail ||
              `OpenRouter image generation failed (${response.status}).`,
          );
        }
        const result = payload?.data?.[0];
        let generatedBuffer: Buffer;
        if (result?.b64_json) {
          generatedBuffer = Buffer.from(result.b64_json, "base64");
        } else if (result?.url) {
          const imageResponse = await fetch(result.url, {
            signal: AbortSignal.timeout(30_000),
          });
          if (!imageResponse.ok) {
            throw new Error("The generated image could not be retrieved.");
          }
          generatedBuffer = Buffer.from(await imageResponse.arrayBuffer());
        } else {
          throw new Error("OpenRouter returned no generated image.");
        }

        return {
          buffer: await finishGeneratedImage(
            generatedBuffer,
            input.width,
            input.height,
          ),
          model: payload?.model || model,
          provider: this.id,
        };
      } catch (error) {
        lastError =
          error instanceof Error
            ? error
            : new Error("OpenRouter image generation failed.");
        console.warn(`Punctum image model ${model} failed:`, lastError.message);
      }
    }

    throw lastError || new Error("OpenRouter could not generate the new world.");
  }
}

class FallbackPunctumProvider implements PunctumImageProvider {
  id: string;
  model: string;
  providers: PunctumImageProvider[];

  constructor(providers: PunctumImageProvider[]) {
    if (!providers.length) {
      throw new Error("Image generation is not configured.");
    }
    this.providers = providers;
    this.id = providers[0].id;
    this.model = providers[0].model;
  }

  async generate(
    input: PunctumGenerationInput,
  ): Promise<PunctumGenerationOutput> {
    let lastError: Error | null = null;
    for (const provider of this.providers) {
      try {
        return await provider.generate(input);
      } catch (error) {
        lastError =
          error instanceof Error
            ? error
            : new Error("The image provider failed.");
        console.warn(
          `Punctum image provider ${provider.id} failed:`,
          lastError.message,
        );
      }
    }
    throw lastError || new Error("The image providers could not create this world.");
  }
}

export const getPunctumImageProvider = (
  requestedModelId = "",
): PunctumImageProvider => {
  if (requestedModelId) {
    const selected = getPunctumImageModelOption(requestedModelId);
    if (!selected) {
      throw new Error("The selected image model is not available.");
    }
    const selectedProviders: PunctumImageProvider[] = [];
    if (runtimeEnv("OPENROUTER_API_KEY")) {
      selectedProviders.push(
        new OpenRouterPunctumProvider([selected.id], true),
      );
    }
    if (
      selected.id.startsWith("google/") &&
      (runtimeEnv("GEMINI_API_KEY") || runtimeEnv("GOOGLE_API_KEY"))
    ) {
      selectedProviders.push(
        new GeminiPunctumProvider([selected.id.replace(/^google\//, "")]),
      );
    }
    if (!selectedProviders.length) {
      throw new Error("The selected image model is not configured.");
    }
    return selectedProviders.length === 1
      ? selectedProviders[0]
      : new FallbackPunctumProvider(selectedProviders);
  }
  const provider = runtimeEnv("PUNCTUM_IMAGE_PROVIDER") || "auto";
  if (provider === "gemini") return new GeminiPunctumProvider();
  if (provider === "openrouter") return new OpenRouterPunctumProvider();
  if (provider === "auto") {
    const providers: PunctumImageProvider[] = [];
    if (runtimeEnv("OPENROUTER_API_KEY")) {
      providers.push(new OpenRouterPunctumProvider());
    }
    if (runtimeEnv("GEMINI_API_KEY") || runtimeEnv("GOOGLE_API_KEY")) {
      providers.push(new GeminiPunctumProvider());
    }
    return new FallbackPunctumProvider(providers);
  }
  throw new Error(`Unsupported Punctum image provider: ${provider}`);
};

export const buildPunctumGenerationPrompt = ({
  width,
  height,
  viewerExplanation,
  originalPrompt,
  punctum,
}: {
  width: number;
  height: number;
  viewerExplanation: string;
  originalPrompt: string;
  punctum: ProcessedPunctum;
}) => {
  const aspectRatio = simplifyRatio(width, height);
  return `Create one completely new, coherent photographic world at exactly ${width} × ${height} pixels
with the exact ${aspectRatio} aspect ratio. The output
must match these dimensions and aspect ratio without cropping, padding, borders,
or changing the canvas proportions.

REFERENCE HIERARCHY
The first supplied reference is the polygon-masked punctum. Treat it as the
visual, material, and conceptual seed of the entire new world and give it
substantially greater reference strength than the second supplied reference.
The second reference is only a padded contextual crop: use it to understand the
fragment, never to recreate the original scene or composition.

The viewer was originally asked: “${originalPrompt}”
The fragment attracted the viewer because: “${viewerExplanation}”

PUNCTUM EVIDENCE
Sampled punctum palette: ${punctum.analysis.palette.join(", ")}.
Average luminance: ${punctum.analysis.averageLuminance}.
Average saturation: ${punctum.analysis.averageSaturation}.
Contrast: ${punctum.analysis.contrast}.
Dominant temperature: ${punctum.analysis.dominantTemperature}.
Texture character: ${punctum.analysis.texture}, with texture energy
${punctum.analysis.textureEnergy}.

WORLD INFERENCE AND MATERIAL TRANSFORMATION
Infer the strongest world concept from the masked fragment, the limited padded
context, the viewer’s explanation, and all measured visual evidence above.
Preserve the punctum’s recognisable silhouette, internal colour relationships,
texture, gesture, object identity, or other defining visual structure. Retain
that identity while intelligently transforming, wrapping, enlarging, repeating,
weathering, eroding, folding, growing, constructing, or embedding it into a
believable physical role. It may become stone, architecture, landscape, fabric,
clothing, skin, organic matter, machinery, furniture, a mural, or another
material or surface inferred from the evidence. It must feel physically native
to the new scene, never pasted on top of it.

Allow substantial freedom in the surrounding world. The setting may resemble an
anonymous archival image, documentary photograph, intimate domestic photograph,
contemporary observation, surreal recorded event, or speculative future
photographed as though it physically existed. Make the punctum visually
discoverable without automatically centring, isolating, spotlighting, framing,
or turning it into a designed hero object. The image should feel witnessed rather than composed for display.

PHOTOGRAPHIC REALISM
Render the result as a real, unstaged photograph. Infer a contextually
appropriate 24 mm, 35 mm, 50 mm, or 85 mm lens and commit to one believable
camera position, camera height, viewing distance, and optical perspective.
Establish convincing foreground-to-background depth and scale. Use physically
consistent lighting, natural shadow direction and falloff, controlled
highlights, textured shadows, and restrained, optically plausible depth of
field. Include subtle lens imperfections and fine 35 mm film grain without
turning them into a filter.

Give every surface environmental wear, contact marks, age, dust, moisture,
patina, abrasions, seams, material-specific roughness, and physically credible
reflections where appropriate. Fabric must have realistic weight, weave,
tension, drape, compression, and folds. If people are present, render detailed
human skin with pores, wrinkles, fine hair, minor blemishes, natural tonal
variation, and anatomically credible hands and bodies. Preserve ordinary
imperfection; do not beauty-retouch the scene.

COMPOSITIONAL SEPARATION
Do not reproduce, paraphrase, or closely echo the original photograph’s
composition, camera angle, spatial arrangement, background, subject placement,
or lighting scheme. Expand the fragment’s visual and material logic into an
entirely different world while keeping the punctum recognisable within it.

NEGATIVE PROMPT
Avoid: pasted crop, visible mask boundary, sticker effect, framed fragment,
disconnected texture overlay, original composition recreation, generic AI art,
digital collage, illustration, painting, concept art, game art, obvious CGI,
3D-render appearance, plastic materials, waxy or airbrushed skin, beauty
retouching, malformed anatomy, distorted hands, duplicated people, floating
objects, impossible perspective, inconsistent lighting, artificial HDR,
excessive sharpness, excessive bokeh, oversaturation, arbitrary teal-and-orange
grading, excessive neon, perfect symmetry, sterile surfaces, generic futuristic
city, fantasy cliché, glowing outlines, text, captions, typography, borders,
logos, watermarks, interface elements, and explanatory graphics.`;
};
