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
  hasReferenceImages?: boolean;
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
 * Extended camera prompt text for shots >5 seconds. Describes the SAME movement
 * unfolding over time — not a second movement. This gives Kling 3.0 enough
 * temporal structure to animate longer durations with progression.
 */
const COMPOUND_CAMERA: Record<string, string> = {
  "dolly-push-in": "Camera begins at a distance and slowly pushes forward, gradually tightening the frame into an intimate close-up",
  "crane-up-reveal": "Camera starts low and sweeps steadily upward, progressively revealing the full scope of the scene",
  "tracking-follow": "Camera locks onto the subject and follows alongside in a continuous tracking motion as the scene unfolds",
  "pull-out-reveal": "Camera starts tight on the subject and slowly pulls back, steadily revealing the surrounding environment",
  "slow-dolly-forward": "Camera creeps forward with deliberate patience, the frame gradually closing distance on the subject",
  "pan-reveal": "Camera holds briefly, then begins a deliberate pan, gradually unveiling what lies beyond the initial frame",
  "handheld": "Handheld camera stays close with organic movement, the energy building as the shot develops",
  "orbit-360": "Camera begins circling the subject in a smooth continuous orbit, revealing them from progressively changing angles",
  "low-angle-tracking": "Low camera tracks alongside the subject, the imposing perspective intensifying throughout the shot",
  "dutch-angle": "Camera holds at a tilted dutch angle, slowly tightening as the disorientation builds",
  "tilt-up": "Camera begins at the base and tilts steadily upward, slowly revealing the full vertical scale",
  "tilt-down": "Camera starts high and tilts gradually downward, bringing the subject into view with deliberate pacing",
  "aerial-drone": "Aerial camera drifts smoothly over the landscape, the full scope of the environment unfolding below",
  "rack-focus": "Focus begins sharp on the foreground element, then racks slowly through to reveal the background subject",
  "low-angle": "Camera holds steady from a low vantage point, the imposing perspective emphasizing the subject's presence throughout",
  "crash-zoom": "Camera holds wide, then rapidly zooms in to isolate the subject in a sudden dramatic shift",
  "whip-pan": "Camera whips rapidly to one side, the motion blur giving way to a sharp new composition",
  "fpv-first-person": "First-person camera moves forward through the environment, each new detail emerging as the perspective advances",
  "ots-dialogue": "Camera holds steady over the shoulder, the conversation unfolding naturally within the sustained frame",
  "shot-reverse-shot": "Camera alternates perspective between speakers, each cut deepening the exchange",
  "static-medium": "Camera holds a steady medium frame, allowing the action within to develop and breathe",
  "static-close-up": "Camera holds an unwavering close-up, every subtle expression and micro-movement visible as the moment plays out",
  "static-wide": "Camera holds a locked-off wide composition, the scene unfolding within the frame like a tableau",
};

/**
 * Returns an enriched camera description for shots >5 seconds.
 * For short shots, returns the original promptSyntax.
 * For longer shots, uses a temporal description that unfolds the camera
 * movement over time — giving Kling 3.0 enough to animate the full duration.
 */
export function compoundCameraForDuration(
  promptSyntax: string,
  movementId: string,
  duration: number,
): string {
  if (duration <= 5) return promptSyntax;

  const compound = COMPOUND_CAMERA[movementId];
  if (compound) return compound;

  // Fallback: add temporal language to existing syntax if not already present
  if (/\b(slow|gradual|stead)/i.test(promptSyntax)) return promptSyntax;
  return `Slowly, ${promptSyntax.charAt(0).toLowerCase()}${promptSyntax.slice(1)}, developing throughout the shot`;
}

/**
 * Simple string hash → 32-bit unsigned int. Pure, deterministic.
 */
export function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return hash >>> 0; // unsigned
}

/**
 * Seeded PRNG (mulberry32). Returns a function that produces 0..1 on each call.
 */
