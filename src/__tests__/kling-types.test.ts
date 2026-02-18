import { describe, it, expect } from "vitest";
import { qualityToKieMode } from "@/lib/kling/types";
import type {
  QualityTier,
  KieMode,
  KieModel,
  KieAspectRatio,
  KieElement,
  KieCreateTaskRequest,
  KieTaskState,
  KieWebhookPayload,
} from "@/lib/kling/types";

// ─── qualityToKieMode ───────────────────────────────────────

describe("qualityToKieMode", () => {
  it("maps 'draft' to 'std'", () => {
    expect(qualityToKieMode("draft")).toBe("std");
  });

  it("maps 'standard' to 'std'", () => {
    expect(qualityToKieMode("standard")).toBe("std");
  });

  it("maps 'cinema' to 'pro'", () => {
    expect(qualityToKieMode("cinema")).toBe("pro");
  });

  it("returns only valid KieMode values", () => {
    const validModes: KieMode[] = ["std", "pro"];
    const qualities: QualityTier[] = ["draft", "standard", "cinema"];

    for (const quality of qualities) {
      const mode = qualityToKieMode(quality);
      expect(validModes).toContain(mode);
    }
  });

  it("cinema is the only tier that maps to 'pro' mode", () => {
    expect(qualityToKieMode("cinema")).toBe("pro");
    expect(qualityToKieMode("draft")).not.toBe("pro");
    expect(qualityToKieMode("standard")).not.toBe("pro");
  });

  it("both 'draft' and 'standard' map to 'std'", () => {
    expect(qualityToKieMode("draft")).toBe(qualityToKieMode("standard"));
  });

  it("returns a string value", () => {
    const qualities: QualityTier[] = ["draft", "standard", "cinema"];
    for (const quality of qualities) {
      expect(typeof qualityToKieMode(quality)).toBe("string");
    }
  });
});

// ─── Type structure validation ──────────────────────────────

describe("kie.ai type definitions", () => {
  it("KieCreateTaskRequest can be constructed with required fields", () => {
    const request: KieCreateTaskRequest = {
      model: "kling-3.0/video",
      input: {
        prompt: "A cityscape at sunset",
        sound: false,
        duration: "5",
        mode: "std",
        multi_shots: false,
      },
    };

    expect(request.model).toBe("kling-3.0/video");
    expect(request.input.prompt).toBe("A cityscape at sunset");
    expect(request.input.sound).toBe(false);
    expect(request.input.duration).toBe("5");
    expect(request.input.mode).toBe("std");
  });

  it("KieCreateTaskRequest supports optional fields", () => {
    const request: KieCreateTaskRequest = {
      model: "kling-3.0/video",
      callBackUrl: "https://example.com/webhook",
      input: {
        prompt: "Test prompt",
        sound: true,
        duration: "8",
        aspect_ratio: "16:9",
        mode: "pro",
        multi_shots: false,
        image_urls: ["https://example.com/frame.jpg"],
        kling_elements: [
          {
            name: "element_detective",
            description: "a tall man",
            element_input_urls: ["https://example.com/ref1.jpg", "https://example.com/ref2.jpg"],
          },
        ],
      },
    };

    expect(request.callBackUrl).toBe("https://example.com/webhook");
    expect(request.input.image_urls).toHaveLength(1);
    expect(request.input.kling_elements).toHaveLength(1);
    expect(request.input.kling_elements![0].name).toBe("element_detective");
  });

  it("KieTaskState covers all lifecycle states", () => {
    const states: KieTaskState[] = ["waiting", "queuing", "generating", "success", "fail"];

    for (const state of states) {
      expect(typeof state).toBe("string");
    }
    expect(states).toHaveLength(5);
  });

  it("KieElement supports element reference with multiple images", () => {
    const element: KieElement = {
      name: "element_detective",
      description: "Detective Marcus, tall man in trench coat",
      element_input_urls: [
        "https://example.com/ref1.jpg",
        "https://example.com/ref2.jpg",
        "https://example.com/ref3.jpg",
      ],
    };

    expect(element.name).toBe("element_detective");
    expect(element.element_input_urls).toHaveLength(3);
  });

  it("KieAspectRatio includes standard cinematic ratios", () => {
    const ratios: KieAspectRatio[] = ["16:9", "9:16", "1:1"];

    for (const ratio of ratios) {
      const request: KieCreateTaskRequest = {
        model: "kling-3.0/video",
        input: {
          prompt: "Test",
          sound: false,
          duration: "5",
          mode: "std",
          multi_shots: false,
          aspect_ratio: ratio,
        },
      };
      expect(request.input.aspect_ratio).toBe(ratio);
    }
  });

  it("KieModel includes 3.0 and 2.6 versions", () => {
    const models: KieModel[] = [
      "kling-3.0/video",
      "kling-2.6/text-to-video",
      "kling-2.6/image-to-video",
    ];

    for (const model of models) {
      expect(typeof model).toBe("string");
    }
  });

  it("KieWebhookPayload can represent success", () => {
    const payload: KieWebhookPayload = {
      code: 200,
      msg: "Video generated successfully.",
      data: {
        taskId: "task-123",
        info: {
          resultUrls: ["https://example.com/video.mp4"],
        },
        fallbackFlag: false,
      },
    };

    expect(payload.code).toBe(200);
    expect(payload.data.info?.resultUrls).toHaveLength(1);
  });

  it("KieWebhookPayload can represent failure", () => {
    const payload: KieWebhookPayload = {
      code: 501,
      msg: "Generation failed",
      data: {
        taskId: "task-456",
        fallbackFlag: false,
      },
    };

    expect(payload.code).toBe(501);
    expect(payload.data.info).toBeUndefined();
  });

  it("KieCreateTaskRequest supports multi-shot mode", () => {
    const request: KieCreateTaskRequest = {
      model: "kling-3.0/video",
      input: {
        sound: true,
        duration: "10",
        mode: "pro",
        multi_shots: true,
        multi_prompt: [
          { prompt: "Wide establishing shot of a city", duration: 4 },
          { prompt: "Medium shot of a detective walking", duration: 3 },
          { prompt: "Close-up of detective's face", duration: 3 },
        ],
      },
    };

    expect(request.input.multi_shots).toBe(true);
    expect(request.input.multi_prompt).toHaveLength(3);
    expect(request.input.prompt).toBeUndefined();
  });
});
