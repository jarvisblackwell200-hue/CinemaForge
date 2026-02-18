import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock fal.ai client ─────────────────────────────────────────
// We capture the arguments passed to fal.subscribe to verify buildFalInput()
// without needing to export internal helpers.

let capturedEndpoint: string | undefined;
let capturedInput: Record<string, unknown> | undefined;

vi.mock("@fal-ai/client", () => ({
  fal: {
    config: vi.fn(),
    subscribe: vi.fn(async (endpoint: string, opts: { input: Record<string, unknown> }) => {
      capturedEndpoint = endpoint;
      capturedInput = opts.input;
      return {
        data: {
          video: {
            url: "https://fal.ai/mock-video.mp4",
            file_size: 1_000_000,
          },
        },
      };
    }),
  },
}));

// Mock sharp to avoid actual image processing
vi.mock("sharp", () => {
  const mockSharp = vi.fn(() => ({
    metadata: vi.fn(async () => ({ width: 1024, height: 768 })),
    resize: vi.fn().mockReturnThis(),
    jpeg: vi.fn().mockReturnThis(),
    toBuffer: vi.fn(async () => Buffer.from("mock")),
  }));
  return { default: mockSharp };
});

// Mock Supabase
vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn(async () => ({ error: null })),
        getPublicUrl: vi.fn(() => ({ data: { publicUrl: "https://mock/upscaled.jpg" } })),
      })),
    },
  })),
}));

import { generateVideo, isDryRunMode } from "@/lib/kling/client";
import type { GenerateVideoInput } from "@/lib/kling/client";

beforeEach(() => {
  capturedEndpoint = undefined;
  capturedInput = undefined;
  // Set required env vars
  process.env.FAL_KEY = "test-key";
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://mock.supabase.co";
  process.env.SUPABASE_SECRET_KEY = "mock-secret";
});

// ─── isDryRunMode ────────────────────────────────────────────────

describe("isDryRunMode", () => {
  it("returns false (dry-run mode removed)", () => {
    expect(isDryRunMode()).toBe(false);
  });
});

// ─── Endpoint selection ──────────────────────────────────────────

describe("endpoint selection", () => {
  it("uses text-to-video/standard for draft quality without image", async () => {
    await generateVideo({ prompt: "Test", duration: 5, quality: "draft" });
    expect(capturedEndpoint).toBe("fal-ai/kling-video/o3/standard/text-to-video");
  });

  it("uses text-to-video/pro for cinema quality without image", async () => {
    await generateVideo({ prompt: "Test", duration: 5, quality: "cinema" });
    expect(capturedEndpoint).toBe("fal-ai/kling-video/o3/pro/text-to-video");
  });

  it("uses text-to-video/standard for standard quality without image", async () => {
    await generateVideo({ prompt: "Test", duration: 5, quality: "standard" });
    expect(capturedEndpoint).toBe("fal-ai/kling-video/o3/standard/text-to-video");
  });

  it("uses image-to-video/standard for draft quality with image", async () => {
    await generateVideo({
      prompt: "Test",
      duration: 5,
      quality: "draft",
      startImageUrl: "https://example.com/image.jpg",
    });
    expect(capturedEndpoint).toBe("fal-ai/kling-video/o3/standard/image-to-video");
  });

  it("uses image-to-video/pro for cinema quality with image", async () => {
    await generateVideo({
      prompt: "Test",
      duration: 5,
      quality: "cinema",
      startImageUrl: "https://example.com/image.jpg",
    });
    expect(capturedEndpoint).toBe("fal-ai/kling-video/o3/pro/image-to-video");
  });
});

// ─── buildFalInput: negative_prompt (Fix #1) ─────────────────────

describe("buildFalInput — negative_prompt", () => {
  it("passes negative_prompt to fal.ai payload", async () => {
    await generateVideo({
      prompt: "A sunset",
      negativePrompt: "blur, noise, artifacts",
      duration: 5,
      quality: "draft",
    });
    expect(capturedInput?.negative_prompt).toBe("blur, noise, artifacts");
  });

  it("sends undefined negative_prompt when not provided", async () => {
    await generateVideo({ prompt: "A sunset", duration: 5, quality: "draft" });
    expect(capturedInput?.negative_prompt).toBeUndefined();
  });
});

// ─── buildFalInput: cfg_scale (Fix #2) ──────────────────────────

describe("buildFalInput — cfg_scale", () => {
  it("defaults cfg_scale to 0.5 when not provided", async () => {
    await generateVideo({ prompt: "Test", duration: 5, quality: "draft" });
    expect(capturedInput?.cfg_scale).toBe(0.5);
  });

  it("passes custom cfg_scale when provided", async () => {
    await generateVideo({ prompt: "Test", duration: 5, quality: "draft", cfgScale: 0.7 });
    expect(capturedInput?.cfg_scale).toBe(0.7);
  });
});

// ─── buildFalInput: aspect_ratio (Fix #3) ───────────────────────

describe("buildFalInput — aspect_ratio", () => {
  it("defaults aspect_ratio to 16:9 for text-to-video", async () => {
    await generateVideo({ prompt: "Test", duration: 5, quality: "draft" });
    expect(capturedInput?.aspect_ratio).toBe("16:9");
  });

  it("passes custom aspect_ratio for text-to-video", async () => {
    await generateVideo({ prompt: "Test", duration: 5, quality: "draft", aspectRatio: "9:16" });
    expect(capturedInput?.aspect_ratio).toBe("9:16");
  });

  it("includes aspect_ratio for image-to-video mode (Fix #3)", async () => {
    await generateVideo({
      prompt: "Test",
      duration: 5,
      quality: "draft",
      startImageUrl: "https://example.com/image.jpg",
      aspectRatio: "1:1",
    });
    expect(capturedInput?.aspect_ratio).toBe("1:1");
  });

  it("defaults aspect_ratio to 16:9 for image-to-video mode", async () => {
    await generateVideo({
      prompt: "Test",
      duration: 5,
      quality: "draft",
      startImageUrl: "https://example.com/image.jpg",
    });
    expect(capturedInput?.aspect_ratio).toBe("16:9");
  });
});

