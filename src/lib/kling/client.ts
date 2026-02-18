import { fal } from "@fal-ai/client";
import sharp from "sharp";
import { createClient } from "@supabase/supabase-js";
import type { QualityTier } from "./types";

// ─── Kling O3 endpoints via fal.ai ────────────────────────────

const FAL_ENDPOINTS = {
  textToVideo: {
    standard: "fal-ai/kling-video/o3/standard/text-to-video",
    pro: "fal-ai/kling-video/o3/pro/text-to-video",
  },
  imageToVideo: {
    standard: "fal-ai/kling-video/o3/standard/image-to-video",
    pro: "fal-ai/kling-video/o3/pro/image-to-video",
  },
} as const;

const MIN_IMAGE_DIM = 300; // Kling O3 minimum: 300x300

// ─── Types ─────────────────────────────────────────────────────

export interface GenerateVideoInput {
  prompt: string;
  negativePrompt?: string;
  duration: number; // 3–15 seconds
  aspectRatio?: "16:9" | "9:16" | "1:1";
  quality: QualityTier;
  generateAudio?: boolean;
  cfgScale?: number;
  /** For image-to-video: character reference or start frame */
  startImageUrl?: string;
  /** For continuity chaining: end frame from previous shot */
  endImageUrl?: string;
}

export interface GenerateVideoResult {
  videoUrl: string;
  fileSize: number;
  durationMs: number;
  isDryRun: boolean;
}

export interface GenerationProgress {
  status: "IN_QUEUE" | "IN_PROGRESS" | "COMPLETED";
  elapsedMs: number;
  logs: string[];
}

type ProgressCallback = (progress: GenerationProgress) => void;

// ─── Helpers ──────────────────────────────────────────────────

function initFal() {
  const key = process.env.FAL_KEY;
  if (!key) throw new Error("FAL_KEY environment variable is not set");
  fal.config({ credentials: key });
}

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase not configured");
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// Clamp duration to Kling O3 range (3–15), returns string enum
function clampDuration(seconds: number): string {
  return String(Math.max(3, Math.min(15, Math.round(seconds))));
}

/**
 * Download an image, check dimensions, and upscale if below 300x300.
 * Returns the original URL if already large enough, or a new Supabase URL of the upscaled version.
 */
