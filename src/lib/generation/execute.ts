/**
 * Shared shot generation logic used by both the inline API route
 * and the BullMQ background worker.
 *
 * This module owns: prompt assembly, continuity chaining, element building,
 * video generation, take creation, frame extraction, scene/character
 * reference updates, movie status advancement, and stale shot invalidation.
 */

import { db } from "@/lib/db";
import { generateVideo } from "@/lib/kling/client";
import { assemblePrompt, formatNegativePrompt } from "@/lib/kling/prompts";
import { extractLastFrame } from "@/lib/video/frames";
import { getCreditCost } from "@/lib/constants/pricing";
import type { KieElement, QualityTier } from "@/lib/kling/types";
import type { ScenePack, StyleBible } from "@/types/movie";

// ─── Types ───────────────────────────────────────────────────

export interface ExecuteGenerationInput {
  shotId: string;
  userId: string;
  quality: QualityTier;
  generateAudio: boolean;
  characterReferenceImages?: string[];
}

export interface ExecuteGenerationResult {
  takeId: string;
  videoUrl: string;
  creditCost: number;
  generationTimeMs: number;
  chainSource: "chain" | "scene" | "character" | "none";
  staleShotIds: string[];
  elementsUsed: number;
}

// ─── Helpers ─────────────────────────────────────────────────

/** Filter image URLs to only kie.ai-supported formats (jpeg/jpg/png). */
function filterSupportedImageUrls(urls: string[]): string[] {
  return urls.filter((url) => {
    const lower = url.toLowerCase().split("?")[0];
    return !lower.endsWith(".webp") && !lower.endsWith(".gif") && !lower.endsWith(".svg");
  });
}

/** Truncate a string at a word boundary, not mid-word. */
function truncateAtWordBoundary(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  const truncated = text.slice(0, maxLen);
  const lastSpace = truncated.lastIndexOf(" ");
  return lastSpace > maxLen * 0.5 ? truncated.slice(0, lastSpace) : truncated;
}

/**
 * Build a concise element description that focuses on identity anchors
 * rather than re-describing what's already in the reference images.
 * Format: "Character name, the role — key identifying traits"
 */
function buildElementDescription(name: string, visualDescription: string, role: string | null): string {
  let desc = name;

  if (role) desc += `, the ${role}`;

  // Extract the most distinctive visual traits (first sentence or clause)
  // This helps kie.ai disambiguate multiple characters
  const firstClause = visualDescription.split(/[.,;]/)[0]?.trim();
  if (firstClause && firstClause.length > 3) {
    desc += ` — ${firstClause}`;
  }

  return truncateAtWordBoundary(desc, 100);
}

// ─── Main execution ──────────────────────────────────────────

/**
 * Execute the full generation pipeline for a single shot.
 * Handles prompt assembly, continuity, element building, video generation,
 * and all post-generation bookkeeping.
 *
 * Caller is responsible for:
 * - Validating ownership
 * - Deducting credits (before calling this)
 * - Handling errors (this throws on failure)
 */
