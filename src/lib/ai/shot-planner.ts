import type { ScriptAnalysis, StyleBible, ScriptBeat } from "@/types/movie";
import type { GenrePreset } from "@/lib/constants/genre-presets";
import { CAMERA_MOVEMENTS, getCameraMovement } from "@/lib/constants/camera-movements";
import { assemblePrompt, formatNegativePrompt } from "@/lib/kling/prompts";

export interface PlannedShot {
  sceneIndex: number;
  order: number;
  shotType: string;
  cameraMovement: string;
  subject: string;
  action: string;
  environment: string | null;
  lighting: string | null;
  dialogue: {
    characterId: string;
    characterName: string;
    line: string;
    emotion: string;
  } | null;
  durationSeconds: number;
  generatedPrompt: string;
  negativePrompt: string;
}

interface PlannerCharacter {
  id: string;
  name: string;
  role: string | null;
  visualDescription: string;
  referenceImages?: string[];
  klingElementId?: string | null;
}

// Maps emotional tones to camera movement categories and preferred IDs
const TONE_CAMERA_MAP: Record<string, { category: string; preferred: string[] }> = {
  tense: { category: "character", preferred: ["dolly-push-in", "static-close-up", "handheld"] },
  melancholic: { category: "character", preferred: ["static-close-up", "slow-dolly-forward", "rack-focus"] },
  hopeful: { category: "establishing", preferred: ["crane-up-reveal", "pull-out-reveal", "tilt-up"] },
  exciting: { category: "action", preferred: ["tracking-follow", "speed-ramp", "chase-cam"] },
  mysterious: { category: "transition", preferred: ["pan-reveal", "slow-dolly-forward", "rack-focus"] },
  dramatic: { category: "character", preferred: ["dolly-push-in", "low-angle", "dutch-angle"] },
  peaceful: { category: "establishing", preferred: ["static-wide", "aerial-drone", "crane-down"] },
  fearful: { category: "action", preferred: ["handheld", "dutch-angle", "fpv-first-person"] },
  angry: { category: "action", preferred: ["handheld", "low-angle-tracking", "crash-zoom"] },
  sad: { category: "character", preferred: ["static-close-up", "pull-out-reveal", "dolly-push-in"] },
  romantic: { category: "character", preferred: ["dolly-push-in", "orbit-360", "rack-focus"] },
  suspenseful: { category: "transition", preferred: ["slow-dolly-forward", "pan-reveal", "rack-focus"] },
  triumphant: { category: "character", preferred: ["low-angle", "crane-up-reveal", "orbit-360"] },
  chaotic: { category: "action", preferred: ["handheld", "whip-pan", "chase-cam"] },
  reflective: { category: "character", preferred: ["static-medium", "rack-focus", "dolly-push-in"] },
  ominous: { category: "transition", preferred: ["slow-dolly-forward", "tilt-down", "dutch-angle"] },
};

const SHOT_TYPE_FOR_CATEGORY: Record<string, string[]> = {
  establishing: ["wide", "wide", "aerial"],
  character: ["medium", "close-up", "medium"],
  action: ["medium", "wide", "close-up"],
  transition: ["medium", "wide", "close-up"],
};

const ESTABLISHING_MOVEMENTS = ["static-wide", "crane-up-reveal", "aerial-drone", "slow-dolly-forward"];
const DIALOGUE_MOVEMENTS = ["ots-dialogue", "shot-reverse-shot", "static-medium", "static-close-up"];

/**
 * Deterministic-ish shot planner that maps scene beats to camera movements.
 * Uses weighted randomness for variety — same concept produces different results each time.
 */
