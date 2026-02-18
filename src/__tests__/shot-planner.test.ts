import { describe, it, expect } from "vitest";
import { planShotsFromScript } from "@/lib/ai/shot-planner";
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
    klingElementId: null,
  },
  {
    id: "char-2",
    name: "Elena",
    role: "supporting",
    visualDescription: "A young woman with dark hair, red scarf, and intense eyes",
    klingElementId: null,
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