export async function executeGeneration(
  input: ExecuteGenerationInput,
): Promise<ExecuteGenerationResult> {
  const { shotId, quality, generateAudio } = input;

  // ─── Fetch shot with movie data ────────────────────────────
  const shot = await db.shot.findFirst({
    where: { id: shotId },
    include: {
      movie: {
        select: {
          id: true,
          userId: true,
          status: true,
          styleBible: true,
          aspectRatio: true,
          sceneReferenceFrames: true,
          scenePacks: true,
        },
      },
    },
  });

  if (!shot) throw new Error(`Shot ${shotId} not found`);

  // ─── Fetch characters ──────────────────────────────────────
  const characters = await db.character.findMany({
    where: { movieId: shot.movie.id },
    select: {
      id: true,
      name: true,
      role: true,
      visualDescription: true,
      referenceImages: true,
      voiceProfile: true,
      generatedReferenceUrl: true,
    },
  });

  // ─── Build prompt ──────────────────────────────────────────
  const styleBible = shot.movie.styleBible as StyleBible | null;
  const hasDialogue = !!(shot.dialogue as { line?: string } | null)?.line;
  const shouldIncludeDialogue = generateAudio && hasDialogue;
  const anyCharsHaveRefs = characters.some((c) => c.referenceImages.length > 0);

  // ─── Determine scene element name ────────────────────────────
  const scenePacksData = (shot.movie.scenePacks as ScenePack[] | null) ?? [];
  const shotScenePack = scenePacksData.find((sp) => sp.sceneIndex === shot.sceneIndex);
  const sceneElementName = shotScenePack?.status === "complete"
    ? shotScenePack.elementName
    : undefined;

  const useStoredPrompt = !!shot.generatedPrompt
    && (!hasDialogue || generateAudio)
    && !anyCharsHaveRefs
    && !sceneElementName; // Re-assemble if scene element is available

  let finalPrompt: string;
  if (useStoredPrompt) {
    finalPrompt = shot.generatedPrompt!;
  } else {
    const voiceProfiles: Record<string, { language?: string; accent?: string; tone?: string; speed?: string }> = {};
    for (const c of characters) {
      if (c.voiceProfile && typeof c.voiceProfile === "object") {
        voiceProfiles[c.id] = c.voiceProfile as { language?: string; accent?: string; tone?: string; speed?: string };
      }
    }

    finalPrompt = assemblePrompt(
      {
        shotType: shot.shotType,
        cameraMovement: shot.cameraMovement,
        subject: shot.subject,
        action: shot.action,
        environment: shot.environment,
        lighting: shot.lighting,
        dialogue: shot.dialogue as {
          characterId: string;
          characterName: string;
          line: string;
          emotion: string;
        } | null,
        durationSeconds: shot.durationSeconds,
        includeDialogue: shouldIncludeDialogue,
        sceneElementName,
      },
      characters.map((c) => ({
        ...c,
        hasReferenceImages: c.referenceImages.length > 0,
      })),
      styleBible,
      voiceProfiles,
    );
  }

  const negativePrompt = shot.negativePrompt || formatNegativePrompt(styleBible);

  // ─── Mark as generating ────────────────────────────────────
  await db.shot.update({
    where: { id: shot.id },
    data: { status: "GENERATING", generatedPrompt: finalPrompt, negativePrompt },
  });

  // ─── Continuity chaining ───────────────────────────────────
  // Only chain from the previous shot if it's in the SAME scene.
  // New scenes should start fresh to allow different locations/moods.
  let startImageUrl: string | undefined;
  let chainSource: "chain" | "scene" | "character" | "none" = "none";

  if (shot.order > 0) {
    const prevShot = await db.shot.findFirst({
      where: { movieId: shot.movieId, order: shot.order - 1, status: "COMPLETE" },
      select: {
        sceneIndex: true,
        endFrameUrl: true,
        takes: { where: { isHero: true }, select: { videoUrl: true }, take: 1 },
      },
    });

    // Only chain if same scene — different scenes should look distinct
    if (prevShot && prevShot.sceneIndex === shot.sceneIndex) {
      if (prevShot.endFrameUrl) {
        startImageUrl = prevShot.endFrameUrl;
        chainSource = "chain";
      } else if (prevShot.takes?.[0]?.videoUrl) {
        const frameUrl = await extractLastFrame(prevShot.takes[0].videoUrl);
        if (frameUrl) {
          startImageUrl = frameUrl;
          chainSource = "chain";
          await db.shot.updateMany({
            where: { movieId: shot.movieId, order: shot.order - 1 },
            data: { endFrameUrl: frameUrl },
          });
        }
      }
    }
  }

  // Scene-level reference frame fallback
  let sceneFrames: Record<string, string> = {};
  if (!startImageUrl) {
    sceneFrames = (shot.movie.sceneReferenceFrames as Record<string, string>) ?? {};
    const sceneFrame = sceneFrames[String(shot.sceneIndex)];
    if (sceneFrame) {
      startImageUrl = sceneFrame;
      chainSource = "scene";
    }
  }

  // ─── Build character elements ──────────────────────────────
  // Only include elements for characters actually mentioned in this shot's prompt.
  // Sending unused elements wastes API capacity and can cause kie.ai internal errors.
  const shotText = `${finalPrompt} ${shot.subject} ${shot.action}`.toLowerCase();
  const elements: KieElement[] = [];
  const charsWithRefs = characters.filter(
    (c) => c.referenceImages.length > 0 || c.generatedReferenceUrl,
  );
  for (const char of charsWithRefs) {
    const elementName = `element_${char.name.toLowerCase().replace(/\s+/g, "_")}`;

    // Check if this character is mentioned in the shot (by name or @element tag)
    const nameLower = char.name.toLowerCase();
    const nameParts = nameLower.split(/\s+/).filter((p) => p.length >= 3);
    const isMentioned = shotText.includes(nameLower)
      || shotText.includes(`@${elementName}`)
      || nameParts.some((part) => new RegExp(`\\b${part}\\b`, "i").test(shotText));

    if (!isMentioned) {
      console.log(`[gen] Skipping element "${char.name}" — not mentioned in this shot`);
      continue;
    }

    const urls = filterSupportedImageUrls([
      ...char.referenceImages,
      ...(char.generatedReferenceUrl ? [char.generatedReferenceUrl] : []),
    ]);
    if (urls.length >= 2) {
      // kie.ai requires 2–4 images per element for face-locking
      elements.push({
        name: elementName,
        description: buildElementDescription(char.name, char.visualDescription, char.role),
        element_input_urls: urls.slice(0, 4),
      });
    } else if (urls.length === 1) {
      // Single image: can't use as element (kie.ai needs 2+)
      console.warn(`[gen] Character "${char.name}" has only 1 reference image — skipping element (needs 2+)`);
    }
  }

  // ─── Build scene element ──────────────────────────────────
  const scenePacks = (shot.movie.scenePacks as ScenePack[] | null) ?? [];
  const scenePack = scenePacks.find((sp) => sp.sceneIndex === shot.sceneIndex);

  if (scenePack && scenePack.status === "complete") {
    const sceneImageUrls = filterSupportedImageUrls(
      scenePack.images
        .filter((img) => img.status === "complete" && img.imageUrl)
        .map((img) => img.imageUrl!),
    );

    // kie.ai requires 2-4 images per element
    if (sceneImageUrls.length >= 2) {
      const envDesc = shot.environment ?? "scene";
      elements.push({
        name: scenePack.elementName,
        description: truncateAtWordBoundary(
          `${envDesc} — environment and setting`,
          100,
        ),
        element_input_urls: sceneImageUrls.slice(0, 4),
      });
    }
  }

  // NOTE: Character reference images are intentionally NOT used as startImageUrl.
  // Using them as start frames triggers kie.ai's image-to-video mode, which makes
  // the reference image dominate the output's visual style — overriding the style
  // bible (film stock, color grade, textures). Character refs should only flow
  // through kling_elements for face-locking, which works alongside the style bible.

  // Populate startFrameUrl for chain visibility
  if (startImageUrl) {
    await db.shot.update({
      where: { id: shot.id },
      data: { startFrameUrl: startImageUrl },
    });
  }

  // ─── Generate video ────────────────────────────────────────
  const creditCost = getCreditCost(quality, shot.durationSeconds);

  const result = await generateVideo({
    prompt: finalPrompt,
    negativePrompt: negativePrompt || undefined,
    duration: shot.durationSeconds,
    aspectRatio: (shot.movie.aspectRatio as "16:9" | "9:16" | "1:1") ?? "16:9",
    quality,
    generateAudio,
    startImageUrl,
    elements: elements.length > 0 ? elements : undefined,
  });

  // ─── Cancellation guard ───────────────────────────────────
  // Re-check: did user cancel while we were generating?
  const freshShot = await db.shot.findUnique({
    where: { id: shot.id },
    select: { status: true },
  });
  if (freshShot?.status === "DRAFT") {
    // User cancelled. Save the take (it's free — credits already refunded) but don't mark COMPLETE.
    const take = await db.take.create({
      data: {
        shotId: shot.id,
        videoUrl: result.videoUrl,
        isHero: false,
        klingTaskId: result.taskId,
        generationParams: {
          prompt: finalPrompt,
          quality,
          duration: shot.durationSeconds,
          generationTimeMs: result.durationMs,
          elements: elements.length,
          cancelledDuringGen: true,
        },
      },
    });
    return {
      takeId: take.id,
      videoUrl: result.videoUrl,
      creditCost: 0,
      generationTimeMs: result.durationMs,
      chainSource: "none",
      staleShotIds: [],
      elementsUsed: elements.length,
    };
  }

  // ─── Create Take record ────────────────────────────────────
  const take = await db.take.create({
    data: {
      shotId: shot.id,
      videoUrl: result.videoUrl,
      isHero: true,
      klingTaskId: result.taskId,
      generationParams: {
        prompt: finalPrompt,
        quality,
        duration: shot.durationSeconds,
        generationTimeMs: result.durationMs,
        elements: elements.length,
      },
    },
  });

  // ─── Post-generation bookkeeping ───────────────────────────

  // Extract end frame for continuity chaining
  const endFrameUrl = await extractLastFrame(result.videoUrl);

  // Mark shot as complete
  await db.shot.update({
    where: { id: shot.id },
    data: { status: "COMPLETE", endFrameUrl: endFrameUrl ?? undefined },
  });

  // Advance movie status
  const remainingShots = await db.shot.count({
    where: { movieId: shot.movieId, status: { not: "COMPLETE" } },
  });
  if (remainingShots === 0) {
    await db.movie.update({
      where: { id: shot.movieId },
      data: { status: "ASSEMBLING" },
    });
  } else if (shot.movie.status === "STORYBOARDING") {
    await db.movie.update({
      where: { id: shot.movieId },
      data: { status: "GENERATING" },
    });
  }

  // Store scene reference frame for first shot of each scene (atomic read-modify-write)
  const sceneKey = String(shot.sceneIndex);
  if (endFrameUrl) {
    await db.$transaction(async (tx) => {
      const freshMovie = await tx.movie.findUnique({
        where: { id: shot.movie.id },
        select: { sceneReferenceFrames: true },
      });
      const frames = (freshMovie?.sceneReferenceFrames as Record<string, string>) ?? {};
      if (!frames[sceneKey]) {
        frames[sceneKey] = endFrameUrl;
        await tx.movie.update({
          where: { id: shot.movie.id },
          data: { sceneReferenceFrames: frames },
        });
      }
    });
  }

  // Store generated reference for characters appearing for the first time (batch update)
  if (endFrameUrl) {
    const shotText = `${shot.subject} ${shot.action}`.toLowerCase();
    const charIdsNeedingRef = characters
      .filter((c) => !c.generatedReferenceUrl && shotText.includes(c.name.toLowerCase()))
      .map((c) => c.id);
    if (charIdsNeedingRef.length > 0) {
      await db.character.updateMany({
        where: { id: { in: charIdsNeedingRef } },
        data: { generatedReferenceUrl: endFrameUrl },
      });
    }
  }

  // Only invalidate the immediately next shot's continuity chain
  // (not all downstream — they may be chained from scene refs or character refs)
  const staleShotIds: string[] = [];
  const nextShot = await db.shot.findFirst({
    where: {
      movieId: shot.movieId,
      order: shot.order + 1,
      startFrameUrl: { not: null },
      status: "COMPLETE",
    },
    select: { id: true },
  });
  if (nextShot) {
    staleShotIds.push(nextShot.id);
    await db.shot.update({
      where: { id: nextShot.id },
      data: { startFrameUrl: null },
    });
  }

  return {
    takeId: take.id,
    videoUrl: result.videoUrl,
    creditCost,
    generationTimeMs: result.durationMs,
    chainSource,
    staleShotIds,
    elementsUsed: elements.length,
  };
}