// ─── buildFalInput: other fields ────────────────────────────────

describe("buildFalInput — core fields", () => {
  it("includes prompt in payload", async () => {
    await generateVideo({ prompt: "A detective walks", duration: 5, quality: "draft" });
    expect(capturedInput?.prompt).toBe("A detective walks");
  });

  it("clamps duration to string within 3-15 range", async () => {
    await generateVideo({ prompt: "Test", duration: 1, quality: "draft" });
    expect(capturedInput?.duration).toBe("3");

    await generateVideo({ prompt: "Test", duration: 20, quality: "draft" });
    expect(capturedInput?.duration).toBe("15");

    await generateVideo({ prompt: "Test", duration: 8, quality: "draft" });
    expect(capturedInput?.duration).toBe("8");
  });

  it("rounds fractional durations", async () => {
    await generateVideo({ prompt: "Test", duration: 5.7, quality: "draft" });
    expect(capturedInput?.duration).toBe("6");
  });

  it("defaults generate_audio to false", async () => {
    await generateVideo({ prompt: "Test", duration: 5, quality: "draft" });
    expect(capturedInput?.generate_audio).toBe(false);
  });

  it("passes generate_audio when true", async () => {
    await generateVideo({ prompt: "Test", duration: 5, quality: "draft", generateAudio: true });
    expect(capturedInput?.generate_audio).toBe(true);
  });
});

// ─── Image-to-video specific fields ─────────────────────────────

describe("buildFalInput — image-to-video", () => {
  it("sets image_url for image-to-video mode", async () => {
    await generateVideo({
      prompt: "Test",
      duration: 5,
      quality: "draft",
      startImageUrl: "https://example.com/image.jpg",
    });
    expect(capturedInput?.image_url).toBeTruthy();
  });

  it("does not set image_url for text-to-video mode", async () => {
    await generateVideo({ prompt: "Test", duration: 5, quality: "draft" });
    expect(capturedInput?.image_url).toBeUndefined();
  });

  it("sets end_image_url when endImageUrl provided with startImageUrl", async () => {
    await generateVideo({
      prompt: "Test",
      duration: 5,
      quality: "draft",
      startImageUrl: "https://example.com/start.jpg",
      endImageUrl: "https://example.com/end.jpg",
    });
    expect(capturedInput?.end_image_url).toBe("https://example.com/end.jpg");
  });
});

// ─── Result shape ────────────────────────────────────────────────

describe("generateVideo result", () => {
  it("returns correct shape", async () => {
    const result = await generateVideo({ prompt: "Test", duration: 5, quality: "draft" });
    expect(result).toHaveProperty("videoUrl");
    expect(result).toHaveProperty("fileSize");
    expect(result).toHaveProperty("durationMs");
    expect(result).toHaveProperty("isDryRun");
  });

  it("returns isDryRun: false for live generation", async () => {
    const result = await generateVideo({ prompt: "Test", duration: 5, quality: "draft" });
    expect(result.isDryRun).toBe(false);
  });

  it("returns videoUrl from fal.ai response", async () => {
    const result = await generateVideo({ prompt: "Test", duration: 5, quality: "draft" });
    expect(result.videoUrl).toBe("https://fal.ai/mock-video.mp4");
  });

  it("returns fileSize from fal.ai response", async () => {
    const result = await generateVideo({ prompt: "Test", duration: 5, quality: "draft" });
    expect(result.fileSize).toBe(1_000_000);
  });

  it("returns positive durationMs", async () => {
    const result = await generateVideo({ prompt: "Test", duration: 5, quality: "draft" });
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });
});

// ─── Full payload snapshot ──────────────────────────────────────

describe("buildFalInput — full payload verification", () => {
  it("constructs complete text-to-video payload with all options", async () => {
    const input: GenerateVideoInput = {
      prompt: "A noir detective walks through rain",
      negativePrompt: "bright, cheerful",
      duration: 8,
      aspectRatio: "16:9",
      quality: "cinema",
      generateAudio: true,
      cfgScale: 0.6,
    };

    await generateVideo(input);

    expect(capturedInput).toMatchObject({
      prompt: "A noir detective walks through rain",
      negative_prompt: "bright, cheerful",
      duration: "8",
      cfg_scale: 0.6,
      generate_audio: true,
      aspect_ratio: "16:9",
    });
    expect(capturedInput?.image_url).toBeUndefined();
  });

  it("constructs complete image-to-video payload with all options", async () => {
    await generateVideo({
      prompt: "Character starts walking",
      negativePrompt: "blur",
      duration: 5,
      aspectRatio: "9:16",
      quality: "standard",
      generateAudio: false,
      cfgScale: 0.4,
      startImageUrl: "https://example.com/ref.jpg",
      endImageUrl: "https://example.com/end.jpg",
    });

    expect(capturedInput).toMatchObject({
      prompt: "Character starts walking",
      negative_prompt: "blur",
      duration: "5",
      cfg_scale: 0.4,
      generate_audio: false,
      aspect_ratio: "9:16",
      end_image_url: "https://example.com/end.jpg",
    });
    expect(capturedInput?.image_url).toBeTruthy();
  });
});
