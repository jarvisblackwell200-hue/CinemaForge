// ─── kie.ai API types for Kling 3.0 video generation ─────────

export type KieModel =
  | "kling-3.0/video"
  | "kling-2.6/text-to-video"
  | "kling-2.6/image-to-video";

export type KieMode = "std" | "pro";
export type KieAspectRatio = "16:9" | "9:16" | "1:1";

/** Element for character consistency across shots. */
export interface KieElement {
  /** Referenced in prompts as @name */
  name: string;
  /** Short description of the element */
  description: string;
  /** 2-4 reference image URLs (JPG/PNG, min 300x300, max 10MB each) */
  element_input_urls: string[];
}

/** Multi-shot prompt entry for storyboard mode. */
export interface KieMultiPrompt {
  /** Shot description (max 500 chars) */
  prompt: string;
  /** Shot duration in seconds (1-12) */
  duration: number;
}

/** Full input shape for kie.ai createTask. */
export interface KieCreateTaskInput {
  prompt?: string;
  image_urls?: string[];
  sound: boolean;
  duration: string;
  aspect_ratio?: KieAspectRatio;
  mode: KieMode;
  multi_shots: boolean;
  multi_prompt?: KieMultiPrompt[];
  kling_elements?: KieElement[];
}

export interface KieCreateTaskRequest {
  model: KieModel;
  callBackUrl?: string;
  input: KieCreateTaskInput;
}

/** Response from POST /jobs/createTask */
export interface KieCreateTaskResponse {
  code: number;
  msg: string;
  data: {
    taskId: string;
  };
}

/** Task states returned by kie.ai polling. */
export type KieTaskState =
  | "waiting"
  | "queuing"
  | "generating"
  | "success"
  | "fail";

/** Response from GET /jobs/recordInfo */
export interface KieRecordInfoResponse {
  code: number;
  message: string;
  data: {
    taskId: string;
    model: string;
    state: KieTaskState;
    param: string;
    resultJson: string | null;
    failCode: string;
    failMsg: string;
    costTime: number | null;
    completeTime: number | null;
    createTime: number;
    updateTime: number;
    progress: number | null;
  };
}

/** Parsed resultJson from a successful task. */
export interface KieTaskResult {
  resultUrls: string[];
}

/** Webhook callback body from kie.ai. */
export interface KieWebhookPayload {
  code: number;
  msg: string;
  data: {
    taskId: string;
    info?: {
      resultUrls: string[];
      originUrls?: string[];
    };
    fallbackFlag: boolean;
  };
}

// ─── App-level types ────────────────────────────────────────

export type QualityTier = "draft" | "standard" | "cinema";

export function qualityToKieMode(quality: QualityTier): KieMode {
  return quality === "cinema" ? "pro" : "std";
}
