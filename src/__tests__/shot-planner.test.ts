import { describe, it, expect } from "vitest";
import { planShotsFromScript, pickLighting, simpleHash, seededRandom, compoundCameraForDuration, getDurationBias } from "@/lib/ai/shot-planner";
import type { ScriptAnalysis, StyleBible } from "@/types/movie";
import { GENRE_PRESETS } from "@/lib/constants/genre-presets";
import { CAMERA_MOVEMENTS } from "@/lib/constants/camera-movements";

// ─── Test data ──────────────────────────────────────────────────

const characters = [
  {
    id: "char-1",
    name: "Marcus",
    role: "protagonist",
    visualDescription: "A weathered man in his 50s with a gray trenchcoat and stubble",
    referenceImages: [],
  },
  {
    id: "char-2",
    name: "Elena",
    role: "supporting",
    visualDescription: "A young woman with dark hair, red scarf, and intense eyes",
    referenceImages: [],
  },
];

const styleBible: StyleBible = {
  filmStock: "shot on 35mm film",
  colorPalette: "desaturated teal grade",
  textures: ["film grain", "shallow depth of field"],
  negativePrompt: "bright colors, sunny, cheerful",
  styleString: "Desaturated teal grade, crushed blacks, shot on 35mm film, heavy grain. 4K.",
};

function makeAnalysis(overrides?: Partial<ScriptAnalysis>): ScriptAnalysis {
  return {
    synopsis: "A detective searches for the truth.",
    genre: "noir",
    suggestedDuration: 60,
    scenes: [
      {
        title: "The Office",
        location: "Dimly lit detective office",
        timeOfDay: "night",
        beats: [
          {
            description: "Marcus sits at his desk, staring at old case files",
            emotionalTone: "melancholic",
          },
          {
            description: "Marcus stands and walks to the window, looking out at the rain",
            emotionalTone: "reflective",
          },
        ],
      },
      {
        title: "The Alley",
        location: "Rain-soaked back alley",
        timeOfDay: "night",
        beats: [
          {
            description: "Marcus meets Elena under a flickering streetlight",
            emotionalTone: "tense",
          },
          {
            description: "Elena hands Marcus an envelope",
            emotionalTone: "mysterious",
            dialogue: [
              { character: "Elena", line: "You didn't get this from me.", emotion: "nervous" },
            ],
          },
        ],
      },
    ],
    characters: [
      { name: "Marcus", role: "protagonist", suggestedVisualDescription: "Weathered detective" },
      { name: "Elena", role: "supporting", suggestedVisualDescription: "Mysterious informant" },
    ],
    styleSuggestions: {
      genre: "noir",
      filmStock: "35mm",
      colorPalette: "desaturated teal",
      textures: ["film grain"],
      negativePrompt: "bright, cheerful",
    },
    estimatedShots: 4,
    estimatedCredits: 40,
    ...overrides,
  };
}

const noirPreset = GENRE_PRESETS.find((g) => g.id === "noir") ?? null;
const validMovementIds = new Set(CAMERA_MOVEMENTS.map((m) => m.id));

// ─── Basic output structure ─────────────────────────────────────