export function planShotsFromScript(
  analysis: ScriptAnalysis,
  characters: PlannerCharacter[],
  styleBible: StyleBible | null,
  genrePreset: GenrePreset | null,
): PlannedShot[] {
  const shots: PlannedShot[] = [];
  const recentMovements: string[] = [];
  let globalOrder = 0;

  for (let sceneIdx = 0; sceneIdx < analysis.scenes.length; sceneIdx++) {
    const scene = analysis.scenes[sceneIdx];

    for (let beatIdx = 0; beatIdx < scene.beats.length; beatIdx++) {
      const beat = scene.beats[beatIdx];
      const isFirstBeatOfFirstScene = sceneIdx === 0 && beatIdx === 0;
      const hasDialogue = beat.dialogue && beat.dialogue.length > 0;

      // Pick camera movement
      let movementId: string;
      if (isFirstBeatOfFirstScene) {
        // Force establishing shot for opening
        movementId = pickWeightedRandom(ESTABLISHING_MOVEMENTS, [], genrePreset);
      } else if (hasDialogue) {
        // Prefer dialogue-focused movements
        movementId = pickWeightedRandom(DIALOGUE_MOVEMENTS, recentMovements, genrePreset);
      } else {
        movementId = pickForTone(beat.emotionalTone, recentMovements, genrePreset);
      }

      // Track recent movements for variety enforcement
      recentMovements.push(movementId);
      if (recentMovements.length > 2) recentMovements.shift();

      const movement = getCameraMovement(movementId);
      const promptSyntax = movement?.promptSyntax ?? movementId;
      const category = movement?.category ?? "character";

      // Determine shot type
      const shotTypeOptions = SHOT_TYPE_FOR_CATEGORY[category] ?? ["medium"];
      const shotType = shotTypeOptions[Math.floor(Math.random() * shotTypeOptions.length)];

      // Calculate duration
      const baseDuration = genrePreset?.avgShotDuration ?? 5;
      const durationBias = getDurationBias(beat.emotionalTone);
      const minDuration = movement?.minDuration ?? 3;
      let duration = Math.round(baseDuration + durationBias);
      duration = Math.max(minDuration, Math.min(duration, movementId === "orbit-360" ? 12 : 10));
      // Clamp final to 3-10 (except orbits)
      if (movementId !== "orbit-360") {
        duration = Math.max(3, Math.min(duration, 10));
      }

      // Build subject from beat description and characters
      const subject = buildBeatSubject(beat, scene.location, characters);
      const action = beat.description;
      const environment = `${scene.location}, ${scene.timeOfDay}`;
      const lighting = pickLighting(genrePreset, scene.timeOfDay);

      // Build dialogue if present
      let dialogue: PlannedShot["dialogue"] = null;
      if (hasDialogue && beat.dialogue && beat.dialogue.length > 0) {
        const d = beat.dialogue[0];
        const matchedChar = characters.find(
          (c) => c.name.toLowerCase() === d.character.toLowerCase()
        );
        dialogue = {
          characterId: matchedChar?.id ?? "",
          characterName: d.character,
          line: d.line,
          emotion: d.emotion,
        };
      }

      // Assemble prompt using the existing engine
      const generatedPrompt = assemblePrompt(
        {
          shotType,
          cameraMovement: promptSyntax,
          subject,
          action,
          environment,
          lighting,
          dialogue,
          durationSeconds: duration,
        },
        characters.map((c) => ({
          id: c.id,
          name: c.name,
          visualDescription: c.visualDescription,
          klingElementId: c.klingElementId,
        })),
        styleBible,
      );

      const negativePrompt = formatNegativePrompt(styleBible);

      shots.push({
        sceneIndex: sceneIdx,
        order: globalOrder++,
        shotType,
        cameraMovement: movementId,
        subject,
        action,
        environment,
        lighting,
        dialogue,
        durationSeconds: duration,
        generatedPrompt,
        negativePrompt,
      });
    }
  }

  return shots;
}

/**
 * Pick a camera movement based on emotional tone with variety enforcement.
 */
function pickForTone(
  tone: string,
  recentMovements: string[],
  genrePreset: GenrePreset | null,
): string {
  const normalized = tone.toLowerCase().trim();
  const mapping = TONE_CAMERA_MAP[normalized] ?? TONE_CAMERA_MAP["dramatic"];

  // Start with preferred movements for this tone
  let candidates = [...(mapping?.preferred ?? [])];

  // Add genre camera preferences as fallback
  if (genrePreset?.cameraPreferences) {
    for (const pref of genrePreset.cameraPreferences) {
      if (!candidates.includes(pref)) candidates.push(pref);
    }
  }

  // Add all movements in the matching category as last resort
  const categoryMovements = CAMERA_MOVEMENTS
    .filter((m) => m.category === mapping?.category)
    .map((m) => m.id);
  for (const cm of categoryMovements) {
    if (!candidates.includes(cm)) candidates.push(cm);
  }

  return pickWeightedRandom(candidates, recentMovements, genrePreset);
}

