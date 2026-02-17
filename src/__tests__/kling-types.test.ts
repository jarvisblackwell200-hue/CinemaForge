import { describe, it, expect } from "vitest";
import {
  qualityToKlingMode,
  qualityToResolution,
} from "@/lib/kling/types";
import type {
  QualityTier,
  KlingMode,
  KlingModel,
  KlingAspectRatio,
  KlingGenerateRequest,
  KlingTaskStatus,
  KlingElement,
} from "@/lib/kling/types";

// ─── qualityToKlingMode ────────────────────────────────────────

describe("qualityToKlingMode", () => {
  it("maps 'draft' to 'standard'", () => {
    expect(qualityToKlingMode("draft")).toBe("standard");
  });

  it("maps 'standard' to 'professional'", () => {
    expect(qualityToKlingMode("standard")).toBe("professional");
  });

  it("maps 'cinema' to 'professional'", () => {
    expect(qualityToKlingMode("cinema")).toBe("professional");
  });

  it("returns only valid KlingMode values", () => {
    const validModes: KlingMode[] = ["standard", "professional"];
    const qualities: QualityTier[] = ["draft", "standard", "cinema"];

    for (const quality of qualities) {
      const mode = qualityToKlingMode(quality);
      expect(validModes).toContain(mode);
    }
  });

  it("draft is the only tier that maps to 'standard' mode", () => {
    expect(qualityToKlingMode("draft")).toBe("standard");
    expect(qualityToKlingMode("standard")).not.toBe("standard");
    expect(qualityToKlingMode("cinema")).not.toBe("standard");
  });

  it("both 'standard' and 'cinema' map to 'professional'", () => {
    expect(qualityToKlingMode("standard")).toBe(qualityToKlingMode("cinema"));
  });

  it("returns a string value", () => {
    const qualities: QualityTier[] = ["draft", "standard", "cinema"];
    for (const quality of qualities) {
      expect(typeof qualityToKlingMode(quality)).toBe("string");
    }
  });
});

// ─── qualityToResolution ───────────────────────────────────────

describe("qualityToResolution", () => {
  it("maps 'draft' to '720p'", () => {
    expect(qualityToResolution("draft")).toBe("720p");
  });

  it("maps 'standard' to '1080p'", () => {
    expect(qualityToResolution("standard")).toBe("1080p");
  });

  it("maps 'cinema' to '4K'", () => {
    expect(qualityToResolution("cinema")).toBe("4K");
  });

  it("returns a string for all quality tiers", () => {
    const qualities: QualityTier[] = ["draft", "standard", "cinema"];
    for (const quality of qualities) {
      expect(typeof qualityToResolution(quality)).toBe("string");
    }
  });

  it("each quality tier maps to a unique resolution", () => {
    const resolutions = new Set([
      qualityToResolution("draft"),
      qualityToResolution("standard"),
      qualityToResolution("cinema"),
    ]);
    expect(resolutions.size).toBe(3);
  });

  it("resolution increases with quality tier", () => {
    // Extract numeric resolution for comparison
    const draftRes = qualityToResolution("draft");
    const standardRes = qualityToResolution("standard");
    const cinemaRes = qualityToResolution("cinema");

    // Parse numeric portions: 720, 1080, 4000 (4K)
    const parseRes = (res: string): number => {
      if (res === "4K") return 4000;
      return parseInt(res.replace("p", ""), 10);
    };

    expect(parseRes(draftRes)).toBeLessThan(parseRes(standardRes));
    expect(parseRes(standardRes)).toBeLessThan(parseRes(cinemaRes));
  });

  it("draft resolution is 720p (HD)", () => {
    expect(qualityToResolution("draft")).toContain("720");
  });

  it("standard resolution is 1080p (Full HD)", () => {
    expect(qualityToResolution("standard")).toContain("1080");
  });

  it("cinema resolution contains '4K'", () => {
    expect(qualityToResolution("cinema")).toContain("4K");
  });
});

// ─── Quality tier and mode relationship ────────────────────────

describe("quality tier mapping consistency", () => {
  it("draft quality uses standard mode and lowest resolution", () => {
    expect(qualityToKlingMode("draft")).toBe("standard");
    expect(qualityToResolution("draft")).toBe("720p");
  });

  it("standard quality uses professional mode and mid resolution", () => {
    expect(qualityToKlingMode("standard")).toBe("professional");
    expect(qualityToResolution("standard")).toBe("1080p");
  });

  it("cinema quality uses professional mode and highest resolution", () => {
    expect(qualityToKlingMode("cinema")).toBe("professional");
    expect(qualityToResolution("cinema")).toBe("4K");
  });

  it("higher quality tiers never downgrade mode or resolution", () => {
    const tiers: QualityTier[] = ["draft", "standard", "cinema"];
    const modeRank: Record<KlingMode, number> = { standard: 0, professional: 1 };

    for (let i = 1; i < tiers.length; i++) {
      const prevMode = qualityToKlingMode(tiers[i - 1]);
      const currMode = qualityToKlingMode(tiers[i]);
      expect(modeRank[currMode]).toBeGreaterThanOrEqual(modeRank[prevMode]);
    }
  });
});