describe("planShotsFromScript — output structure", () => {
  it("returns one shot per beat", () => {
    const analysis = makeAnalysis();
    const shots = planShotsFromScript(analysis, characters, styleBible, noirPreset);
    // 2 beats in scene 1 + 2 beats in scene 2 = 4 shots
    expect(shots).toHaveLength(4);
  });

  it("assigns sequential order values starting at 0", () => {
    const shots = planShotsFromScript(makeAnalysis(), characters, styleBible, noirPreset);
    for (let i = 0; i < shots.length; i++) {
      expect(shots[i].order).toBe(i);
    }
  });

  it("assigns correct sceneIndex to each shot", () => {
    const shots = planShotsFromScript(makeAnalysis(), characters, styleBible, noirPreset);
    // First 2 shots belong to scene 0, last 2 to scene 1
    expect(shots[0].sceneIndex).toBe(0);
    expect(shots[1].sceneIndex).toBe(0);
    expect(shots[2].sceneIndex).toBe(1);
    expect(shots[3].sceneIndex).toBe(1);
  });

  it("every shot has all required fields", () => {
    const shots = planShotsFromScript(makeAnalysis(), characters, styleBible, noirPreset);
    for (const shot of shots) {
      expect(shot).toHaveProperty("sceneIndex");
      expect(shot).toHaveProperty("order");
      expect(shot).toHaveProperty("shotType");
      expect(shot).toHaveProperty("cameraMovement");
      expect(shot).toHaveProperty("subject");
      expect(shot).toHaveProperty("action");
      expect(shot).toHaveProperty("environment");
      expect(shot).toHaveProperty("lighting");
      expect(shot).toHaveProperty("durationSeconds");
      expect(shot).toHaveProperty("generatedPrompt");
      expect(shot).toHaveProperty("negativePrompt");
    }
  });
});

// ─── Camera movement selection ──────────────────────────────────

describe("planShotsFromScript — camera movements", () => {
  it("uses valid camera movement IDs", () => {
    const shots = planShotsFromScript(makeAnalysis(), characters, styleBible, noirPreset);
    for (const shot of shots) {
      expect(validMovementIds.has(shot.cameraMovement)).toBe(true);
    }
  });

  it("forces an establishing movement for the first beat of the first scene", () => {
    const establishingIds = new Set(["static-wide", "crane-up-reveal", "aerial-drone", "slow-dolly-forward"]);
    // Run multiple times since there's randomness
    for (let i = 0; i < 10; i++) {
      const shots = planShotsFromScript(makeAnalysis(), characters, styleBible, noirPreset);
      expect(establishingIds.has(shots[0].cameraMovement)).toBe(true);
    }
  });

  it("avoids repeating the same movement consecutively", () => {
    // With 4+ shots there should be variety. Run a few times.
    for (let trial = 0; trial < 5; trial++) {
      const shots = planShotsFromScript(makeAnalysis(), characters, styleBible, noirPreset);
      let consecutiveRepeats = 0;
      for (let i = 1; i < shots.length; i++) {
        if (shots[i].cameraMovement === shots[i - 1].cameraMovement) {
          consecutiveRepeats++;
        }
      }
      // Allow at most 1 repeat out of 3 transitions (randomness can cause occasional repeats)
      expect(consecutiveRepeats).toBeLessThanOrEqual(1);
    }
  });
});

// ─── Duration constraints ───────────────────────────────────────

describe("planShotsFromScript — duration", () => {
  it("all shot durations are between 3 and 12 seconds", () => {
    const shots = planShotsFromScript(makeAnalysis(), characters, styleBible, noirPreset);
    for (const shot of shots) {
      expect(shot.durationSeconds).toBeGreaterThanOrEqual(3);
      expect(shot.durationSeconds).toBeLessThanOrEqual(12);
    }
  });

  it("non-orbit shots are capped at 10 seconds", () => {
    const shots = planShotsFromScript(makeAnalysis(), characters, styleBible, noirPreset);
    for (const shot of shots) {
      if (shot.cameraMovement !== "orbit-360") {
        expect(shot.durationSeconds).toBeLessThanOrEqual(10);
      }
    }
  });

  it("respects minimum duration from camera movement", () => {
    const shots = planShotsFromScript(makeAnalysis(), characters, styleBible, noirPreset);
    for (const shot of shots) {
      const movement = CAMERA_MOVEMENTS.find((m) => m.id === shot.cameraMovement);
      if (movement) {
        expect(shot.durationSeconds).toBeGreaterThanOrEqual(movement.minDuration);
      }
    }
  });
});

// ─── Dialogue handling ──────────────────────────────────────────

