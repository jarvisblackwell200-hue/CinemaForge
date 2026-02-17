import { fal } from "@fal-ai/client";
import type { QualityTier } from "./types";

// ─── Configuration ─────────────────────────────────────────────

const DRY_RUN = process.env.KLING_DRY_RUN !== "false"; // default: dry-run ON

const FAL_ENDPOINTS = {
  textToVideo: {
    standard: "fal-ai/kling-video/v3/standard/text-to-video",
    pro: "fal-ai/kling-video/v3/pro/text-to-video",
  },
  imageToVideo: {
    standard: "fal-ai/kling-video/v3/standard/image-to-video",
    pro: "fal-ai/kling-video/v3/pro/image-to-video",
  },
} as const;

// ─── Types ─────────────────────────────────────────────────────

export interface GenerateVideoInput {
  prompt: string;
  negativePrompt?: string;
  duration: number; // 3–15 seconds
  aspectRatio?: "16:9" | "9:16" | "1:1";
  quality: QualityTier;
  generateAudio?: boolean;
  cfgScale?: number;
  /** For image-to-video: start frame URL */
  startImageUrl?: string;
  /** For continuity chaining: end frame from previous shot */
  endImageUrl?: string;
  /** Kling Elements for character consistency */
  elements?: { id: string; name: string }[];
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

// ─── Mock for dry-run mode ─────────────────────────────────────

const MOCK_VIDEO_URL =
  "https://storage.googleapis.com/falserverless/example_outputs/kling-v3/standard-i2v/out.mp4";

async function generateDryRun(
  input: GenerateVideoInput,
  onProgress?: ProgressCallback
): Promise<GenerateVideoResult> {
  const totalMs = 3000; // simulate 3 second generation
  const steps = 6;
  const stepMs = totalMs / steps;

  for (let i = 0; i < steps; i++) {
    await new Promise((r) => setTimeout(r, stepMs));
    onProgress?.({
      status: i < steps - 1 ? "IN_PROGRESS" : "COMPLETED",
      elapsedMs: (i + 1) * stepMs,
      logs: [`[dry-run] Step ${i + 1}/${steps}`],
    });
  }

  return {
    videoUrl: MOCK_VIDEO_URL,
    fileSize: 3_149_129,
    durationMs: totalMs,
    isDryRun: true,
  };
}

// ─── Real fal.ai generation ────────────────────────────────────

function initFal() {
  const key = process.env.FAL_KEY;
  if (!key) throw new Error("FAL_KEY environment variable is not set");
  fal.config({ credentials: key });
}

function getEndpoint(
  input: GenerateVideoInput
): string {
  const tier = input.quality === "cinema" ? "pro" : "standard";
  if (input.startImageUrl) {
    return FAL_ENDPOINTS.imageToVideo[tier];
  }
  return FAL_ENDPOINTS.textToVideo[tier];
}

function buildFalInput(input: GenerateVideoInput): Record<string, unknown> {
  const falInput: Record<string, unknown> = {
    prompt: input.prompt,
    duration: String(input.duration),
    aspect_ratio: input.aspectRatio ?? "16:9",
    negative_prompt: input.negativePrompt ?? "blur, distort, low quality",
    cfg_scale: input.cfgScale ?? 0.5,
    generate_audio: input.generateAudio ?? false,
  };

  if (input.startImageUrl) {
    falInput.start_image_url = input.startImageUrl;
  }
  if (input.endImageUrl) {
    falInput.end_image_url = input.endImageUrl;
  }
  if (input.elements?.length) {
    falInput.elements = input.elements.map((el) => ({
      id: el.id,
      name: el.name,
    }));
  }

  return falInput;
}

async function generateReal(
  input: GenerateVideoInput,
  onProgress?: ProgressCallback
): Promise<GenerateVideoResult> {
  initFal();

  const endpoint = getEndpoint(input);
  const falInput = buildFalInput(input);
  const start = Date.now();

  const result = await fal.subscribe(endpoint, {
    input: falInput,
    logs: true,
    onQueueUpdate: (update) => {
      const elapsedMs = Date.now() - start;
      if (update.status === "IN_QUEUE") {
        onProgress?.({ status: "IN_QUEUE", elapsedMs, logs: [] });
      } else if (update.status === "IN_PROGRESS") {
        const logs = (update.logs ?? []).map(
          (log: { message: string }) => log.message
        );
        onProgress?.({ status: "IN_PROGRESS", elapsedMs, logs });
      }
    },
  });

  const elapsedMs = Date.now() - start;
  onProgress?.({ status: "COMPLETED", elapsedMs, logs: [] });

  const video = (result.data as { video: { url: string; file_size: number } })
    .video;

  return {
    videoUrl: video.url,
    fileSize: video.file_size,
    durationMs: elapsedMs,
    isDryRun: false,
  };
}

// ─── Public API ────────────────────────────────────────────────

/**
 * Generate a video from a prompt using Kling 3.0 via fal.ai.
 * In dry-run mode (default), returns a mock video URL after a short delay.
 * Set KLING_DRY_RUN=false in .env to use the real API.
 */
export async function generateVideo(
  input: GenerateVideoInput,
  onProgress?: ProgressCallback
): Promise<GenerateVideoResult> {
  if (DRY_RUN) {
    return generateDryRun(input, onProgress);
  }
  return generateReal(input, onProgress);
}

/**
 * Check if we're in dry-run mode.
 */
export function isDryRunMode(): boolean {
  return DRY_RUN;
}
