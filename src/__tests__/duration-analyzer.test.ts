import { describe, it, expect } from "vitest";
import { analyzeDuration } from "@/lib/ai/duration-analyzer";
import type { ScriptAnalysis } from "@/types/movie";

function makeAnalysis(overrides?: Partial<ScriptAnalysis>): ScriptAnalysis {
  return {
    synopsis: "Test story.",
    genre: "noir",
    suggestedDuration: 60,
    scenes: [
      {
        title: "Scene 1",
        location: "Office",
        timeOfDay: "night",
        beats: [
          { description: "Beat 1", emotionalTone: "dramatic" },
          { description: "Beat 2", emotionalTone: "tense" },
        ],
      },
    ],
    characters: [],
    styleSuggestions: {
      genre: "noir",
      filmStock: "35mm",
      colorPalette: "teal",
      textures: ["grain"],
      negativePrompt: "bright",
    },
    estimatedShots: 2,
    estimatedCredits: 20,
    ...overrides,
  };
}

describe("analyzeDuration", () => {
  it("3-beat no-dialogue story → optimal ~15s", () => {
    const analysis = makeAnalysis({
      scenes: [
        {
          title: "Scene 1",
          location: "Park",
          timeOfDay: "morning",
          beats: [
            { description: "Beat 1", emotionalTone: "hopeful" },
            { description: "Beat 2", emotionalTone: "hopeful" },
            { description: "Beat 3", emotionalTone: "hopeful" },
          ],
        },
      ],
    });
    const result = analyzeDuration(analysis, 15);
    // 3 beats × 5s base + 0 bias = 15s optimal
    expect(result.optimalDuration).toBe(15);
  });

  it("10-beat story with dialogue → optimal ~60-70s", () => {
    const beats = Array.from({ length: 10 }, (_, i) => ({
      description: `Beat ${i}`,
      emotionalTone: "dramatic" as const,
      dialogue: i % 2 === 0 ? [{ character: "A", line: "Hello", emotion: "calm" }] : undefined,
    }));
    const analysis = makeAnalysis({
      scenes: [{ title: "S1", location: "L", timeOfDay: "night", beats }],
    });
    const result = analyzeDuration(analysis, 65);
    // 5 dialogue beats × 7s + 5 visual beats × 5s + bias (dramatic = +1 each) = 35 + 25 + 10 = 70
    expect(result.optimalDuration).toBeGreaterThanOrEqual(60);
    expect(result.optimalDuration).toBeLessThanOrEqual(75);
  });

  it("fitScore = 100 when target ≈ optimal", () => {
    const analysis = makeAnalysis({
      scenes: [
        {
          title: "S1",
          location: "L",
          timeOfDay: "night",
          beats: [
            { description: "Beat 1", emotionalTone: "hopeful" },
            { description: "Beat 2", emotionalTone: "hopeful" },
          ],
        },
      ],
    });
    // 2 beats × 5s + 0 bias = 10s optimal
    const r = analyzeDuration(analysis, 10);
    expect(r.fitScore).toBe(100);
  });

  it("fitScore = 100 when target is within ±15% of optimal", () => {
    // 2 beats × 5s = 10s optimal. 15% = 1.5s → 8.5–11.5 should be 100
    const analysis = makeAnalysis({
      scenes: [
        {
          title: "S1",
          location: "L",
          timeOfDay: "night",
          beats: [
            { description: "Beat 1", emotionalTone: "hopeful" },
            { description: "Beat 2", emotionalTone: "hopeful" },
          ],
        },
      ],
    });
    const r11 = analyzeDuration(analysis, 11);
    expect(r11.fitScore).toBe(100);
  });

  it("fitScore < 50 when target is a third of the optimal", () => {
    // 10 beats × 5s = 50s optimal, target = 15s → deviation = 70%
    const beats = Array.from({ length: 10 }, (_, i) => ({
      description: `Beat ${i}`,
      emotionalTone: "hopeful" as const,
    }));
    const analysis = makeAnalysis({
      scenes: [{ title: "S1", location: "L", timeOfDay: "night", beats }],
    });
    const r = analyzeDuration(analysis, 15);
    expect(r.fitScore).toBeLessThan(50);
  });

  it("suggestion is null when fitScore ≥ 70", () => {
    const analysis = makeAnalysis({
      scenes: [
        {
          title: "S1",
          location: "L",
          timeOfDay: "night",
          beats: [
            { description: "Beat 1", emotionalTone: "hopeful" },
            { description: "Beat 2", emotionalTone: "hopeful" },
          ],
        },
      ],
    });
    // optimal = 10, target = 10 → fitScore = 100
    const r = analyzeDuration(analysis, 10);
    expect(r.fitScore).toBeGreaterThanOrEqual(70);
    expect(r.suggestion).toBeNull();
  });

  it("suggestion is non-null when fitScore < 70", () => {
    // 10 beats × 5s = 50s optimal, target = 20s → big mismatch
    const beats = Array.from({ length: 10 }, (_, i) => ({
      description: `Beat ${i}`,
      emotionalTone: "hopeful" as const,
    }));
    const analysis = makeAnalysis({
      scenes: [{ title: "S1", location: "L", timeOfDay: "night", beats }],
    });
    const r = analyzeDuration(analysis, 20);
    expect(r.fitScore).toBeLessThan(70);
    expect(r.suggestion).not.toBeNull();
    expect(r.suggestion).toContain("naturally fits");
  });

  it("minViableDuration is 60% of optimal", () => {
    const analysis = makeAnalysis({
      scenes: [
        {
          title: "S1",
          location: "L",
          timeOfDay: "night",
          beats: Array.from({ length: 10 }, (_, i) => ({
            description: `Beat ${i}`,
            emotionalTone: "hopeful" as const,
          })),
        },
      ],
    });
    const r = analyzeDuration(analysis, 50);
    expect(r.minViableDuration).toBe(Math.round(r.optimalDuration * 0.6));
  });

  it("maxComfortDuration is 140% of optimal", () => {
    const analysis = makeAnalysis({
      scenes: [
        {
          title: "S1",
          location: "L",
          timeOfDay: "night",
          beats: Array.from({ length: 10 }, (_, i) => ({
            description: `Beat ${i}`,
            emotionalTone: "hopeful" as const,
          })),
        },
      ],
    });
    const r = analyzeDuration(analysis, 50);
    expect(r.maxComfortDuration).toBe(Math.round(r.optimalDuration * 1.4));
  });

  it("breakdown has one entry per scene", () => {
    const analysis = makeAnalysis({
      scenes: [
        {
          title: "S1",
          location: "L1",
          timeOfDay: "night",
          beats: [{ description: "B1", emotionalTone: "dramatic" }],
        },
        {
          title: "S2",
          location: "L2",
          timeOfDay: "morning",
          beats: [
            { description: "B2", emotionalTone: "hopeful" },
            { description: "B3", emotionalTone: "hopeful" },
          ],
        },
      ],
    });
    const r = analyzeDuration(analysis, 30);
    expect(r.breakdown).toHaveLength(2);
    expect(r.breakdown[0].sceneIndex).toBe(0);
    expect(r.breakdown[0].beats).toBe(1);
    expect(r.breakdown[1].sceneIndex).toBe(1);
    expect(r.breakdown[1].beats).toBe(2);
  });

  it("handles empty scenes array", () => {
    const analysis = makeAnalysis({ scenes: [] });
    const r = analyzeDuration(analysis, 60);
    expect(r.optimalDuration).toBe(0);
    expect(r.breakdown).toHaveLength(0);
  });
});