describe("planShotsFromScript — dialogue", () => {
  it("creates dialogue object for beats with dialogue", () => {
    const shots = planShotsFromScript(makeAnalysis(), characters, styleBible, noirPreset);
    // Beat at index 3 (scene 1, beat 1) has dialogue
    const dialogueShot = shots[3];
    expect(dialogueShot.dialogue).not.toBeNull();
    expect(dialogueShot.dialogue?.characterName).toBe("Elena");
    expect(dialogueShot.dialogue?.line).toBe("You didn't get this from me.");
    expect(dialogueShot.dialogue?.emotion).toBe("nervous");
  });

  it("sets null dialogue for beats without dialogue", () => {
    const shots = planShotsFromScript(makeAnalysis(), characters, styleBible, noirPreset);
    expect(shots[0].dialogue).toBeNull();
    expect(shots[1].dialogue).toBeNull();
  });

  it("matches dialogue character to character ID", () => {
    const shots = planShotsFromScript(makeAnalysis(), characters, styleBible, noirPreset);
    const dialogueShot = shots[3];
    expect(dialogueShot.dialogue?.characterId).toBe("char-2"); // Elena
  });

  it("prefers dialogue-focused movements for dialogue beats", () => {
    const dialogueMovements = new Set(["ots-dialogue", "shot-reverse-shot", "static-medium", "static-close-up"]);
    let dialogueMovementCount = 0;
    const trials = 15;

    for (let i = 0; i < trials; i++) {
      const shots = planShotsFromScript(makeAnalysis(), characters, styleBible, noirPreset);
      if (dialogueMovements.has(shots[3].cameraMovement)) {
        dialogueMovementCount++;
      }
    }
    // Should use dialogue movements most of the time
    expect(dialogueMovementCount).toBeGreaterThan(trials * 0.4);
  });
});

// ─── Subject building ───────────────────────────────────────────

describe("planShotsFromScript — subjects", () => {
  it("includes character visual descriptions when character mentioned in beat", () => {
    const shots = planShotsFromScript(makeAnalysis(), characters, styleBible, noirPreset);
    // Beat 0 mentions "Marcus"
    expect(shots[0].subject).toContain("Marcus");
    expect(shots[0].subject).toContain("trenchcoat");
  });

  it("includes both characters when both mentioned", () => {
    const shots = planShotsFromScript(makeAnalysis(), characters, styleBible, noirPreset);
    // Beat 2 mentions both Marcus and Elena
    expect(shots[2].subject).toContain("Marcus");
    expect(shots[2].subject).toContain("Elena");
  });

  it("uses dialogue character for subject when not mentioned in description", () => {
    const analysis = makeAnalysis({
      scenes: [
        {
          title: "Test",
          location: "Office",
          timeOfDay: "night",
          beats: [
            {
              description: "Someone speaks from the shadows",
              emotionalTone: "mysterious",
              dialogue: [{ character: "Elena", line: "Over here.", emotion: "whispered" }],
            },
          ],
        },
      ],
    });
    const shots = planShotsFromScript(analysis, characters, styleBible, noirPreset);
    expect(shots[0].subject).toContain("Elena");
  });

  it("falls back to location when no characters match", () => {
    const analysis = makeAnalysis({
      scenes: [
        {
          title: "Empty room",
          location: "Abandoned warehouse",
          timeOfDay: "night",
          beats: [{ description: "Wind blows through broken windows", emotionalTone: "ominous" }],
        },
      ],
    });
    const shots = planShotsFromScript(analysis, characters, styleBible, noirPreset);
    expect(shots[0].subject).toBe("Abandoned warehouse");
  });
});

// ─── Prompt assembly ────────────────────────────────────────────

