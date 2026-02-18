import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock fetch for kie.ai API ──────────────────────────────
let capturedRequests: { url: string; body: Record<string, unknown> }[] = [];
let pollState = "success";
let pollResultJson = JSON.stringify({ resultUrls: ["https://kie.ai/mock-video.mp4"] });

const mockFetch = vi.fn(async (url: string, opts?: RequestInit) => {
  const urlStr = typeof url === "string" ? url : "";

  if (urlStr.includes("/jobs/createTask")) {
    const body = JSON.parse(opts?.body as string);
    capturedRequests.push({ url: urlStr, body });
    return {
      ok: true,
      json: async () => ({ code: 200, msg: "success", data: { taskId: "task-mock-123" } }),
    };
  }

  if (urlStr.includes("/jobs/recordInfo")) {
    return {
      ok: true,
      json: async () => ({
        code: 200,
        message: "success",
        data: {
          taskId: "task-mock-123",
          state: pollState,
          resultJson: pollState === "success" ? pollResultJson : null,
          failCode: pollState === "fail" ? "500" : "",
          failMsg: pollState === "fail" ? "test failure" : "",
          costTime: 5000,
          createTime: Date.now(),
          updateTime: Date.now(),
        },
      }),
    };
  }

  // Fallback for image fetching (ensureMinImageSize)
  return {
    ok: true,
    arrayBuffer: async () => new ArrayBuffer(1024),
  };
}) as unknown as typeof fetch;

globalThis.fetch = mockFetch;

// Mock sharp
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

import { generateVideo } from "@/lib/kling/client";
import type { GenerateVideoInput } from "@/lib/kling/client";

beforeEach(() => {
  capturedRequests = [];
  pollState = "success";
  pollResultJson = JSON.stringify({ resultUrls: ["https://kie.ai/mock-video.mp4"] });
  process.env.KIE_API_KEY = "test-key";
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://mock.supabase.co";
  process.env.SUPABASE_SECRET_KEY = "mock-secret";
});

// ─── Request construction ───────────────────────────────────

describe("kie.ai request construction", () => {
  it("sends model kling-3.0/video", async () => {
    await generateVideo({ prompt: "Test", duration: 5, quality: "draft" });
    expect(capturedRequests[0].body.model).toBe("kling-3.0/video");
  });

  it("sends prompt in input", async () => {
    await generateVideo({ prompt: "A detective walks", duration: 5, quality: "draft" });
    expect(capturedRequests[0].body.input).toHaveProperty("prompt", "A detective walks");
  });

  it("uses std mode for draft quality", async () => {
    await generateVideo({ prompt: "Test", duration: 5, quality: "draft" });
    expect((capturedRequests[0].body.input as Record<string, unknown>).mode).toBe("std");
  });

  it("uses std mode for standard quality", async () => {
    await generateVideo({ prompt: "Test", duration: 5, quality: "standard" });
    expect((capturedRequests[0].body.input as Record<string, unknown>).mode).toBe("std");
  });

  it("uses pro mode for cinema quality", async () => {
    await generateVideo({ prompt: "Test", duration: 5, quality: "cinema" });
    expect((capturedRequests[0].body.input as Record<string, unknown>).mode).toBe("pro");
  });

  it("defaults sound to false", async () => {
    await generateVideo({ prompt: "Test", duration: 5, quality: "draft" });
    expect((capturedRequests[0].body.input as Record<string, unknown>).sound).toBe(false);
  });

  it("enables sound when generateAudio is true", async () => {
    await generateVideo({ prompt: "Test", duration: 5, quality: "draft", generateAudio: true });
    expect((capturedRequests[0].body.input as Record<string, unknown>).sound).toBe(true);
  });

  it("defaults aspect_ratio to 16:9", async () => {
    await generateVideo({ prompt: "Test", duration: 5, quality: "draft" });
    expect((capturedRequests[0].body.input as Record<string, unknown>).aspect_ratio).toBe("16:9");
  });

  it("passes custom aspect_ratio", async () => {
    await generateVideo({ prompt: "Test", duration: 5, quality: "draft", aspectRatio: "9:16" });
    expect((capturedRequests[0].body.input as Record<string, unknown>).aspect_ratio).toBe("9:16");
  });

  it("sets multi_shots to false for single generation", async () => {
    await generateVideo({ prompt: "Test", duration: 5, quality: "draft" });
    expect((capturedRequests[0].body.input as Record<string, unknown>).multi_shots).toBe(false);
  });
});

// ─── Duration clamping ──────────────────────────────────────

describe("duration clamping", () => {
  it("clamps minimum to 3", async () => {
    await generateVideo({ prompt: "Test", duration: 1, quality: "draft" });
    expect((capturedRequests[0].body.input as Record<string, unknown>).duration).toBe("3");
  });

  it("clamps maximum to 15", async () => {
    await generateVideo({ prompt: "Test", duration: 20, quality: "draft" });
    expect((capturedRequests[0].body.input as Record<string, unknown>).duration).toBe("15");
  });

  it("rounds fractional durations", async () => {
    await generateVideo({ prompt: "Test", duration: 5.7, quality: "draft" });
    expect((capturedRequests[0].body.input as Record<string, unknown>).duration).toBe("6");
  });

  it("passes valid duration as string", async () => {
    await generateVideo({ prompt: "Test", duration: 8, quality: "draft" });
    expect((capturedRequests[0].body.input as Record<string, unknown>).duration).toBe("8");
  });
});

