export const PUNCTUM_IMAGE_MODEL_OPTIONS = [
  {
    id: "google/gemini-3-pro-image",
    label: "Cinematic",
    sublabel: "Gemini 3 Pro",
    provider: "Google",
    badge: "Highest fidelity",
    cost: "$$$",
    resolution: "$$$",
    priceTag: "$$$",
    description:
      "Deeply atmospheric, ultra-detailed transformations where the selected fragment remains recognisable.",
  },
  {
    id: "google/gemini-3.1-flash-image",
    label: "Editorial",
    sublabel: "Gemini 3.1 Flash",
    provider: "Google",
    badge: "Recommended",
    cost: "$$",
    resolution: "$$",
    priceTag: "$$",
    description:
      "The best balance of punctum fidelity, photographic quality, speed, and style.",
  },
  {
    id: "google/gemini-3.1-flash-lite-image",
    label: "Instant",
    sublabel: "Gemini 3.1 Flash Lite",
    provider: "Google",
    badge: "Fastest",
    cost: "$",
    resolution: "$",
    priceTag: "$",
    description:
      "A fast, lightweight render ideal for quick ideation and immediate drafts.",
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