/**
 * Weighted random pick from candidates, filtering out recent movements.
 * Best match: 40%, second: 25%, third: 20%, rest: 15%.
 */
function pickWeightedRandom(
  candidates: string[],
  recentMovements: string[],
  genrePreset: GenrePreset | null,
): string {
  // Filter out recently used movements for variety
  let filtered = candidates.filter((c) => !recentMovements.includes(c));
  if (filtered.length === 0) filtered = candidates;
  if (filtered.length === 0) return "static-medium";

  // Validate candidates exist in CAMERA_MOVEMENTS (keep even if not found — may be valid IDs)
  const validated = filtered.filter(
    (id) => getCameraMovement(id) !== undefined
  );
  const pool = validated.length > 0 ? validated : filtered;

  // Weighted random selection
  const weights = [0.40, 0.25, 0.20];
  const restWeight = 0.15;
  const roll = Math.random();
  let cumulative = 0;

  for (let i = 0; i < pool.length; i++) {
    const weight = i < weights.length ? weights[i] : restWeight / Math.max(1, pool.length - weights.length);
    cumulative += weight;
    if (roll <= cumulative) return pool[i];
  }

  return pool[pool.length - 1];
}

/**
 * Build a descriptive subject line from the beat and characters.
 */
function buildBeatSubject(
  beat: ScriptBeat,
  location: string,
  characters: PlannerCharacter[],
): string {
  // Find characters mentioned in the beat description
  const mentioned = characters.filter((c) =>
    beat.description.toLowerCase().includes(c.name.toLowerCase())
  );

  if (mentioned.length > 0) {
    // Use visual descriptions for mentioned characters
    const charDescriptions = mentioned.map((c) => `${c.name}, ${c.visualDescription}`);
    return charDescriptions.join(" and ");
  }

  // If dialogue references a character, use them
  if (beat.dialogue && beat.dialogue.length > 0) {
    const dialogueChar = characters.find(
      (c) => c.name.toLowerCase() === beat.dialogue![0].character.toLowerCase()
    );
    if (dialogueChar) {
      return `${dialogueChar.name}, ${dialogueChar.visualDescription}`;
    }
  }

  // Fallback to location-based subject
  return location;
}

/**
 * Get a duration bias based on emotional tone.
 */
function getDurationBias(tone: string): number {
  const normalized = tone.toLowerCase().trim();
  const biases: Record<string, number> = {
    tense: 1,
    melancholic: 2,
    hopeful: 0,
    exciting: -1,
    mysterious: 1,
    dramatic: 1,
    peaceful: 2,
    fearful: 0,
    angry: -1,
    sad: 2,
    romantic: 1,
    suspenseful: 1,
    triumphant: 0,
    chaotic: -1,
    reflective: 2,
    ominous: 1,
  };
  return biases[normalized] ?? 0;
}

/**
 * Pick lighting keywords appropriate for the genre and time of day.
 */
function pickLighting(genrePreset: GenrePreset | null, timeOfDay: string): string {
  const keywords = genrePreset?.lightingKeywords ?? [];
  if (keywords.length === 0) {
    // Fallback based on time of day
    const timeDefaults: Record<string, string> = {
      morning: "soft golden morning light, warm tones",
      afternoon: "bright natural daylight, clean shadows",
      evening: "warm golden hour light, long shadows",
      night: "moonlight and practical light sources, deep shadows",
    };
    return timeDefaults[timeOfDay.toLowerCase()] ?? "natural lighting";
  }

  // Pick 2-3 random lighting keywords from the genre
  const shuffled = [...keywords].sort(() => Math.random() - 0.5);
  const count = 2 + Math.floor(Math.random() * 2); // 2 or 3
  return shuffled.slice(0, count).join(", ");
}
