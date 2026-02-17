import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { GenerateVideoInput, GenerateVideoResult, GenerationProgress } from "@/lib/kling/client";

// ─── Timer setup ───────────────────────────────────────────────
// The dry-run simulation uses setTimeout delays (~3s total).
// We use fake timers to run tests instantly.

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

/**
 * Helper: call generateVideo and advance fake timers until it resolves.
 * We dynamically import the module so fake timers are active at call time.
 */
async function runGenerateVideo(
  input: GenerateVideoInput,
  onProgress?: (progress: GenerationProgress) => void
): Promise<GenerateVideoResult> {
  const { generateVideo } = await import("@/lib/kling/client");
  const promise = generateVideo(input, onProgress);
  // The dry-run does 6 steps with setTimeout(~500ms each = 3000ms total).
  // Advance timers enough to complete all steps.
  for (let i = 0; i < 10; i++) {
    await vi.advanceTimersByTimeAsync(600);
  }
  return promise;
}

// ─── isDryRunMode ──────────────────────────────────────────────

describe("isDryRunMode", () => {
  it("returns true by default (KLING_DRY_RUN not set to 'false')", async () => {
    const { isDryRunMode } = await import("@/lib/kling/client");
    expect(isDryRunMode()).toBe(true);
  });

  it("returns a boolean value", async () => {
    const { isDryRunMode } = await import("@/lib/kling/client");
    expect(typeof isDryRunMode()).toBe("boolean");
  });
});

// ─── Dry-run result shape ──────────────────────────────────────

