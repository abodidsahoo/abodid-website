export const PUNCTUM_IMAGE_MODEL_OPTIONS = [
  {
    id: "google/gemini-3.1-flash-image",
    label: "Gemini 3.1 Flash",
    provider: "Google",
    badge: "Recommended",
    cost: "$$",
    resolution: "2K",
    description:
      "The best balance of punctum fidelity, photographic quality, speed, and cost.",
  },
  {
    id: "google/gemini-3-pro-image",
    label: "Gemini 3 Pro",
    provider: "Google",
    badge: "Highest fidelity",
    cost: "$$$",
    resolution: "2K",
    description:
      "Best for complex transformations where the selected fragment must remain recognisable.",
  },
  {
    id: "google/gemini-3.1-flash-lite-image",
    label: "Gemini 3.1 Flash Lite",
    provider: "Google",
    badge: "Economy",
    cost: "$",
    resolution: "1K",
    description:
      "A fast, inexpensive draft with less fine detail than the balanced model.",
  },
  {
    id: "openai/gpt-5-image-mini",
    label: "GPT-5 Image Mini",
    provider: "OpenAI",
    badge: "Precise edit",
    cost: "$",
    resolution: "1K",
    description:
      "Good instruction following and detailed reference editing at a low cost.",
  },
  {
    id: "bytedance-seed/seedream-4.5",
    label: "Seedream 4.5",
    provider: "ByteDance",
    badge: "Photographic",
    cost: "$",
    resolution: "2K",
    description:
      "A strong low-cost alternative for detailed, cinematic photographic worlds.",
  },
  {
    id: "black-forest-labs/flux.2-klein-4b",
    label: "FLUX.2 Klein",
    provider: "Black Forest Labs",
    badge: "Fast experiment",
    cost: "$",
    resolution: "1K",
    description:
      "The quickest experimental option; useful for ideation with lighter reference fidelity.",
  },
] as const;

export type PunctumImageModelId =
  (typeof PUNCTUM_IMAGE_MODEL_OPTIONS)[number]["id"];

export const DEFAULT_PUNCTUM_IMAGE_MODEL_ID: PunctumImageModelId =
  "google/gemini-3.1-flash-image";

const normalizeModelId = (modelId: unknown) => {
  const value = String(modelId || "").trim();
  return value.startsWith("gemini-") ? `google/${value}` : value;
};

export const getPunctumImageModelOption = (modelId: unknown) => {
  const normalized = normalizeModelId(modelId);
  return PUNCTUM_IMAGE_MODEL_OPTIONS.find(
    (option) => option.id === normalized,
  );
};
