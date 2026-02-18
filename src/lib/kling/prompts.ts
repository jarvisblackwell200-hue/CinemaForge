import type { StyleBible } from "@/types/movie";
import type { ShotDialogue } from "@/types/shot";

interface PromptCharacter {
  id: string;
  name: string;
  visualDescription: string;
  klingElementId?: string | null;
}

interface PromptShot {
  shotType: string;
  cameraMovement: string;
  subject: string;
  action: string;
  environment?: string | null;
  lighting?: string | null;
  dialogue?: ShotDialogue | null;
  durationSeconds: number;
  /** When false, dialogue formatting is omitted from the assembled prompt.
   *  This prevents Kling from visually depicting speech when audio generation is off.
   *  Defaults to true for backward compatibility. */
  includeDialogue?: boolean;
}

/**
 * Assembles a complete Kling prompt from structured shot data.
 *
 * Order is critical for Kling 3.0 quality:
 * 1. Camera/Shot type → HOW the audience sees it
 * 2. Subject → WHO is on screen (with @Element references)
 * 3. Action → WHAT happens (beginning → middle → end)
 * 4. Environment → WHERE (location, time, weather)
 * 5. Lighting → specific light sources
 * 6. Style Bible → appended last (film stock, grade, texture)
 */
export function assemblePrompt(
  shot: PromptShot,
  characters: PromptCharacter[],
  styleBible: StyleBible | null
): string {
  const blocks: string[] = [];

  // 1. CAMERA BLOCK
  const cameraBlock = buildCameraBlock(shot.shotType, shot.cameraMovement);
  if (cameraBlock) blocks.push(cameraBlock);

  // 2. SUBJECT BLOCK
  const subjectBlock = buildSubjectBlock(shot.subject, characters);
  if (subjectBlock) blocks.push(subjectBlock);

  // 3. ACTION BLOCK
  if (shot.action) blocks.push(shot.action);

  // 4. DIALOGUE (inline with action) — only when audio generation is enabled
  if (shot.includeDialogue !== false) {
    const dialogueBlock = formatDialogue(shot.dialogue ?? null);
    if (dialogueBlock) blocks.push(dialogueBlock);
  }

  // 5. ENVIRONMENT
  if (shot.environment) blocks.push(shot.environment);

  // 6. LIGHTING
  if (shot.lighting) blocks.push(shot.lighting);

  // 7. STYLE BIBLE — always last
  if (styleBible?.styleString) blocks.push(styleBible.styleString);

  return blocks.filter(Boolean).join(". ").replace(/\.\./g, ".").trim();
}

/**
 * Builds the camera/shot type block.
 * Combines shot type with camera movement in natural language.
 */
function buildCameraBlock(shotType: string, cameraMovement: string): string {
  // If the camera movement prompt syntax already includes shot type info,
  // just use it directly
  if (cameraMovement.toLowerCase().includes(shotType.toLowerCase())) {
    return cameraMovement;
  }
  return `${cameraMovement}, ${shotType}`;
}

/**
 * Builds the subject block with @Element references for Kling.
 * Characters mentioned in the subject get their @Name annotation.
 * Does NOT re-describe what's in reference images.
 *
 * NOTE: The @Element injection only works when `klingElementId` is populated,
 * which requires the Kling Elements API (direct Kling API only, not fal.ai).
 * When using fal.ai, characters are referenced by visual description only.
 */
export function buildSubjectBlock(
  subject: string,
  characters: PromptCharacter[]
): string {
  let result = subject;

  for (const char of characters) {
    // If the character is mentioned by name, add @Element reference
    const namePattern = new RegExp(`\\b${escapeRegex(char.name)}\\b`, "gi");
    if (namePattern.test(result) && char.klingElementId) {
      result = result.replace(
        namePattern,
        `@${char.name}`
      );
    }
  }

  return result;
}

/**
 * Formats dialogue for Kling 3.0 native audio.
 * Format: [Character Name, voice description]: "Line"
 */