// ─── Type structure validation ─────────────────────────────────

describe("Kling type definitions", () => {
  it("KlingGenerateRequest can be constructed with required fields", () => {
    const request: KlingGenerateRequest = {
      model: "kling-v3",
      mode: "professional",
      prompt: "A cityscape at sunset",
      duration: 5,
      aspect_ratio: "16:9",
    };

    expect(request.model).toBe("kling-v3");
    expect(request.mode).toBe("professional");
    expect(request.prompt).toBe("A cityscape at sunset");
    expect(request.duration).toBe(5);
    expect(request.aspect_ratio).toBe("16:9");
  });

  it("KlingGenerateRequest supports optional fields", () => {
    const request: KlingGenerateRequest = {
      model: "kling-v3",
      mode: "standard",
      prompt: "Test prompt",
      duration: 5,
      aspect_ratio: "16:9",
      negative_prompt: "blur, noise",
      camera_control: "dolly-push-in",
      start_frame_url: "https://example.com/frame.jpg",
      subject_reference: [
        { element_id: "elem-1", face_reference_strength: 75 },
      ],
      creativity: 0.5,
    };

    expect(request.negative_prompt).toBe("blur, noise");
    expect(request.camera_control).toBe("dolly-push-in");
    expect(request.start_frame_url).toBe("https://example.com/frame.jpg");
    expect(request.subject_reference).toHaveLength(1);
    expect(request.subject_reference![0].face_reference_strength).toBe(75);
    expect(request.creativity).toBe(0.5);
  });

  it("KlingTaskStatus represents all possible states", () => {
    const states: KlingTaskStatus["status"][] = [
      "pending",
      "processing",
      "completed",
      "failed",
    ];

    for (const status of states) {
      const task: KlingTaskStatus = {
        task_id: "task-123",
        status,
        created_at: "2026-01-01T00:00:00Z",
      };
      expect(task.status).toBe(status);
    }
  });

  it("KlingTaskStatus completed state includes video_url", () => {
    const completedTask: KlingTaskStatus = {
      task_id: "task-456",
      status: "completed",
      progress: 100,
      video_url: "https://cdn.kling.ai/video.mp4",
      thumbnail_url: "https://cdn.kling.ai/thumb.jpg",
      created_at: "2026-01-01T00:00:00Z",
      completed_at: "2026-01-01T00:01:30Z",
    };

    expect(completedTask.video_url).toBeTruthy();
    expect(completedTask.thumbnail_url).toBeTruthy();
    expect(completedTask.completed_at).toBeTruthy();
  });

  it("KlingTaskStatus failed state includes error_message", () => {
    const failedTask: KlingTaskStatus = {
      task_id: "task-789",
      status: "failed",
      error_message: "Content policy violation",
      created_at: "2026-01-01T00:00:00Z",
    };

    expect(failedTask.error_message).toBe("Content policy violation");
  });

  it("KlingElement supports character and object types", () => {
    const character: KlingElement = {
      element_id: "elem-1",
      name: "Detective Marcus",
      type: "character",
      status: "active",
      reference_images: ["https://example.com/ref1.jpg"],
    };

    const object: KlingElement = {
      element_id: "elem-2",
      name: "Vintage Car",
      type: "object",
      status: "active",
      reference_images: ["https://example.com/car.jpg"],
    };

    expect(character.type).toBe("character");
    expect(object.type).toBe("object");
  });

  it("KlingElement statuses cover all lifecycle states", () => {
    const statuses: KlingElement["status"][] = ["active", "processing", "failed"];

    for (const status of statuses) {
      const element: KlingElement = {
        element_id: "elem-test",
        name: "Test",
        type: "character",
        status,
        reference_images: [],
      };
      expect(element.status).toBe(status);
    }
  });

  it("KlingAspectRatio includes standard cinematic ratios", () => {
    const ratios: KlingAspectRatio[] = ["16:9", "9:16", "1:1", "21:9"];

    // Verify the type accepts all these values
    for (const ratio of ratios) {
      const request: KlingGenerateRequest = {
        model: "kling-v3",
        mode: "standard",
        prompt: "Test",
        duration: 5,
        aspect_ratio: ratio,
      };
      expect(request.aspect_ratio).toBe(ratio);
    }
  });

  it("KlingModel includes v2 and v3 versions", () => {
    const models: KlingModel[] = ["kling-v3", "kling-v2"];

    for (const model of models) {
      const request: KlingGenerateRequest = {
        model,
        mode: "standard",
        prompt: "Test",
        duration: 5,
        aspect_ratio: "16:9",
      };
      expect(request.model).toBe(model);
    }
  });
});