export function seededRandom(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Deterministic-ish shot planner that maps scene beats to camera movements.
 * Uses weighted randomness for variety — same concept produces different results each time.
 */
export function planShotsFromScript(
  analysis: ScriptAnalysis,
  characters: PlannerCharacter[],
  styleBible: StyleBible | null,
  genrePreset: GenrePreset | null,
  targetDuration?: number,
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
      const lighting = pickLighting(genrePreset, scene.timeOfDay, sceneIdx);

      // For longer shots, use compound camera description that unfolds over time
      const effectiveCameraSyntax = compoundCameraForDuration(promptSyntax, movementId, duration);

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
          cameraMovement: effectiveCameraSyntax,
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
          hasReferenceImages: (c.referenceImages?.length ?? 0) > 0,
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

  // Duration fitting: scale shot durations proportionally to hit the target
  if (targetDuration && targetDuration > 0 && shots.length > 0) {
    const rawTotal = shots.reduce((s, sh) => s + sh.durationSeconds, 0);
    if (Math.abs(rawTotal - targetDuration) > targetDuration * 0.15) {
      const scale = targetDuration / rawTotal;
      for (const shot of shots) {
        const maxDur = shot.cameraMovement === "orbit-360" ? 12 : 10;
        shot.durationSeconds = Math.max(3, Math.min(maxDur, Math.round(shot.durationSeconds * scale)));
      }
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
 * Combines characters mentioned in the description AND dialogue speakers
 * to ensure all on-screen characters are referenced for element binding.
 */
function buildBeatSubject(
  beat: ScriptBeat,
  location: string,
  characters: PlannerCharacter[],
): string {
  const mentionedIds = new Set<string>();
  const mentioned: PlannerCharacter[] = [];

  // 1. Characters mentioned by name in the beat description
  for (const c of characters) {
    if (beat.description.toLowerCase().includes(c.name.toLowerCase())) {
      if (!mentionedIds.has(c.id)) {
        mentionedIds.add(c.id);
        mentioned.push(c);
      }
    }
  }

  // 2. Characters from dialogue lines (even if not mentioned in description)
  if (beat.dialogue) {
    for (const d of beat.dialogue) {
      const dialogueChar = characters.find(
        (c) => c.name.toLowerCase() === d.character.toLowerCase()
      );
      if (dialogueChar && !mentionedIds.has(dialogueChar.id)) {
        mentionedIds.add(dialogueChar.id);
        mentioned.push(dialogueChar);
      }
    }
  }

  if (mentioned.length > 0) {
    const charDescriptions = mentioned.map((c) => `${c.name}, ${c.visualDescription}`);
    return charDescriptions.join(" and ");
  }

  // Fallback to location-based subject
  return location;
}

/**
 * Get a duration bias based on emotional tone.
 */
export function getDurationBias(tone: string): number {
  const normalized = tone.toLowerCase().trim();
  const biases: Record<string, number> = {
    tense: 1,
    melancholic: 2,
    hopeful: 0,
    exciting: -2,
    mysterious: 1,
    dramatic: 1,
    peaceful: 2,
    fearful: -1,
    angry: -2,
    sad: 2,
    romantic: 1,
    suspenseful: 1,
    triumphant: 0,
    chaotic: -2,
    reflective: 2,
    ominous: 1,
  };
  return biases[normalized] ?? 0;
}

/**
 * Pick lighting keywords appropriate for the genre and time of day.
 * When sceneIndex is provided, selection is deterministic per scene —
 * all shots in the same scene get identical lighting.
 */
export function pickLighting(
  genrePreset: GenrePreset | null,
  timeOfDay: string,
  sceneIndex?: number,
): string {
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

  // Deterministic selection using seeded PRNG when sceneIndex is provided
  const seed = simpleHash(`scene-${sceneIndex ?? 0}-${timeOfDay.toLowerCase()}`);
  const rng = seededRandom(seed);

  // Fisher-Yates shuffle with seeded random
  const shuffled = [...keywords];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  const count = 2 + (seed % 2); // deterministically 2 or 3
  return shuffled.slice(0, count).join(", ");
}