describe("planShotsFromScript — prompt assembly", () => {
  it("generates non-empty generatedPrompt for every shot", () => {
    const shots = planShotsFromScript(makeAnalysis(), characters, styleBible, noirPreset);
    for (const shot of shots) {
      expect(shot.generatedPrompt.length).toBeGreaterThan(50);
    }
  });

  it("includes style bible in generated prompts", () => {
    const shots = planShotsFromScript(makeAnalysis(), characters, styleBible, noirPreset);
    for (const shot of shots) {
      expect(shot.generatedPrompt).toContain("Desaturated teal");
    }
  });

  it("generates non-empty negativePrompt for every shot", () => {
    const shots = planShotsFromScript(makeAnalysis(), characters, styleBible, noirPreset);
    for (const shot of shots) {
      expect(shot.negativePrompt.length).toBeGreaterThan(0);
    }
  });

  it("includes environment (location + time) in prompts", () => {
    const shots = planShotsFromScript(makeAnalysis(), characters, styleBible, noirPreset);
    expect(shots[0].environment).toContain("detective office");
    expect(shots[0].environment).toContain("night");
  });

  it("includes lighting in prompts", () => {
    const shots = planShotsFromScript(makeAnalysis(), characters, styleBible, noirPreset);
    for (const shot of shots) {
      expect(shot.lighting).toBeTruthy();
      expect(shot.lighting!.length).toBeGreaterThan(0);
    }
  });
});

// ─── Edge cases ─────────────────────────────────────────────────

describe("planShotsFromScript — edge cases", () => {
  it("handles empty scenes array", () => {
    const analysis = makeAnalysis({ scenes: [] });
    const shots = planShotsFromScript(analysis, characters, styleBible, noirPreset);
    expect(shots).toHaveLength(0);
  });

  it("handles scene with single beat", () => {
    const analysis = makeAnalysis({
      scenes: [
        {
          title: "Solo",
          location: "Park bench",
          timeOfDay: "morning",
          beats: [{ description: "Marcus sits alone", emotionalTone: "sad" }],
        },
      ],
    });
    const shots = planShotsFromScript(analysis, characters, styleBible, noirPreset);
    expect(shots).toHaveLength(1);
    expect(shots[0].order).toBe(0);
    expect(shots[0].sceneIndex).toBe(0);
  });

  it("works without genre preset", () => {
    const shots = planShotsFromScript(makeAnalysis(), characters, styleBible, null);
    expect(shots.length).toBeGreaterThan(0);
    for (const shot of shots) {
      expect(shot.generatedPrompt).toBeTruthy();
    }
  });

  it("works without style bible", () => {
    const shots = planShotsFromScript(makeAnalysis(), characters, null, noirPreset);
    expect(shots.length).toBeGreaterThan(0);
    for (const shot of shots) {
      expect(shot.generatedPrompt).toBeTruthy();
    }
  });

  it("works with no characters", () => {
    const shots = planShotsFromScript(makeAnalysis(), [], styleBible, noirPreset);
    expect(shots.length).toBeGreaterThan(0);
  });

  it("handles unknown emotional tone gracefully", () => {
    const analysis = makeAnalysis({
      scenes: [
        {
          title: "Test",
          location: "Unknown",
          timeOfDay: "day",
          beats: [
            { description: "Something happens", emotionalTone: "flabbergasted" },
          ],
        },
      ],
    });
    const shots = planShotsFromScript(analysis, [], styleBible, noirPreset);
    expect(shots).toHaveLength(1);
    expect(shots[0].cameraMovement).toBeTruthy();
  });

  it("handles many scenes without crashing", () => {
    const scenes = Array.from({ length: 20 }, (_, i) => ({
      title: `Scene ${i}`,
      location: `Location ${i}`,
      timeOfDay: "night",
      beats: [
        { description: `Something happens in scene ${i}`, emotionalTone: "dramatic" },
        { description: `Another thing in scene ${i}`, emotionalTone: "tense" },
      ],
    }));
    const analysis = makeAnalysis({ scenes });
    const shots = planShotsFromScript(analysis, characters, styleBible, noirPreset);
    expect(shots).toHaveLength(40);
    // All orders should be unique and sequential
    const orders = shots.map((s) => s.order);
    expect(new Set(orders).size).toBe(40);
  });
});