async function ensureMinImageSize(imageUrl: string): Promise<string> {
  const res = await fetch(imageUrl);
  if (!res.ok) {
    console.warn(`[kling] Failed to fetch image for size check: ${res.status}`);
    return imageUrl;
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  const metadata = await sharp(buffer).metadata();
  const w = metadata.width ?? 0;
  const h = metadata.height ?? 0;

  if (w >= MIN_IMAGE_DIM && h >= MIN_IMAGE_DIM) {
    return imageUrl; // Already large enough
  }

  console.log(`[kling] Image too small (${w}x${h}), upscaling to meet ${MIN_IMAGE_DIM}x${MIN_IMAGE_DIM} minimum`);

  // Calculate scale factor to get both dimensions above minimum
  const scale = Math.max(MIN_IMAGE_DIM / Math.max(w, 1), MIN_IMAGE_DIM / Math.max(h, 1));
  const newW = Math.ceil(w * scale);
  const newH = Math.ceil(h * scale);

  const upscaled = await sharp(buffer)
    .resize(newW, newH, { fit: "fill" })
    .jpeg({ quality: 90 })
    .toBuffer();

  // Upload upscaled image to Supabase
  const supabase = getSupabase();
  const path = `upscaled/${crypto.randomUUID()}.jpg`;
  const { error } = await supabase.storage
    .from("reference-images")
    .upload(path, upscaled, { contentType: "image/jpeg", upsert: false });

  if (error) {
    console.error("[kling] Failed to upload upscaled image:", error.message);
    return imageUrl; // Fall back to original
  }

  const { data } = supabase.storage.from("reference-images").getPublicUrl(path);
  console.log(`[kling] Upscaled image: ${w}x${h} → ${newW}x${newH}`);
  return data.publicUrl;
}

// TODO: The following fal.ai-unsupported params require direct Kling API integration:
//   - subject_reference (Elements API / klingElementId / @Element syntax)
//   - face_reference_strength (Kling default 42, CLAUDE.md recommends 70-85)
//   - camera_control (Kling native camera presets)
// These are defined in types.ts for future direct-API work.

function buildFalInput(input: GenerateVideoInput, imageUrl: string | undefined): Record<string, unknown> {
  const falInput: Record<string, unknown> = {
    prompt: input.prompt,
    negative_prompt: input.negativePrompt,
    duration: clampDuration(input.duration),
    cfg_scale: input.cfgScale ?? 0.5,
    generate_audio: input.generateAudio ?? false,
    aspect_ratio: input.aspectRatio ?? "16:9",
  };

  if (imageUrl) {
    // image-to-video mode
    falInput.image_url = imageUrl;
    if (input.endImageUrl) {
      falInput.end_image_url = input.endImageUrl;
    }
  }

  return falInput;
}

function getEndpoint(quality: QualityTier, useImage: boolean): string {
  const tier = quality === "cinema" ? "pro" : "standard";
  if (useImage) {
    return FAL_ENDPOINTS.imageToVideo[tier];
  }
  return FAL_ENDPOINTS.textToVideo[tier];
}

// ─── Core subscribe call ──────────────────────────────────────

async function callFal(
  endpoint: string,
  falInput: Record<string, unknown>,
  start: number,
  onProgress?: ProgressCallback
): Promise<{ data: { video: { url: string; file_size: number } } }> {
  const result = await fal.subscribe(endpoint as never, {
    input: falInput,
    logs: true,
    onQueueUpdate: (update: { status: string; logs?: { message: string }[] }) => {
      const elapsedMs = Date.now() - start;
      if (update.status === "IN_QUEUE") {
        onProgress?.({ status: "IN_QUEUE", elapsedMs, logs: [] });
      } else if (update.status === "IN_PROGRESS") {
        const logs = (update.logs ?? []).map((log) => log.message);
        onProgress?.({ status: "IN_PROGRESS", elapsedMs, logs });
      }
    },
  } as never);
  return result as { data: { video: { url: string; file_size: number } } };
}

// ─── Generation ───────────────────────────────────────────────

async function generateReal(
  input: GenerateVideoInput,
  onProgress?: ProgressCallback
): Promise<GenerateVideoResult> {
  initFal();

  // Ensure image meets Kling's minimum dimensions (300x300)
  let imageUrl: string | undefined;
  if (input.startImageUrl) {
    imageUrl = await ensureMinImageSize(input.startImageUrl);
  }

  const useImage = !!imageUrl;
  const endpoint = getEndpoint(input.quality, useImage);
  const falInput = buildFalInput(input, imageUrl);
  const start = Date.now();

  console.log(`[kling] Generating via ${endpoint}`, {
    duration: falInput.duration,
    hasImage: useImage,
    audio: falInput.generate_audio,
    promptLength: input.prompt.length,
  });

  let result;
  try {
    result = await callFal(endpoint, falInput, start, onProgress);
  } catch (err: unknown) {
    const falErr = err as { status?: number; body?: unknown; message?: string };
    console.error(`[kling] fal.ai error:`, {
      status: falErr.status,
      body: JSON.stringify(falErr.body, null, 2),
      message: falErr.message,
    });
    throw err;
  }

  const elapsedMs = Date.now() - start;
  onProgress?.({ status: "COMPLETED", elapsedMs, logs: [] });

  const video = result.data.video;

  return {
    videoUrl: video.url,
    fileSize: video.file_size,
    durationMs: elapsedMs,
    isDryRun: false,
  };
}

// ─── Public API ────────────────────────────────────────────────

/**
 * Generate a video using Kling O3 via fal.ai.
 * Standard tier uses o3/standard, cinema tier uses o3/pro.
 * Automatically upscales small images to meet Kling's 300x300 minimum.
 */
export async function generateVideo(
  input: GenerateVideoInput,
  onProgress?: ProgressCallback
): Promise<GenerateVideoResult> {
  return generateReal(input, onProgress);
}

/**
 * Always live — no dry-run mode.
 */
export function isDryRunMode(): boolean {
  return false;
}
