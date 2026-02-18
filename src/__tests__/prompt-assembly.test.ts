import { describe, it, expect } from "vitest";
import {
  assemblePrompt,
  buildSubjectBlock,
  formatDialogue,
  formatNegativePrompt,
  assembleMultiShotPrompt,
  validatePrompt,
} from "@/lib/kling/prompts";

// ─── Test data ──────────────────────────────────────────────────

const baseShot = {
  shotType: "close-up",
  cameraMovement: "Slow dolly push-in from medium shot to close-up",
  subject: "Detective Marcus sits alone at the bar",
  action: "He slowly lifts his glass and stares into the amber liquid, then sets it down untouched",
  environment: "Dimly lit speakeasy, rain streaking down windows",
  lighting: "Single warm bulb overhead, neon sign flickering through window",
  dialogue: null,
  durationSeconds: 6,
};

const styleBible = {
  filmStock: "shot on 35mm film",
  colorPalette: "desaturated teal grade",
  textures: ["film grain", "shallow depth of field"],
  negativePrompt: "bright colors, sunny, cheerful",
  styleString: "Desaturated teal grade, crushed blacks, shot on 35mm film, heavy grain. 4K.",
};

const characters = [
  {
    id: "char-1",
    name: "Marcus",
    visualDescription: "A weathered man in his 50s with a gray trenchcoat",
    hasReferenceImages: true,
  },
  {
    id: "char-2",
    name: "Elena",
    visualDescription: "A young woman with dark hair and a red scarf",
    hasReferenceImages: false,
  },
];

// ─── assemblePrompt ─────────────────────────────────────────────

describe("assemblePrompt", () => {
  it("assembles all blocks in correct order", () => {
    const result = assemblePrompt(baseShot, [], styleBible);

    // Camera comes first
    expect(result.indexOf("dolly push-in")).toBeLessThan(result.indexOf("Detective Marcus"));
    // Subject before action
    expect(result.indexOf("Detective Marcus")).toBeLessThan(result.indexOf("lifts his glass"));
    // Action before environment
    expect(result.indexOf("lifts his glass")).toBeLessThan(result.indexOf("speakeasy"));
    // Environment before lighting
    expect(result.indexOf("speakeasy")).toBeLessThan(result.indexOf("warm bulb"));
    // Style bible is last
    expect(result.indexOf("Desaturated teal")).toBeGreaterThan(result.indexOf("warm bulb"));
  });

  it("omits empty optional fields", () => {
    const minimalShot = {
      ...baseShot,
      environment: null,
      lighting: null,
    };
    const result = assemblePrompt(minimalShot, [], null);

    expect(result).not.toContain("speakeasy");
    expect(result).not.toContain("warm bulb");
    expect(result).not.toContain("Desaturated");
  });

  it("does not double periods", () => {
    const result = assemblePrompt(baseShot, [], styleBible);
    expect(result).not.toContain("..");
  });

  it("includes dialogue when present", () => {
    const shotWithDialogue = {
      ...baseShot,
      dialogue: {
        characterId: "char-1",
        characterName: "Marcus",
        line: "Some things you can't unsee.",
        emotion: "weary",
      },
    };
    const result = assemblePrompt(shotWithDialogue, [], null);
    expect(result).toContain("[Marcus, weary voice]");
    expect(result).toContain("Some things you can't unsee.");
  });

  it("omits dialogue when includeDialogue is false (Fix #5)", () => {
    const shotWithDialogue = {
      ...baseShot,
      dialogue: {
        characterId: "char-1",
        characterName: "Marcus",
        line: "Some things you can't unsee.",
        emotion: "weary",
      },
      includeDialogue: false,
    };
    const result = assemblePrompt(shotWithDialogue, [], null);
    expect(result).not.toContain("[Marcus");
    expect(result).not.toContain("unsee");
  });

  it("includes dialogue by default when includeDialogue is undefined", () => {
    const shotWithDialogue = {
      ...baseShot,
      dialogue: {
        characterId: "char-1",
        characterName: "Marcus",
        line: "Some things you can't unsee.",
        emotion: "weary",
      },
      // includeDialogue not set — should default to true
    };
    const result = assemblePrompt(shotWithDialogue, [], null);
    expect(result).toContain("[Marcus, weary voice]");
  });

  it("includes dialogue when includeDialogue is explicitly true", () => {
    const shotWithDialogue = {
      ...baseShot,
      dialogue: {
        characterId: "char-1",
        characterName: "Marcus",
        line: "Let's go.",
        emotion: "determined",
      },
      includeDialogue: true,
    };
    const result = assemblePrompt(shotWithDialogue, [], null);
    expect(result).toContain("[Marcus, determined voice]");
    expect(result).toContain("Let's go.");
  });

  it("omitting dialogue does not affect other blocks", () => {
    const shot = {
      ...baseShot,
      dialogue: {
        characterId: "char-1",
        characterName: "Marcus",
        line: "Hello",
        emotion: "calm",
      },
      includeDialogue: false,
    };
    const result = assemblePrompt(shot, [], styleBible);
    // Camera, subject, action, environment, lighting, and style bible should still be present
    expect(result).toContain("dolly push-in");
    expect(result).toContain("Detective Marcus");
    expect(result).toContain("lifts his glass");
    expect(result).toContain("speakeasy");
    expect(result).toContain("warm bulb");
    expect(result).toContain("Desaturated teal");
  });

  it("does not combine shot type with camera movement if already included", () => {
    const result = assemblePrompt(baseShot, [], null);
    // The camera movement already contains "close-up", so shotType shouldn't be appended separately
    const closeUpCount = (result.match(/close-up/gi) || []).length;
    expect(closeUpCount).toBe(1);
  });

  it("appends shot type when not in camera movement", () => {
    const shot = {
      ...baseShot,
      cameraMovement: "Static tripod",
      shotType: "wide",
    };
    const result = assemblePrompt(shot, [], null);
    expect(result).toContain("Static tripod, wide");
  });
});

