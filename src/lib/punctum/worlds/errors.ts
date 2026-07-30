export type PublicPunctumGenerationFailure = {
  code: "generation_capacity_limit" | "generation_service_unavailable";
  message: string;
};

const LIMIT_ERROR_PATTERN =
  /\b429\b|quota|rate[-_\s]?limit|resource[-_\s]?exhausted|too many requests|billing/i;

export const getPublicPunctumGenerationFailure = (
  error: unknown,
): PublicPunctumGenerationFailure => {
  const details =
    error && typeof error === "object"
      ? (error as { status?: unknown; code?: unknown; message?: unknown })
      : {};
  const signature = [
    details.status,
    details.code,
    details.message,
    typeof error === "string" ? error : "",
  ]
    .filter(Boolean)
    .join(" ");

  if (Number(details.status) === 429 || LIMIT_ERROR_PATTERN.test(signature)) {
    return {
      code: "generation_capacity_limit",
      message: "The world-builder has reached its current public limit.",
    };
  }

  return {
    code: "generation_service_unavailable",
    message: "The world-builder could not create this one just now.",
  };
};
