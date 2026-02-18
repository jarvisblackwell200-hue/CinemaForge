/**
 * Video generation client — uses kie.ai API (Kling 3.0 under the hood).
 *
 * Endpoints:
 *   POST https://api.kie.ai/api/v1/jobs/createTask   — start generation
 *   GET  https://api.kie.ai/api/v1/jobs/recordInfo    — poll status
 *
 * Auth: Bearer token via KIE_API_KEY env var.
 */

import sharp from "sharp";
import { createClient } from "@supabase/supabase-js";
import type { QualityTier, KieElement, KieCreateTaskRequest, KieCreateTaskResponse, KieRecordInfoResponse, KieTaskResult } from "./types";
import { qualityToKieMode } from "./types";

// ─── Constants ──────────────────────────────────────────────

const KIE_BASE = "https://api.kie.ai/api/v1";
const KIE_UPLOAD_BASE = "https://kieai.redpandaai.co";
const MIN_IMAGE_DIM = 300;
const POLL_INTERVAL_MS = 3000;
const MAX_POLL_TIME_MS = 5 * 60 * 1000; // 5 minutes

// ─── Public types ───────────────────────────────────────────

export interface GenerateVideoInput {
  prompt: string;
  duration: number; // 3–15 seconds
  aspectRatio?: "16:9" | "9:16" | "1:1";
  quality: QualityTier;
  generateAudio?: boolean;
  /** Start frame image URL (for image-to-video or continuity chaining) */
  startImageUrl?: string;
  /** End frame image URL (for continuity chaining) */
  endImageUrl?: string;
  /** Character elements for face-locking across shots */
  elements?: KieElement[];
}

export interface GenerateVideoResult {
  videoUrl: string;
  fileSize: number;
  durationMs: number;
  taskId: string;
}

export interface GenerationProgress {
  status: "WAITING" | "GENERATING" | "COMPLETED";
  elapsedMs: number;
}

type ProgressCallback = (progress: GenerationProgress) => void;

// ─── Helpers ────────────────────────────────────────────────

function getApiKey(): string {
  const key = process.env.KIE_API_KEY;
  if (!key) throw new Error("KIE_API_KEY environment variable is not set");
  return key;
}

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase not configured");
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function clampDuration(seconds: number): string {
  return String(Math.max(3, Math.min(15, Math.round(seconds))));
}

// ─── Image helpers ──────────────────────────────────────────

/**
 * Download an image, check dimensions, and upscale if below 300x300.
 * Returns the original URL if already large enough, or a new Supabase URL.
 */
async function ensureMinImageSize(imageUrl: string): Promise<string> {
  const res = await fetch(imageUrl);
  if (!res.ok) {
    console.warn(`[kie] Failed to fetch image for size check: ${res.status}`);
    return imageUrl;
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  const metadata = await sharp(buffer).metadata();
  const w = metadata.width ?? 0;
  const h = metadata.height ?? 0;

  if (w >= MIN_IMAGE_DIM && h >= MIN_IMAGE_DIM) {
    return imageUrl;
  }

  console.log(`[kie] Image too small (${w}x${h}), upscaling to meet ${MIN_IMAGE_DIM}x${MIN_IMAGE_DIM} minimum`);

  const scale = Math.max(MIN_IMAGE_DIM / Math.max(w, 1), MIN_IMAGE_DIM / Math.max(h, 1));
  const newW = Math.ceil(w * scale);
  const newH = Math.ceil(h * scale);

  const upscaled = await sharp(buffer)
    .resize(newW, newH, { fit: "fill" })
    .jpeg({ quality: 90 })
    .toBuffer();

  const supabase = getSupabase();
  const path = `upscaled/${crypto.randomUUID()}.jpg`;
  const { error } = await supabase.storage
    .from("reference-images")
    .upload(path, upscaled, { contentType: "image/jpeg", upsert: false });

  if (error) {
    console.error("[kie] Failed to upload upscaled image:", error.message);
    return imageUrl;
  }

  const { data } = supabase.storage.from("reference-images").getPublicUrl(path);
  console.log(`[kie] Upscaled image: ${w}x${h} → ${newW}x${newH}`);
  return data.publicUrl;
}

/**
 * Upload an image URL to kie.ai's temporary storage for use in elements.
 * Returns the kie.ai hosted URL.
 */
export async function uploadImageToKie(imageUrl: string): Promise<string> {
  const apiKey = getApiKey();
  const fileName = `ref-${crypto.randomUUID()}.jpg`;

  const res = await fetch(`${KIE_UPLOAD_BASE}/api/file-url-upload`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      fileUrl: imageUrl,
      uploadPath: "images",
      fileName,
    }),
  });

  if (!res.ok) {
    console.warn(`[kie] File upload failed (${res.status}), using original URL`);
    return imageUrl;
  }

  const json = await res.json();
  if (json.success && json.data?.fileUrl) {
    return json.data.fileUrl;
  }

  console.warn("[kie] File upload response missing fileUrl, using original URL");
  return imageUrl;
}