describe("generateVideo (dry-run mode)", () => {
  const minimalInput: GenerateVideoInput = {
    prompt: "A detective walks through a foggy alley at night",
    duration: 5,
    quality: "draft",
  };

  it("returns correct shape with all required fields", async () => {
    const result = await runGenerateVideo(minimalInput);

    expect(result).toHaveProperty("videoUrl");
    expect(result).toHaveProperty("fileSize");
    expect(result).toHaveProperty("durationMs");
    expect(result).toHaveProperty("isDryRun");
  });

  it("returns isDryRun: true in dry-run mode", async () => {
    const result = await runGenerateVideo(minimalInput);
    expect(result.isDryRun).toBe(true);
  });

  it("returns a valid videoUrl string", async () => {
    const result = await runGenerateVideo(minimalInput);
    expect(typeof result.videoUrl).toBe("string");
    expect(result.videoUrl.length).toBeGreaterThan(0);
    expect(result.videoUrl).toMatch(/^https?:\/\//);
  });

  it("returns a positive fileSize", async () => {
    const result = await runGenerateVideo(minimalInput);
    expect(result.fileSize).toBeGreaterThan(0);
    expect(typeof result.fileSize).toBe("number");
  });

  it("returns a positive durationMs", async () => {
    const result = await runGenerateVideo(minimalInput);
    expect(result.durationMs).toBeGreaterThan(0);
    expect(typeof result.durationMs).toBe("number");
  });

  it("returns consistent mock URL across calls", async () => {
    const result1 = await runGenerateVideo(minimalInput);
    const result2 = await runGenerateVideo(minimalInput);
    expect(result1.videoUrl).toBe(result2.videoUrl);
  });

  it("returns consistent fileSize across calls", async () => {
    const result1 = await runGenerateVideo(minimalInput);
    const result2 = await runGenerateVideo(minimalInput);
    expect(result1.fileSize).toBe(result2.fileSize);
  });
});

// ─── Input parameter acceptance ────────────────────────────────

describe("generateVideo input parameters", () => {
  it("accepts minimal required input", async () => {
    const result = await runGenerateVideo({
      prompt: "A car driving down a highway",
      duration: 5,
      quality: "draft",
    });
    expect(result.isDryRun).toBe(true);
  });

  it("accepts all quality tiers without error", async () => {
    const qualities = ["draft", "standard", "cinema"] as const;
    for (const quality of qualities) {
      const result = await runGenerateVideo({
        prompt: "Test prompt",
        duration: 5,
        quality,
      });
      expect(result.isDryRun).toBe(true);
    }
  });

  it("accepts all aspect ratios without error", async () => {
    const ratios = ["16:9", "9:16", "1:1"] as const;
    for (const aspectRatio of ratios) {
      const result = await runGenerateVideo({
        prompt: "Test prompt",
        duration: 5,
        quality: "standard",
        aspectRatio,
      });
      expect(result.isDryRun).toBe(true);
    }
  });

  it("accepts negativePrompt parameter", async () => {
    const result = await runGenerateVideo({
      prompt: "A sunset over mountains",
      negativePrompt: "blur, distort, low quality",
      duration: 5,
      quality: "standard",
    });
    expect(result.isDryRun).toBe(true);
  });

  it("accepts generateAudio parameter", async () => {
    const result = await runGenerateVideo({
      prompt: "A person speaking",
      duration: 5,
      quality: "standard",
      generateAudio: true,
    });
    expect(result.isDryRun).toBe(true);
  });

  it("accepts cfgScale parameter", async () => {
    const result = await runGenerateVideo({
      prompt: "Test scene",
      duration: 5,
      quality: "draft",
      cfgScale: 0.7,
    });
    expect(result.isDryRun).toBe(true);
  });

  it("accepts startImageUrl for image-to-video", async () => {
    const result = await runGenerateVideo({
      prompt: "A character begins to walk",
      duration: 5,
      quality: "standard",
      startImageUrl: "https://example.com/start-frame.jpg",
    });
    expect(result.isDryRun).toBe(true);
  });

  it("accepts endImageUrl for continuity chaining", async () => {
    const result = await runGenerateVideo({
      prompt: "Scene continues from previous shot",
      duration: 5,
      quality: "standard",
      endImageUrl: "https://example.com/end-frame.jpg",
    });
    expect(result.isDryRun).toBe(true);
  });

  it("accepts elements for character consistency", async () => {
    const result = await runGenerateVideo({
      prompt: "@Detective walks into the room",
      duration: 5,
      quality: "cinema",
      elements: [
        { id: "elem-123", name: "Detective" },
        { id: "elem-456", name: "Witness" },
      ],
    });
    expect(result.isDryRun).toBe(true);
  });

  it("accepts full input with all optional parameters", async () => {
    const fullInput: GenerateVideoInput = {
      prompt: "A noir detective walks through rain-soaked streets",
      negativePrompt: "bright colors, cheerful, cartoon",
      duration: 8,
      aspectRatio: "16:9",
      quality: "cinema",
      generateAudio: true,
      cfgScale: 0.5,
      startImageUrl: "https://example.com/start.jpg",
      endImageUrl: "https://example.com/end.jpg",
      elements: [{ id: "elem-001", name: "Marcus" }],
    };
    const result = await runGenerateVideo(fullInput);
    expect(result.isDryRun).toBe(true);
    expect(result.videoUrl).toBeTruthy();
  });

  it("accepts various durations (3-15s range)", async () => {
    const durations = [3, 5, 8, 10, 15];
    for (const duration of durations) {
      const result = await runGenerateVideo({
        prompt: "Test",
        duration,
        quality: "draft",
      });
      expect(result.isDryRun).toBe(true);
    }
  });
});

// ─── onProgress callback ───────────────────────────────────────

describe("generateVideo onProgress callback", () => {
  it("calls onProgress callback during dry-run generation", async () => {
    const progressUpdates: GenerationProgress[] = [];
    const onProgress = (progress: GenerationProgress) => {
      progressUpdates.push({ ...progress });
    };

    await runGenerateVideo(
      { prompt: "Test prompt", duration: 5, quality: "draft" },
      onProgress
    );

    expect(progressUpdates.length).toBeGreaterThan(0);
  });

  it("emits COMPLETED as the final status", async () => {
    const progressUpdates: GenerationProgress[] = [];
    const onProgress = (progress: GenerationProgress) => {
      progressUpdates.push({ ...progress });
    };

    await runGenerateVideo(
      { prompt: "Test prompt", duration: 5, quality: "draft" },
      onProgress
    );

    const lastUpdate = progressUpdates[progressUpdates.length - 1];
    expect(lastUpdate.status).toBe("COMPLETED");
  });

  it("emits IN_PROGRESS status before COMPLETED", async () => {
    const statuses: string[] = [];
    const onProgress = (progress: GenerationProgress) => {
      statuses.push(progress.status);
    };

    await runGenerateVideo(
      { prompt: "Test prompt", duration: 5, quality: "draft" },
      onProgress
    );

    // There should be at least one IN_PROGRESS before COMPLETED
    const completedIndex = statuses.lastIndexOf("COMPLETED");
    const inProgressIndex = statuses.indexOf("IN_PROGRESS");
    expect(inProgressIndex).toBeGreaterThanOrEqual(0);
    expect(inProgressIndex).toBeLessThan(completedIndex);
  });

  it("provides increasing elapsedMs values", async () => {
    const elapsedValues: number[] = [];
    const onProgress = (progress: GenerationProgress) => {
      elapsedValues.push(progress.elapsedMs);
    };

    await runGenerateVideo(
      { prompt: "Test prompt", duration: 5, quality: "draft" },
      onProgress
    );

    // Each elapsed time should be >= the previous
    for (let i = 1; i < elapsedValues.length; i++) {
      expect(elapsedValues[i]).toBeGreaterThanOrEqual(elapsedValues[i - 1]);
    }
  });

  it("provides logs array in each progress update", async () => {
    const progressUpdates: GenerationProgress[] = [];
    const onProgress = (progress: GenerationProgress) => {
      progressUpdates.push({ ...progress });
    };

    await runGenerateVideo(
      { prompt: "Test prompt", duration: 5, quality: "draft" },
      onProgress
    );

    for (const update of progressUpdates) {
      expect(Array.isArray(update.logs)).toBe(true);
    }
  });

  it("includes dry-run marker in log messages", async () => {
    const allLogs: string[] = [];
    const onProgress = (progress: GenerationProgress) => {
      allLogs.push(...progress.logs);
    };

    await runGenerateVideo(
      { prompt: "Test prompt", duration: 5, quality: "draft" },
      onProgress
    );

    const hasDryRunLog = allLogs.some((log) => log.includes("dry-run"));
    expect(hasDryRunLog).toBe(true);
  });

  it("includes step progress in log messages", async () => {
    const allLogs: string[] = [];
    const onProgress = (progress: GenerationProgress) => {
      allLogs.push(...progress.logs);
    };

    await runGenerateVideo(
      { prompt: "Test prompt", duration: 5, quality: "draft" },
      onProgress
    );

    // Should have step indicators like "Step 1/6"
    const hasStepLog = allLogs.some((log) => /Step \d+\/\d+/.test(log));
    expect(hasStepLog).toBe(true);
  });

  it("works without onProgress callback (undefined)", async () => {
    // Should not throw when no callback is provided
    const result = await runGenerateVideo({
      prompt: "Test prompt",
      duration: 5,
      quality: "draft",
    });
    expect(result.isDryRun).toBe(true);
  });

  it("emits exactly 6 progress updates in dry-run mode", async () => {
    const progressUpdates: GenerationProgress[] = [];
    const onProgress = (progress: GenerationProgress) => {
      progressUpdates.push({ ...progress });
    };

    await runGenerateVideo(
      { prompt: "Test prompt", duration: 5, quality: "draft" },
      onProgress
    );

    expect(progressUpdates.length).toBe(6);
  });

  it("emits 5 IN_PROGRESS and 1 COMPLETED in dry-run mode", async () => {
    const statuses: string[] = [];
    const onProgress = (progress: GenerationProgress) => {
      statuses.push(progress.status);
    };

    await runGenerateVideo(
      { prompt: "Test prompt", duration: 5, quality: "draft" },
      onProgress
    );

    const inProgressCount = statuses.filter((s) => s === "IN_PROGRESS").length;
    const completedCount = statuses.filter((s) => s === "COMPLETED").length;
    expect(inProgressCount).toBe(5);
    expect(completedCount).toBe(1);
  });

  it("each progress update has a valid status enum value", async () => {
    const validStatuses = new Set(["IN_QUEUE", "IN_PROGRESS", "COMPLETED"]);
    const progressUpdates: GenerationProgress[] = [];
    const onProgress = (progress: GenerationProgress) => {
      progressUpdates.push({ ...progress });
    };

    await runGenerateVideo(
      { prompt: "Test prompt", duration: 5, quality: "draft" },
      onProgress
    );

    for (const update of progressUpdates) {
      expect(validStatuses.has(update.status)).toBe(true);
    }
  });
});
