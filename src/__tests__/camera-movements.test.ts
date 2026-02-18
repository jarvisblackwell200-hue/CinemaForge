import { describe, it, expect } from "vitest";
import { CAMERA_MOVEMENTS } from "@/lib/constants/camera-movements";

describe("camera movements database", () => {
  it("has at least 30 movements", () => {
    expect(CAMERA_MOVEMENTS.length).toBeGreaterThanOrEqual(30);
  });

  it("has unique IDs", () => {
    const ids = CAMERA_MOVEMENTS.map((m) => m.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it("covers all four categories", () => {
    const categories = new Set(CAMERA_MOVEMENTS.map((m) => m.category));
    expect(categories).toContain("establishing");
    expect(categories).toContain("character");
    expect(categories).toContain("action");
    expect(categories).toContain("transition");
  });

  it("every movement has required fields", () => {
    for (const m of CAMERA_MOVEMENTS) {
      expect(m.id, `${m.id}: missing id`).toBeTruthy();
      expect(m.name, `${m.id}: missing name`).toBeTruthy();
      expect(m.description, `${m.id}: missing description`).toBeTruthy();
      expect(m.bestFor, `${m.id}: missing bestFor`).toBeTruthy();
      expect(m.promptSyntax, `${m.id}: missing promptSyntax`).toBeTruthy();
      expect(m.minDuration, `${m.id}: missing minDuration`).toBeGreaterThanOrEqual(1);
      expect(m.examplePrompt, `${m.id}: missing examplePrompt`).toBeTruthy();
    }
  });

  it("orbit requires at least 10s minimum duration", () => {
    const orbit = CAMERA_MOVEMENTS.find((m) => m.id.includes("orbit"));
    expect(orbit).toBeDefined();
    expect(orbit!.minDuration).toBeGreaterThanOrEqual(10);
  });

  it("static shots have low minimum duration", () => {
    const staticShots = CAMERA_MOVEMENTS.filter((m) =>
      m.id.includes("static")
    );
    for (const s of staticShots) {
      expect(s.minDuration).toBeLessThanOrEqual(5);
    }
  });

  it("example prompts are descriptive (at least 50 chars)", () => {
    for (const m of CAMERA_MOVEMENTS) {
      expect(
        m.examplePrompt.length,
        `${m.id}: example too short (${m.examplePrompt.length} chars)`
      ).toBeGreaterThanOrEqual(50);
    }
  });

  it("promptSyntax starts with camera-related term", () => {
    // Prompt syntax should be usable as the first block in a Kling prompt
    for (const m of CAMERA_MOVEMENTS) {
      const lower = m.promptSyntax.toLowerCase();
      const startsWithCameraTerms =
        lower.startsWith("static") ||
        lower.startsWith("slow") ||
        lower.startsWith("crane") ||
        lower.startsWith("tracking") ||
        lower.startsWith("camera") ||
        lower.startsWith("handheld") ||
        lower.startsWith("rack") ||
        lower.startsWith("the camera") ||
        lower.startsWith("dutch") ||
        lower.startsWith("low") ||
        lower.startsWith("high") ||
        lower.startsWith("aerial") ||
        lower.startsWith("pov") ||
        lower.startsWith("over") ||
        lower.startsWith("whip") ||
        lower.startsWith("crash") ||
        lower.startsWith("dolly") ||
        lower.startsWith("truck") ||
        lower.startsWith("tilt") ||
        lower.startsWith("pan") ||
        lower.startsWith("pull") ||
        lower.startsWith("speed") ||
        lower.startsWith("macro") ||
        lower.startsWith("steadicam") ||
        lower.startsWith("fpv") ||
        lower.startsWith("bird") ||
        lower.startsWith("extreme") ||
        lower.startsWith("first") ||
        lower.startsWith("chase") ||
        lower.startsWith("fade") ||
        lower.startsWith("match") ||
        lower.startsWith("medium") ||
        lower.startsWith("shot");

      expect(
        startsWithCameraTerms,
        `${m.id}: promptSyntax "${m.promptSyntax}" doesn't start with a camera term`
      ).toBe(true);
    }
  });
});
