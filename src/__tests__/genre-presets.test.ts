import { describe, it, expect } from "vitest";
import { GENRE_PRESETS } from "@/lib/constants/genre-presets";
import { CAMERA_MOVEMENTS } from "@/lib/constants/camera-movements";

describe("genre presets", () => {
  it("has at least 5 presets", () => {
    expect(GENRE_PRESETS.length).toBeGreaterThanOrEqual(5);
  });

  it("has unique IDs", () => {
    const ids = GENRE_PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every preset has a complete style bible", () => {
    for (const preset of GENRE_PRESETS) {
      expect(preset.styleBible.filmStock, `${preset.id}: missing filmStock`).toBeTruthy();
      expect(preset.styleBible.colorPalette, `${preset.id}: missing colorPalette`).toBeTruthy();
      expect(preset.styleBible.textures.length, `${preset.id}: empty textures`).toBeGreaterThan(0);
      expect(preset.styleBible.negativePrompt, `${preset.id}: missing negativePrompt`).toBeTruthy();
      expect(preset.styleBible.styleString, `${preset.id}: missing styleString`).toBeTruthy();
    }
  });

  it("styleString ends with 4K", () => {
    for (const preset of GENRE_PRESETS) {
      expect(
        preset.styleBible.styleString.includes("4K"),
        `${preset.id}: styleString should include 4K`
      ).toBe(true);
    }
  });

  it("camera preferences reference valid movement IDs", () => {
    const validIds = new Set(CAMERA_MOVEMENTS.map((m) => m.id));
    for (const preset of GENRE_PRESETS) {
      for (const camId of preset.cameraPreferences) {
        expect(
          validIds.has(camId),
          `${preset.id}: camera preference "${camId}" is not a valid movement ID`
        ).toBe(true);
      }
    }
  });

  it("has reasonable average shot durations", () => {
    for (const preset of GENRE_PRESETS) {
      expect(preset.avgShotDuration).toBeGreaterThanOrEqual(3);
      expect(preset.avgShotDuration).toBeLessThanOrEqual(10);
    }
  });

  it("noir and horror have slow pacing", () => {
    const noir = GENRE_PRESETS.find((p) => p.id === "noir");
    const horror = GENRE_PRESETS.find((p) => p.id === "horror");
    expect(noir?.pacing).toBe("slow");
    expect(horror?.pacing).toBe("slow");
  });

  it("negative prompts exclude positive/bright for dark genres", () => {
    const noir = GENRE_PRESETS.find((p) => p.id === "noir")!;
    const horror = GENRE_PRESETS.find((p) => p.id === "horror")!;
    expect(noir.styleBible.negativePrompt).toMatch(/bright|sunny|cheerful/i);
    expect(horror.styleBible.negativePrompt).toMatch(/bright|colorful|happy/i);
  });
});