// ─── Tone-to-camera mapping ─────────────────────────────────────

describe("planShotsFromScript — tone mapping", () => {
  const tones = [
    "tense", "melancholic", "hopeful", "exciting", "mysterious",
    "dramatic", "peaceful", "fearful", "angry", "sad",
    "romantic", "suspenseful", "triumphant", "chaotic", "reflective", "ominous",
  ];

  for (const tone of tones) {
    it(`produces valid shots for "${tone}" tone`, () => {
      const analysis = makeAnalysis({
        scenes: [
          {
            title: "Tone test",
            location: "Test location",
            timeOfDay: "night",
            beats: [
              // First beat with neutral tone to avoid establishing shot interference
              { description: "Opening shot", emotionalTone: "dramatic" },
              { description: `A moment of ${tone} intensity`, emotionalTone: tone },
            ],
          },
        ],
      });
      const shots = planShotsFromScript(analysis, [], styleBible, noirPreset);
      expect(shots).toHaveLength(2);
      expect(validMovementIds.has(shots[1].cameraMovement)).toBe(true);
    });
  }
});

// ─── Deterministic lighting ─────────────────────────────────────

describe("pickLighting — deterministic per scene", () => {
  it("returns identical lighting for the same scene across multiple calls", () => {
    const result1 = pickLighting(noirPreset, "night", 0);
    const result2 = pickLighting(noirPreset, "night", 0);
    const result3 = pickLighting(noirPreset, "night", 0);
    expect(result1).toBe(result2);
    expect(result2).toBe(result3);
  });

  it("returns identical lighting for multiple invocations (stability check)", () => {
    const results = Array.from({ length: 20 }, () => pickLighting(noirPreset, "night", 5));
    expect(new Set(results).size).toBe(1);
  });

  it("returns different lighting for different sceneIndex values (with same timeOfDay)", () => {
    const result0 = pickLighting(noirPreset, "night", 0);
    const result1 = pickLighting(noirPreset, "night", 1);
    const result2 = pickLighting(noirPreset, "night", 2);
    // At least 2 of the 3 should differ (deterministic but varied)
    const unique = new Set([result0, result1, result2]);
    expect(unique.size).toBeGreaterThanOrEqual(2);
  });

  it("falls back to timeOfDay defaults deterministically when no genre preset", () => {
    const result = pickLighting(null, "night", 0);
    expect(result).toBe("moonlight and practical light sources, deep shadows");
    // Same result on repeat call
    expect(pickLighting(null, "night", 0)).toBe(result);
  });

  it("falls back to 'natural lighting' for unknown timeOfDay without preset", () => {
    const result = pickLighting(null, "dusk", 0);
    expect(result).toBe("natural lighting");
  });

  it("two shots in the same scene get identical lighting via planShotsFromScript", () => {
    const analysis = makeAnalysis({
      scenes: [
        {
          title: "Same scene",
          location: "Office",
          timeOfDay: "night",
          beats: [
            { description: "Marcus works at his desk", emotionalTone: "tense" },
            { description: "Marcus stands up", emotionalTone: "dramatic" },
          ],
        },
      ],
    });
    const shots = planShotsFromScript(analysis, characters, styleBible, noirPreset);
    expect(shots).toHaveLength(2);
    expect(shots[0].lighting).toBe(shots[1].lighting);
  });
});

// ─── simpleHash and seededRandom helpers ────────────────────────

describe("simpleHash", () => {
  it("returns the same value for the same input", () => {
    expect(simpleHash("test")).toBe(simpleHash("test"));
  });

  it("returns different values for different inputs", () => {
    expect(simpleHash("scene-0-night")).not.toBe(simpleHash("scene-1-night"));
  });

  it("returns a non-negative integer", () => {
    const h = simpleHash("anything");
    expect(h).toBeGreaterThanOrEqual(0);
    expect(Number.isInteger(h)).toBe(true);
  });
});