// ─── buildSubjectBlock ──────────────────────────────────────────

describe("buildSubjectBlock", () => {
  it("adds @element_ reference for characters with reference images", () => {
    const result = buildSubjectBlock(
      "Marcus walks through the rain",
      characters
    );
    expect(result).toContain("@element_marcus");
  });

  it("does not add @element_ for characters without reference images", () => {
    const result = buildSubjectBlock(
      "Elena waits at the corner",
      characters
    );
    // Elena has no reference images, so no @ prefix
    expect(result).toContain("Elena");
    expect(result).not.toContain("@element_elena");
  });

  it("returns subject unchanged when no characters match", () => {
    const result = buildSubjectBlock(
      "A lone figure stands in the doorway",
      characters
    );
    expect(result).toBe("A lone figure stands in the doorway");
  });

  it("handles multiple character mentions", () => {
    const result = buildSubjectBlock(
      "Marcus confronts Elena in the alley",
      characters
    );
    expect(result).toContain("@element_marcus");
    expect(result).toContain("Elena"); // no @ because no reference images
  });
});

// ─── formatDialogue ─────────────────────────────────────────────

describe("formatDialogue", () => {
  it("formats dialogue in Kling 3.0 native format", () => {
    const result = formatDialogue({
      characterId: "char-1",
      characterName: "Marcus",
      line: "I know what you did.",
      emotion: "stern",
    });
    expect(result).toBe('[Marcus, stern voice]: "I know what you did."');
  });

  it("returns empty string for null dialogue", () => {
    expect(formatDialogue(null)).toBe("");
  });
});

// ─── formatNegativePrompt ───────────────────────────────────────

describe("formatNegativePrompt", () => {
  it("combines style bible negatives with universal exclusions", () => {
    const result = formatNegativePrompt(styleBible);
    expect(result).toContain("bright colors");
    expect(result).toContain("blur");
    expect(result).toContain("distorted faces");
  });

  it("works without style bible", () => {
    const result = formatNegativePrompt(null);
    expect(result).toContain("blur");
    expect(result).not.toContain("bright colors");
  });

  it("includes additional exclusions", () => {
    const result = formatNegativePrompt(null, ["text", "watermark"]);
    expect(result).toContain("text, watermark");
  });
});