// ─── kie.ai API calls ───────────────────────────────────────

async function createTask(request: KieCreateTaskRequest): Promise<string> {
  const apiKey = getApiKey();

  const res = await fetch(`${KIE_BASE}/jobs/createTask`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`kie.ai createTask failed (${res.status}): ${text}`);
  }

  const json = (await res.json()) as KieCreateTaskResponse;
  if (json.code !== 200 || !json.data?.taskId) {
    throw new Error(`kie.ai createTask error: ${json.msg}`);
  }

  return json.data.taskId;
}

async function pollTask(
  taskId: string,
  start: number,
  onProgress?: ProgressCallback,
): Promise<KieTaskResult> {
  const apiKey = getApiKey();

  while (Date.now() - start < MAX_POLL_TIME_MS) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

    const res = await fetch(
      `${KIE_BASE}/jobs/recordInfo?taskId=${encodeURIComponent(taskId)}`,
      {
        headers: { Authorization: `Bearer ${apiKey}` },
      },
    );

    if (!res.ok) {
      console.warn(`[kie] Poll failed (${res.status}), retrying...`);
      continue;
    }

    const json = (await res.json()) as KieRecordInfoResponse;
    const state = json.data?.state;

    if (state === "waiting" || state === "queuing") {
      onProgress?.({ status: "WAITING", elapsedMs: Date.now() - start });
      continue;
    }

    if (state === "generating") {
      onProgress?.({ status: "GENERATING", elapsedMs: Date.now() - start });
      continue;
    }

    if (state === "success") {
      if (!json.data.resultJson) {
        throw new Error("kie.ai task succeeded but resultJson is empty");
      }
      const result = JSON.parse(json.data.resultJson) as KieTaskResult;
      if (!result.resultUrls?.length) {
        throw new Error("kie.ai task succeeded but no video URLs in result");
      }
      return result;
    }

    if (state === "fail") {
      throw new Error(
        `kie.ai generation failed: ${json.data.failMsg || json.data.failCode || "unknown error"}`,
      );
    }
  }

  throw new Error(`kie.ai generation timed out after ${MAX_POLL_TIME_MS / 1000}s`);
}

// ─── Build request ──────────────────────────────────────────

function buildRequest(input: GenerateVideoInput, imageUrls: string[]): KieCreateTaskRequest {
  const webhookUrl = process.env.KIE_WEBHOOK_URL;

  const request: KieCreateTaskRequest = {
    model: "kling-3.0/video",
    input: {
      prompt: input.prompt,
      sound: input.generateAudio ?? false,
      duration: clampDuration(input.duration),
      aspect_ratio: input.aspectRatio ?? "16:9",
      mode: qualityToKieMode(input.quality),
      multi_shots: false,
    },
  };

  if (webhookUrl) {
    request.callBackUrl = webhookUrl;
  }

  if (imageUrls.length > 0) {
    request.input.image_urls = imageUrls;
  }

  if (input.elements?.length) {
    request.input.kling_elements = input.elements;
  }

  return request;
}

// ─── Generation ─────────────────────────────────────────────

async function generateReal(
  input: GenerateVideoInput,
  onProgress?: ProgressCallback,
): Promise<GenerateVideoResult> {
  // Ensure start/end images meet minimum dimensions
  const imageUrls: string[] = [];
  if (input.startImageUrl) {
    const url = await ensureMinImageSize(input.startImageUrl);
    imageUrls.push(url);
  }
  if (input.endImageUrl) {
    const url = await ensureMinImageSize(input.endImageUrl);
    imageUrls.push(url);
  }

  const request = buildRequest(input, imageUrls);
  const start = Date.now();

  console.log(`[kie] Creating task`, {
    model: request.model,
    mode: request.input.mode,
    duration: request.input.duration,
    hasImages: imageUrls.length > 0,
    elements: input.elements?.length ?? 0,
    audio: request.input.sound,
    promptLength: input.prompt.length,
  });

  let taskId: string;
  try {
    taskId = await createTask(request);
  } catch (err) {
    console.error(`[kie] createTask error:`, err);
    throw err;
  }

  console.log(`[kie] Task created: ${taskId}, polling...`);

  const result = await pollTask(taskId, start, onProgress);
  const elapsedMs = Date.now() - start;

  onProgress?.({ status: "COMPLETED", elapsedMs });

  console.log(`[kie] Task ${taskId} completed in ${(elapsedMs / 1000).toFixed(1)}s`);

  return {
    videoUrl: result.resultUrls[0],
    fileSize: 0, // kie.ai doesn't return file size in response
    durationMs: elapsedMs,
    taskId,
  };
}

// ─── Public API ─────────────────────────────────────────────

/**
 * Generate a video using Kling 3.0 via kie.ai.
 * Standard mode for draft/standard quality, Pro mode for cinema quality.
 * Supports character elements for face-locking across shots.
 */
export async function generateVideo(
  input: GenerateVideoInput,
  onProgress?: ProgressCallback,
): Promise<GenerateVideoResult> {
  return generateReal(input, onProgress);
}
