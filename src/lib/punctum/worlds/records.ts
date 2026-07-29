import type { NormalizedPoint } from "../geometry";

export type PunctumGenerationRow = {
  id: string;
  source_response_id: string;
  parent_generation_id: string | null;
  source_image_id: string | null;
  source_image_url: string;
  generated_image_url: string | null;
  source_polygon_normalized: NormalizedPoint[];
  source_polygon_pixels: Array<{ x: number; y: number }>;
  crop_x: number | null;
  crop_y: number | null;
  crop_width: number | null;
  crop_height: number | null;
  source_width: number;
  source_height: number;
  padding: Record<string, number>;
  palette: string[];
  visual_analysis: Record<string, unknown>;
  viewer_explanation: string;
  source_prompt: string;
  generation_prompt: string;
  model: string;
  provider: string;
  seed: number;
  status: "pending" | "processing" | "completed" | "failed";
  error_message: string | null;
  post_generation_answer: string | null;
  post_generation_polygon: NormalizedPoint[] | null;
  post_generation_explanation: string | null;
  created_at: string;
  completed_at: string | null;
};

export const PUNCTUM_GENERATION_PUBLIC_SELECT =
  "id, source_response_id, parent_generation_id, source_image_id, source_image_url, generated_image_url, source_polygon_normalized, source_polygon_pixels, crop_x, crop_y, crop_width, crop_height, source_width, source_height, padding, palette, visual_analysis, viewer_explanation, source_prompt, generation_prompt, model, provider, seed, status, error_message, post_generation_answer, post_generation_polygon, post_generation_explanation, created_at, completed_at";

export const serializePunctumGeneration = (row: PunctumGenerationRow) => ({
  id: row.id,
  sourceResponseId: row.source_response_id,
  parentGenerationId: row.parent_generation_id,
  sourceImageId: row.source_image_id,
  sourceImageUrl: row.source_image_url,
  generatedImageUrl: row.generated_image_url,
  sourcePolygonNormalized: row.source_polygon_normalized,
  sourcePolygonPixels: row.source_polygon_pixels,
  crop: {
    x: row.crop_x,
    y: row.crop_y,
    width: row.crop_width,
    height: row.crop_height,
    padding: row.padding,
  },
  sourceWidth: row.source_width,
  sourceHeight: row.source_height,
  palette: row.palette || [],
  visualAnalysis: row.visual_analysis || {},
  viewerExplanation: row.viewer_explanation,
  sourcePrompt: row.source_prompt,
  generationPrompt: row.generation_prompt,
  model: row.model,
  provider: row.provider,
  seed: Number(row.seed),
  status: row.status,
  errorMessage: row.error_message,
  postGenerationAnswer: row.post_generation_answer,
  postGenerationPolygon: row.post_generation_polygon,
  postGenerationExplanation: row.post_generation_explanation,
  createdAt: row.created_at,
  completedAt: row.completed_at,
});
