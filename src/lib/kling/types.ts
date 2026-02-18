export type KlingModel = "kling-v3" | "kling-v2";
export type KlingMode = "standard" | "professional";
export type KlingAspectRatio = "16:9" | "9:16" | "1:1" | "21:9";

export interface KlingGenerateRequest {
  model: KlingModel;
  mode: KlingMode;
  prompt: string;
  negative_prompt?: string;
  duration: number;
  aspect_ratio: KlingAspectRatio;
  /** Native Kling camera presets. Not available via fal.ai — requires direct Kling API. */
  camera_control?: string;
  start_frame_url?: string;
  /**
   * Kling Elements API references for character consistency.
   * Not available via fal.ai — requires direct Kling API integration.
   * `face_reference_strength` should be 70-85 (Kling default 42 is too low, >85 too rigid).
   */
  subject_reference?: {
    element_id: string;
    face_reference_strength?: number;
  }[];
  creativity?: number;
}

export interface KlingTaskStatus {
  task_id: string;
  status: "pending" | "processing" | "completed" | "failed";
  progress?: number;
  video_url?: string;
  thumbnail_url?: string;
  error_message?: string;
  created_at: string;
  completed_at?: string;
}

export interface KlingElement {
  element_id: string;
  name: string;
  type: "character" | "object";
  status: "active" | "processing" | "failed";
  reference_images: string[];
}

export type QualityTier = "draft" | "standard" | "cinema";

export function qualityToKlingMode(quality: QualityTier): KlingMode {
  return quality === "draft" ? "standard" : "professional";
}

export function qualityToResolution(
  quality: QualityTier
): string {
  switch (quality) {
    case "draft":
      return "720p";
    case "standard":
      return "1080p";
    case "cinema":
      return "4K";
  }
}
