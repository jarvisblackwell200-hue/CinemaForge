import type { StyleBible } from "@/types/movie";
import type { ShotDialogue } from "@/types/shot";

interface PromptCharacter {
  id: string;
  name: string;
  visualDescription: string;
  /** Whether this character has reference images uploaded for element-based generation */
  hasReferenceImages?: boolean;
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
  /** Element name for scene environment reference (e.g. "element_scene_0").
   *  When set, @element_scene_N is injected into the environment block. */
  sceneElementName?: string;
}

/**
 * Assembles a complete video generation prompt from structured shot data.
 * Used with kie.ai's Kling 3.0 model.
 *
 * Order follows official Kling prompt guidance (Scene-first grounding):
 * 1. Environment/Scene → WHERE — grounds the model in spatial context first
 * 2. Subject → WHO is on screen (with @Element references)
 * 3. Action → WHAT happens (beginning → middle → end, temporal timeline)
 * 4. Camera → HOW the audience sees it (movement relative to subject)
 * 5. Dialogue → AUDIO — speaker labels with voice descriptions
 * 6. Lighting → specific light sources
 * 7. Style Bible → appended last (film stock, grade, texture)
 */
export function assemblePrompt(
  shot: PromptShot,
  characters: PromptCharacter[],
  styleBible: StyleBible | null,
  voiceProfiles?: Record<string, { language?: string; accent?: string; tone?: string; speed?: string }>,
): string {
  const blocks: string[] = [];

  // 1. ENVIRONMENT — grounds the model in spatial/temporal context first,
  //    with scene element reference if available
  if (shot.environment || shot.sceneElementName) {
    let envBlock = shot.environment ?? "";
    if (shot.sceneElementName) {
      envBlock = `@${shot.sceneElementName} ${envBlock}`.trim();
    }
    if (envBlock) blocks.push(envBlock);
  }

  // 2. SUBJECT BLOCK — who is on screen, with @element references
  const subjectBlock = buildSubjectBlock(shot.subject, characters);
  if (subjectBlock) blocks.push(subjectBlock);

  // 3. ACTION BLOCK — enriched for duration, temporal timeline
  if (shot.action) blocks.push(enrichActionForDuration(shot.action, shot.durationSeconds));

  // 4. CAMERA BLOCK — how the audience sees it, relative to subject
  const cameraBlock = buildCameraBlock(shot.shotType, shot.cameraMovement);
  if (cameraBlock) blocks.push(cameraBlock);

  // 5. DIALOGUE — speaker labels with voice descriptions (only when audio is on)
  if (shot.includeDialogue !== false) {
    const voiceProfile = shot.dialogue?.characterId
      ? voiceProfiles?.[shot.dialogue.characterId]
      : undefined;
    const dialogueBlock = formatDialogue(shot.dialogue ?? null, voiceProfile);
    if (dialogueBlock) blocks.push(dialogueBlock);
  }

  // 6. LIGHTING
  if (shot.lighting) blocks.push(shot.lighting);

  // 7. STYLE BIBLE — always last
  if (styleBible?.styleString) blocks.push(styleBible.styleString);

  return blocks.filter(Boolean).join(". ")
    .replace(/\.(\s*\.)+/g, ".")  // collapse ". .", "..", "..." into single "."
    .replace(/\s{2,}/g, " ")      // collapse multiple spaces
    .trim();
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
 * Characters mentioned in the subject get their @element_name annotation.
 * Does NOT re-describe what's in reference images.
 *
 * NOTE: The @Element injection works when character elements are passed to kie.ai.
 * The element name in the prompt must match the `name` field of the element
 * in the kling_elements array sent with the generation request.
 */
export function buildSubjectBlock(
  subject: string,
  characters: PromptCharacter[]
): string {
  let result = subject;

  for (const char of characters) {
    if (!char.hasReferenceImages) continue;

    const elementName = `element_${char.name.toLowerCase().replace(/\s+/g, "_")}`;

    // Strategy 1: Replace "Name, exact visual description" (legacy subjects)
    // This precisely strips the description that duplicates reference images.
    const descPattern = new RegExp(
      `\\b${escapeRegex(char.name)}\\b,\\s*${escapeRegex(char.visualDescription)}`,
      "gi"
    );
    if (descPattern.test(result)) {
      descPattern.lastIndex = 0; // Reset lastIndex after .test() with 'g' flag
      result = result.replace(descPattern, `@${elementName}`);
    } else {
      // Strategy 2: Replace "Name, <text>" up to " and " boundary (reformatted descriptions)
      const nameCommaAndPattern = new RegExp(
        `\\b${escapeRegex(char.name)}\\b,\\s+[^@]*?(?=\\s+and\\s+)`,
        "gi"
      );
      if (nameCommaAndPattern.test(result)) {
        nameCommaAndPattern.lastIndex = 0;
        result = result.replace(nameCommaAndPattern, `@${elementName}`);
      } else {
        // Strategy 3: Replace just the name
        const namePattern = new RegExp(`\\b${escapeRegex(char.name)}\\b`, "gi");
        result = result.replace(namePattern, `@${elementName}`);
      }
    }
  }

  // Check for partial name matches that weren't caught by direct replacement
  const mentionedChars = findMentionedCharacters(result, characters);
  for (const char of mentionedChars) {
    if (!char.hasReferenceImages) continue;
    const elementName = `element_${char.name.toLowerCase().replace(/\s+/g, "_")}`;
    // If element ref not already in the result, append a grounding mention
    if (!result.includes(`@${elementName}`)) {
      result += `. @${elementName} is present in the scene`;
    }
  }

  return result.replace(/\s{2,}/g, " ").trim();
}

/**
 * Find characters mentioned in text by full name, first name, or last name.
 * Returns the matched characters (no duplicates).
 */
function findMentionedCharacters(
  text: string,
  characters: PromptCharacter[]
): PromptCharacter[] {
  const lower = text.toLowerCase();
  const found = new Map<string, PromptCharacter>();

  for (const char of characters) {
    // Full name match (highest priority)
    if (lower.includes(char.name.toLowerCase())) {
      found.set(char.id, char);
      continue;
    }

    // Partial name match — split "Marcus Chen" into ["Marcus", "Chen"]
    const parts = char.name.split(/\s+/).filter((p) => p.length >= 3);
    for (const part of parts) {
      const partPattern = new RegExp(`\\b${escapeRegex(part)}\\b`, "i");
      if (partPattern.test(text)) {
        found.set(char.id, char);
        break;
      }
    }
  }

  return Array.from(found.values());
}

/**
 * Formats dialogue for native audio generation.
 * Format: [Character Name, voice description]: "Line"
 *
 * When a voiceProfile is provided (from Character.voiceProfile), its fields
 * are woven into the voice description for richer audio control.
 */
export function formatDialogue(
  dialogue: ShotDialogue | null,
  voiceProfile?: { language?: string; accent?: string; tone?: string; speed?: string } | null,
): string {
  if (!dialogue) return "";
  if (!dialogue.characterName?.trim() || !dialogue.line?.trim()) return "";

  const voiceParts: string[] = [dialogue.emotion];
  if (voiceProfile?.tone) voiceParts.push(voiceProfile.tone);
  if (voiceProfile?.accent) voiceParts.push(`${voiceProfile.accent} accent`);
  if (voiceProfile?.speed && voiceProfile.speed !== "normal") voiceParts.push(`${voiceProfile.speed} pace`);
  const voiceDesc = voiceParts.join(", ");

  return `[${dialogue.characterName}, ${voiceDesc} voice]: "${dialogue.line}"`;
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
 * Assembles multi-shot storyboard prompt for kie.ai multi-shot mode.
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

  // Check character references (by name or @element tag)
  const mentionedCharacters = characters.filter((c) => {
    const lowerPrompt = prompt.toLowerCase();
    const elementName = `element_${c.name.toLowerCase().replace(/\s+/g, "_")}`;
    return lowerPrompt.includes(c.name.toLowerCase()) || prompt.includes(`@${elementName}`);
  });
  const characterCoverage = mentionedCharacters.length > 0 || characters.length === 0;

  if (characters.length > 0 && mentionedCharacters.length === 0) {
    warnings.push("No characters referenced — is this an establishing shot?");
  }

  // Check element references specifically for characters with face references
  const charsWithElements = characters.filter((c) => c.hasReferenceImages);
  const missingElements = charsWithElements.filter((c) => {
    const elementName = `element_${c.name.toLowerCase().replace(/\s+/g, "_")}`;
    return !prompt.includes(`@${elementName}`);
  });

  if (missingElements.length > 0) {
    warnings.push(
      `Characters with face references not tagged in prompt: ${missingElements.map((c) => c.name).join(", ")}. ` +
      `Element binding may not activate.`
    );
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

/**
 * Regex matching common temporal/progression language in action descriptions.
 * If an action already contains these, it has enough temporal structure for Kling.
 */
const HAS_TEMPORAL_LANGUAGE = /\b(then|before\s|after\s|while\s|slowly|gradually|begins?\sto|starts?\sto|eventually|finally|continues?\sto|first\s|next\s|meanwhile|picks?\sup|sets?\sdown|turns?\s(to|around|back)|steps?\s|reaches?\s(for|out)|pulls?\s|pushes?\s|opens?\s|closes?\s)\b/i;

/**
 * For shots >5 seconds where the action text is too short and lacks temporal
 * language, adds explicit temporal sequencing. The official Kling 3.0 guide
 * calls the action timeline the "secret sauce" — describing sequential actions
 * as "First [A], then [B], finally [C]" enables temporal narrative control.
 *
 * Only enriches short actions that lack temporal language.
 * Longer actions or those with progression words are returned unchanged.
 */
export function enrichActionForDuration(action: string, duration: number): string {
  if (duration <= 5) return action;
  if (HAS_TEMPORAL_LANGUAGE.test(action)) return action;

  // Action is long enough — probably already descriptive
  const wordCount = action.split(/\s+/).length;
  if (wordCount >= 12) return action;

  // Short action for long shot — add Kling-recommended temporal sequencing
  if (duration >= 8) {
    return `First, ${action.charAt(0).toLowerCase()}${action.slice(1)}. Then, the action develops and intensifies. Finally, the moment settles into stillness`;
  }
  // 6-7s: two-phase structure
  return `First, ${action.charAt(0).toLowerCase()}${action.slice(1)}. Then, the moment lingers and develops`;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