// ─── Image-to-video ─────────────────────────────────────────

describe("image-to-video mode", () => {
  it("includes image_urls when startImageUrl is provided", async () => {
    await generateVideo({
      prompt: "Test",
      duration: 5,
      quality: "draft",
      startImageUrl: "https://example.com/image.jpg",
    });
    const input = capturedRequests[0].body.input as Record<string, unknown>;
    expect(input.image_urls).toBeTruthy();
    expect((input.image_urls as string[]).length).toBeGreaterThanOrEqual(1);
  });

  it("includes both start and end images when provided", async () => {
    await generateVideo({
      prompt: "Test",
      duration: 5,
      quality: "draft",
      startImageUrl: "https://example.com/start.jpg",
      endImageUrl: "https://example.com/end.jpg",
    });
    const input = capturedRequests[0].body.input as Record<string, unknown>;
    expect((input.image_urls as string[]).length).toBe(2);
  });

  it("omits image_urls for text-to-video mode", async () => {
    await generateVideo({ prompt: "Test", duration: 5, quality: "draft" });
    const input = capturedRequests[0].body.input as Record<string, unknown>;
    expect(input.image_urls).toBeUndefined();
  });
});

// ─── Elements (character consistency) ───────────────────────

describe("character elements", () => {
  it("passes kling_elements when elements are provided", async () => {
    await generateVideo({
      prompt: "A @element_detective walks through an alley",
      duration: 5,
      quality: "draft",
      elements: [
        {
          name: "element_detective",
          description: "a tall man in a trench coat",
          element_input_urls: [
            "https://example.com/ref1.jpg",
            "https://example.com/ref2.jpg",
          ],
        },
      ],
    });
    const input = capturedRequests[0].body.input as Record<string, unknown>;
    expect(input.kling_elements).toBeTruthy();
    const elements = input.kling_elements as { name: string }[];
    expect(elements).toHaveLength(1);
    expect(elements[0].name).toBe("element_detective");
  });

  it("omits kling_elements when no elements provided", async () => {
    await generateVideo({ prompt: "Test", duration: 5, quality: "draft" });
    const input = capturedRequests[0].body.input as Record<string, unknown>;
    expect(input.kling_elements).toBeUndefined();
  });
});

// ─── Result shape ───────────────────────────────────────────

describe("generateVideo result", () => {
  it("returns correct shape", async () => {
    const result = await generateVideo({ prompt: "Test", duration: 5, quality: "draft" });
    expect(result).toHaveProperty("videoUrl");
    expect(result).toHaveProperty("fileSize");
    expect(result).toHaveProperty("durationMs");
    expect(result).toHaveProperty("taskId");
  });

  it("returns videoUrl from kie.ai response", async () => {
    const result = await generateVideo({ prompt: "Test", duration: 5, quality: "draft" });
    expect(result.videoUrl).toBe("https://kie.ai/mock-video.mp4");
  });

  it("returns taskId from kie.ai response", async () => {
    const result = await generateVideo({ prompt: "Test", duration: 5, quality: "draft" });
    expect(result.taskId).toBe("task-mock-123");
  });

  it("returns positive durationMs", async () => {
    const result = await generateVideo({ prompt: "Test", duration: 5, quality: "draft" });
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });
});

// ─── Full payload verification ──────────────────────────────

describe("full payload verification", () => {
  it("constructs complete text-to-video payload", async () => {
    const input: GenerateVideoInput = {
      prompt: "A noir detective walks through rain",
      duration: 8,
      aspectRatio: "16:9",
      quality: "cinema",
      generateAudio: true,
    };

    await generateVideo(input);

    const reqInput = capturedRequests[0].body.input as Record<string, unknown>;
    expect(reqInput).toMatchObject({
      prompt: "A noir detective walks through rain",
      duration: "8",
      sound: true,
      aspect_ratio: "16:9",
      mode: "pro",
      multi_shots: false,
    });
    expect(reqInput.image_urls).toBeUndefined();
    expect(reqInput.kling_elements).toBeUndefined();
  });

  it("constructs complete image-to-video payload with elements", async () => {
    await generateVideo({
      prompt: "@element_char walks forward",
      duration: 5,
      aspectRatio: "9:16",
      quality: "standard",
      generateAudio: false,
      startImageUrl: "https://example.com/ref.jpg",
      elements: [{
        name: "element_char",
        description: "a woman in a red dress",
        element_input_urls: ["https://example.com/ref1.jpg", "https://example.com/ref2.jpg"],
      }],
    });

    const reqInput = capturedRequests[0].body.input as Record<string, unknown>;
    expect(reqInput).toMatchObject({
      prompt: "@element_char walks forward",
      duration: "5",
      sound: false,
      aspect_ratio: "9:16",
      mode: "std",
      multi_shots: false,
    });
    expect(reqInput.image_urls).toBeTruthy();
    expect(reqInput.kling_elements).toHaveLength(1);
  });
});