describe("seededRandom", () => {
  it("produces the same sequence for the same seed", () => {
    const rng1 = seededRandom(42);
    const rng2 = seededRandom(42);
    const seq1 = Array.from({ length: 10 }, () => rng1());
    const seq2 = Array.from({ length: 10 }, () => rng2());
    expect(seq1).toEqual(seq2);
  });

  it("produces values in [0, 1)", () => {
    const rng = seededRandom(123);
    for (let i = 0; i < 100; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("produces different sequences for different seeds", () => {
    const rng1 = seededRandom(1);
    const rng2 = seededRandom(2);
    const seq1 = Array.from({ length: 5 }, () => rng1());
    const seq2 = Array.from({ length: 5 }, () => rng2());
    expect(seq1).not.toEqual(seq2);
  });
});

// ─── compoundCameraForDuration ──────────────────────────────────

describe("compoundCameraForDuration", () => {
  it("returns original promptSyntax for durations <= 5s", () => {
    const result = compoundCameraForDuration(
      "Slow dolly push-in from medium shot to close-up",
      "dolly-push-in",
      5,
    );
    expect(result).toBe("Slow dolly push-in from medium shot to close-up");
  });

  it("returns compound description for dolly-push-in at 7s", () => {
    const result = compoundCameraForDuration(
      "Slow dolly push-in from medium shot to close-up",
      "dolly-push-in",
      7,
    );
    expect(result).toContain("begins at a distance");
    expect(result).toContain("gradually");
    expect(result).not.toBe("Slow dolly push-in from medium shot to close-up");
  });

  it("returns compound description for tracking-follow at 8s", () => {
    const result = compoundCameraForDuration(
      "Tracking shot, camera follows alongside the subject",
      "tracking-follow",
      8,
    );
    expect(result).toContain("locks onto the subject");
    expect(result).toContain("continuous tracking");
  });

  it("returns compound description for static shots at 8s", () => {
    const result = compoundCameraForDuration(
      "Static tripod, wide shot",
      "static-wide",
      8,
    );
    // Static shots should have compound descriptions about the tableau
    expect(result).toContain("locked-off wide");
  });

  it("adds temporal language as fallback for unknown movement IDs at 7s", () => {
    const result = compoundCameraForDuration(
      "Custom camera movement",
      "custom-unknown",
      7,
    );
    expect(result).toContain("Slowly");
    expect(result).toContain("custom camera movement");
  });

  it("preserves existing temporal language in fallback", () => {
    const result = compoundCameraForDuration(
      "Slow crane descending toward the subject",
      "custom-unknown",
      7,
    );
    // Already has "Slow" — should return unchanged
    expect(result).toBe("Slow crane descending toward the subject");
  });

  it("all known movement IDs have compound descriptions", () => {
    const knownIds = [
      "dolly-push-in", "crane-up-reveal", "tracking-follow", "pull-out-reveal",
      "slow-dolly-forward", "pan-reveal", "handheld", "orbit-360",
      "static-wide", "static-medium", "static-close-up",
    ];
    for (const id of knownIds) {
      const result = compoundCameraForDuration("original", id, 8);
      expect(result).not.toBe("original");
      expect(result.length).toBeGreaterThan(30);
    }
  });
});

// ─── Improved subject building with dialogue characters ─────────

describe("planShotsFromScript — dialogue characters in subjects", () => {
  it("includes dialogue character in subject even when not in description", () => {
    const analysis = makeAnalysis({
      scenes: [
        {
          title: "Test",
          location: "Office",
          timeOfDay: "night",
          beats: [
            {
              description: "A shadowy figure speaks from the doorway",
              emotionalTone: "mysterious",
              dialogue: [
                { character: "Elena", line: "You should leave.", emotion: "cold" },
              ],
            },
          ],
        },
      ],
    });
    const shots = planShotsFromScript(analysis, characters, styleBible, noirPreset);
    expect(shots[0].subject).toContain("Elena");
    expect(shots[0].subject).toContain("dark hair");
  });

  it("includes both description-mentioned and dialogue characters", () => {
    const analysis = makeAnalysis({
      scenes: [
        {
          title: "Confrontation",
          location: "Back alley",
          timeOfDay: "night",
          beats: [
            {
              description: "Marcus steps out of the shadows",
              emotionalTone: "tense",
              dialogue: [
                { character: "Elena", line: "I knew it was you.", emotion: "angry" },
              ],
            },
          ],
        },
      ],
    });
    const shots = planShotsFromScript(analysis, characters, styleBible, noirPreset);
    // Both characters should appear
    expect(shots[0].subject).toContain("Marcus");
    expect(shots[0].subject).toContain("Elena");
  });

  it("does not duplicate characters mentioned in both description and dialogue", () => {
    const analysis = makeAnalysis({
      scenes: [
        {
          title: "Test",
          location: "Café",
          timeOfDay: "afternoon",
          beats: [
            {
              description: "Elena sits at a table, nervous",
              emotionalTone: "tense",
              dialogue: [
                { character: "Elena", line: "I can't do this anymore.", emotion: "shaky" },
              ],
            },
          ],
        },
      ],
    });
    const shots = planShotsFromScript(analysis, characters, styleBible, noirPreset);
    // Elena should appear only once in subject
    const elenaCount = (shots[0].subject.match(/Elena/g) || []).length;
    expect(elenaCount).toBe(1);
  });
});

// ─── Compound camera in full pipeline ───────────────────────────

describe("planShotsFromScript — compound camera for longer shots", () => {
  it("uses compound camera descriptions for shots with duration > 5s", () => {
    // Create a scene with a slow emotional tone that biases toward longer duration
    const analysis = makeAnalysis({
      scenes: [
        {
          title: "Quiet moment",
          location: "Empty room",
          timeOfDay: "night",
          beats: [
            { description: "Marcus sits alone in the dark, lost in thought", emotionalTone: "melancholic" },
          ],
        },
      ],
    });
    // Use noir preset which has avgShotDuration 6 + melancholic bias of +2 = 8s
    const shots = planShotsFromScript(analysis, characters, styleBible, noirPreset);
    // The shot should have duration > 5 and thus a richer prompt
    if (shots[0].durationSeconds > 5) {
      // The generated prompt should contain compound camera language (longer, more temporal)
      expect(shots[0].generatedPrompt.length).toBeGreaterThan(100);
    }
  });
});

// ─── getDurationBias export ──────────────────────────────────────

describe("getDurationBias", () => {
  it("returns a number for known tones", () => {
    expect(typeof getDurationBias("melancholic")).toBe("number");
    expect(typeof getDurationBias("exciting")).toBe("number");
  });

  it("returns 0 for unknown tones", () => {
    expect(getDurationBias("unknown-tone")).toBe(0);
  });
});

// ─── Duration fitting (targetDuration parameter) ─────────────────

describe("planShotsFromScript — duration fitting", () => {
  it("without targetDuration → durations unchanged (backward compat)", () => {
    const analysis = makeAnalysis();
    const shotsA = planShotsFromScript(analysis, characters, styleBible, noirPreset);
    const shotsB = planShotsFromScript(analysis, characters, styleBible, noirPreset, undefined);
    // Both should produce shots — we can't compare exact durations due to randomness
    // but we verify the function still works without the param
    expect(shotsA.length).toBe(shotsB.length);
    expect(shotsA.length).toBeGreaterThan(0);
  });

  it("with targetDuration=30 on a multi-shot plan → total ≈ 30s", () => {
    // Create a script that would naturally generate many shots with longer durations
    const analysis = makeAnalysis({
      scenes: [
        {
          title: "Scene 1",
          location: "Office",
          timeOfDay: "night",
          beats: Array.from({ length: 6 }, (_, i) => ({
            description: `Beat ${i} with Marcus doing something`,
            emotionalTone: "melancholic", // +2 bias → 8s base with noir
          })),
        },
      ],
    });
    const shots = planShotsFromScript(analysis, characters, styleBible, noirPreset, 30);
    const total = shots.reduce((s, sh) => s + sh.durationSeconds, 0);
    // Should be close to 30s (within reasonable margin due to clamping)
    expect(total).toBeGreaterThanOrEqual(18); // 6 shots × 3s min
    expect(total).toBeLessThanOrEqual(42); // some tolerance
  });

  it("with targetDuration=120 on a 5-beat plan → total ≈ 120s", () => {
    const analysis = makeAnalysis({
      scenes: [
        {
          title: "Scene 1",
          location: "Park",
          timeOfDay: "morning",
          beats: Array.from({ length: 5 }, (_, i) => ({
            description: `Beat ${i} with Marcus walking`,
            emotionalTone: "exciting", // -2 bias → shorter base
          })),
        },
      ],
    });
    const shots = planShotsFromScript(analysis, characters, styleBible, noirPreset, 120);
    const total = shots.reduce((s, sh) => s + sh.durationSeconds, 0);
    // Should be close to 120s but clamped at max 10s each → max 50s
    expect(total).toBeLessThanOrEqual(60); // 5 shots × 10s max
    // Each shot should be at max (10s) since 120/5 = 24 which clamps to 10
    for (const shot of shots) {
      expect(shot.durationSeconds).toBeLessThanOrEqual(10);
    }
  });

  it("clamping respected: no shot < 3s or > 10s (12 for orbit)", () => {
    const analysis = makeAnalysis({
      scenes: [
        {
          title: "Scene 1",
          location: "Office",
          timeOfDay: "night",
          beats: Array.from({ length: 10 }, (_, i) => ({
            description: `Beat ${i}`,
            emotionalTone: "dramatic",
          })),
        },
      ],
    });
    // Very short target → should compress but respect minimums
    const shots = planShotsFromScript(analysis, characters, styleBible, noirPreset, 20);
    for (const shot of shots) {
      expect(shot.durationSeconds).toBeGreaterThanOrEqual(3);
      if (shot.cameraMovement !== "orbit-360") {
        expect(shot.durationSeconds).toBeLessThanOrEqual(10);
      } else {
        expect(shot.durationSeconds).toBeLessThanOrEqual(12);
      }
    }
  });

  it("small difference (within 15%) → no scaling applied", () => {
    const analysis = makeAnalysis({
      scenes: [
        {
          title: "Scene 1",
          location: "Office",
          timeOfDay: "night",
          beats: [
            { description: "Marcus sits at desk", emotionalTone: "dramatic" },
            { description: "Marcus stands up", emotionalTone: "dramatic" },
          ],
        },
      ],
    });
    // First get the natural total
    const naturalShots = planShotsFromScript(analysis, characters, styleBible, noirPreset);
    const naturalTotal = naturalShots.reduce((s, sh) => s + sh.durationSeconds, 0);

    // Target within 15% — should not scale
    const target = Math.round(naturalTotal * 1.1); // 10% over
    const fittedShots = planShotsFromScript(analysis, characters, styleBible, noirPreset, target);
    const fittedTotal = fittedShots.reduce((s, sh) => s + sh.durationSeconds, 0);

    // Should be very close to natural (same, since no scaling applied)
    // Due to randomness in camera selection, durations may differ slightly
    // but the fitting step itself should not have been triggered
    expect(Math.abs(fittedTotal - naturalTotal)).toBeLessThanOrEqual(naturalTotal * 0.2);
  });
});