// ─── assembleMultiShotPrompt ────────────────────────────────────

describe("assembleMultiShotPrompt", () => {
  it("formats multiple shots with shot numbers and durations", () => {
    const shots = [
      { ...baseShot, durationSeconds: 5 },
      { ...baseShot, shotType: "wide", cameraMovement: "Static tripod, wide shot", durationSeconds: 8 },
    ];
    const result = assembleMultiShotPrompt(shots, [], styleBible);

    expect(result).toContain("Shot 1 (5s):");
    expect(result).toContain("Shot 2 (8s):");
    expect(result).toContain("Style: Desaturated teal");
  });

  it("limits to 6 shots maximum", () => {
    const shots = Array.from({ length: 10 }, (_, i) => ({
      ...baseShot,
      durationSeconds: 5,
    }));
    const result = assembleMultiShotPrompt(shots, [], null);

    expect(result).toContain("Shot 6");
    expect(result).not.toContain("Shot 7");
  });

  it("includes dialogue inline", () => {
    const shots = [
      {
        ...baseShot,
        dialogue: {
          characterId: "char-1",
          characterName: "Marcus",
          line: "It ends here.",
          emotion: "resolute",
        },
      },
    ];
    const result = assembleMultiShotPrompt(shots, [], null);
    expect(result).toContain('[Marcus, resolute voice]: "It ends here."');
  });
});

// ─── validatePrompt ─────────────────────────────────────────────

describe("validatePrompt", () => {
  it("passes validation for a well-formed prompt", () => {
    const prompt = assemblePrompt(baseShot, characters, styleBible);
    const result = validatePrompt(prompt, baseShot, characters, styleBible);

    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.estimatedQuality).toBe("high");
  });

  it("warns about short prompts", () => {
    const shortShot = { ...baseShot, cameraMovement: "Static", shotType: "wide", subject: "man", action: "walks", environment: null, lighting: null };
    const prompt = assemblePrompt(shortShot, [], null);
    const result = validatePrompt(prompt, shortShot, [], null);

    expect(prompt.length).toBeLessThan(50);
    expect(result.warnings.some((w) => w.includes("short"))).toBe(true);
  });

  it("errors on orbit without 10s duration", () => {
    const orbitShot = {
      ...baseShot,
      cameraMovement: "Camera orbits 360 degrees around the subject",
      durationSeconds: 5,
    };
    const prompt = assemblePrompt(orbitShot, [], null);
    const result = validatePrompt(prompt, orbitShot, [], null);

    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes("orbit"))).toBe(true);
  });

  it("warns about shots over 8 seconds", () => {
    const longShot = { ...baseShot, durationSeconds: 12 };
    const prompt = assemblePrompt(longShot, [], styleBible);
    const result = validatePrompt(prompt, longShot, [], styleBible);

    expect(result.warnings.some((w) => w.includes("artifact"))).toBe(true);
  });

  it("warns when no style bible is applied", () => {
    const prompt = assemblePrompt(baseShot, [], null);
    const result = validatePrompt(prompt, baseShot, [], null);

    expect(result.warnings.some((w) => w.includes("style bible"))).toBe(true);
  });

  it("warns when characters exist but none are referenced", () => {
    const shot = { ...baseShot, subject: "A lone figure in the rain" };
    const prompt = assemblePrompt(shot, characters, null);
    const result = validatePrompt(prompt, shot, characters, null);

    expect(result.warnings.some((w) => w.includes("characters referenced") || w.includes("establishing"))).toBe(true);
  });

  it("detects character coverage", () => {
    const prompt = assemblePrompt(baseShot, characters, null);
    const result = validatePrompt(prompt, baseShot, characters, null);

    // "Marcus" is in the subject, so coverage should be true
    expect(result.characterCoverage).toBe(true);
  });
});