export function formatDialogue(dialogue: ShotDialogue | null): string {
  if (!dialogue) return "";
  return `[${dialogue.characterName}, ${dialogue.emotion} voice]: "${dialogue.line}"`;
}

/**
 * Formats the negative prompt.
 * Kling negative prompts should NOT use "no" prefix — just list exclusions.
 */
export function formatNegativePrompt(
  styleBible: StyleBible | null,
  additionalExclusions?: string[]
): string {
  const parts: string[] = [];

  if (styleBible?.negativePrompt) {
    parts.push(styleBible.negativePrompt);
  }

  // Universal quality exclusions
  parts.push(
    "blur, flicker, distorted faces, warped limbs, unrealistic proportions, morphing, deformed hands, extra fingers, mutation, disfigured, low quality, artifacts, glitch"
  );

  if (additionalExclusions?.length) {
    parts.push(additionalExclusions.join(", "));
  }

  return parts.join(", ");
}

/**
 * Assembles multi-shot storyboard prompt for Kling 3.0 storyboard mode.
 * Max 6 shots per generation.
 *
 * Reserved for future multi-shot storyboard mode integration.
 * Currently tested but not called — single-shot generation is used instead.
 */
export function assembleMultiShotPrompt(
  shots: PromptShot[],
  characters: PromptCharacter[],
  styleBible: StyleBible | null
): string {
  const maxShots = Math.min(shots.length, 6);
  const shotLines = shots.slice(0, maxShots).map((shot, i) => {
    const camera = buildCameraBlock(shot.shotType, shot.cameraMovement);
    const subject = buildSubjectBlock(shot.subject, characters);
    const dialogue = formatDialogue(shot.dialogue ?? null);
    const parts = [camera, subject, shot.action].filter(Boolean).join(", ");
    const dialogueLine = dialogue ? `\n  ${dialogue}` : "";
    return `Shot ${i + 1} (${shot.durationSeconds}s): ${parts}.${dialogueLine}`;
  });

  const styleAppend = styleBible?.styleString
    ? `\n\nStyle: ${styleBible.styleString}`
    : "";

  return shotLines.join("\n") + styleAppend;
}

/**
 * Validates a prompt for common issues before generation.
 */
export interface PromptValidation {
  isValid: boolean;
  warnings: string[];
  errors: string[];
  characterCoverage: boolean;
  estimatedQuality: "low" | "medium" | "high";
}

export function validatePrompt(
  prompt: string,
  shot: PromptShot,
  characters: PromptCharacter[],
  styleBible: StyleBible | null
): PromptValidation {
  const warnings: string[] = [];
  const errors: string[] = [];

  // Check prompt length
  if (prompt.length < 50) {
    warnings.push("Prompt is very short — more detail produces better results");
  }
  if (prompt.length > 2000) {
    warnings.push("Prompt is very long — Kling may truncate or ignore parts");
  }

  // Check duration vs camera movement
  if (
    shot.cameraMovement.includes("orbit") &&
    shot.durationSeconds < 10
  ) {
    errors.push("360 orbit requires minimum 10 seconds duration");
  }

  if (shot.durationSeconds > 8) {
    warnings.push("Shots over 8 seconds have higher artifact risk");
  }

  // Check character references
  const mentionedCharacters = characters.filter((c) =>
    prompt.toLowerCase().includes(c.name.toLowerCase())
  );
  const characterCoverage = mentionedCharacters.length > 0 || characters.length === 0;

  if (characters.length > 0 && mentionedCharacters.length === 0) {
    warnings.push("No characters referenced — is this an establishing shot?");
  }

  // Check style bible
  if (!styleBible?.styleString) {
    warnings.push("No style bible applied — visual consistency may vary");
  }

  // Estimate quality
  let estimatedQuality: "low" | "medium" | "high" = "medium";
  if (errors.length > 0) {
    estimatedQuality = "low";
  } else if (
    prompt.length > 100 &&
    warnings.length === 0 &&
    styleBible?.styleString
  ) {
    estimatedQuality = "high";
  }

  return {
    isValid: errors.length === 0,
    warnings,
    errors,
    characterCoverage,
    estimatedQuality,
  };
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
