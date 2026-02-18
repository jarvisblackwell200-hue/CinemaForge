import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import { db } from "@/lib/db";
import { ensureUser } from "@/lib/auth";
import { generateVideo, isDryRunMode } from "@/lib/kling/client";
import { assemblePrompt, formatNegativePrompt } from "@/lib/kling/prompts";
import { getCreditCost } from "@/lib/constants/pricing";
import { extractLastFrame } from "@/lib/video/frames";
import type { QualityTier } from "@/lib/kling/types";
import type { StyleBible } from "@/types/movie";

// ─── Validation ────────────────────────────────────────────────

const GenerateSchema = z.object({
  shotId: z.string(),
  quality: z.enum(["draft", "standard", "cinema"]).default("draft"),
  generateAudio: z.boolean().default(false),
  characterReferenceImages: z.array(z.string().url()).optional(),
});

// Also support generating all shots for a movie
const GenerateAllSchema = z.object({
  movieId: z.string(),
  quality: z.enum(["draft", "standard", "cinema"]).default("draft"),
  generateAudio: z.boolean().default(false),
});

// ─── POST: Generate video for a single shot ────────────────────

export async function POST(req: NextRequest) {
  try {
    const userId = await ensureUser();

    const body = await req.json();

    // Check if this is a single shot or batch
    const singleParsed = GenerateSchema.safeParse(body);
    const batchParsed = GenerateAllSchema.safeParse(body);

    if (singleParsed.success) {
      return handleSingleShot(userId, singleParsed.data);
    }

    if (batchParsed.success) {
      return handleBatch(userId, batchParsed.data);
    }

    return NextResponse.json(
      { success: false, error: "Invalid request body" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Generate error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

// ─── Single shot generation ────────────────────────────────────

async function handleSingleShot(
  userId: string,
  input: { shotId: string; quality: QualityTier; generateAudio: boolean; characterReferenceImages?: string[] }
) {
  // Fetch the shot with its movie and characters
  const shot = await db.shot.findFirst({
    where: { id: input.shotId },
    include: {
      movie: {
        select: {
          id: true,
          userId: true,
          styleBible: true,
          aspectRatio: true,
        },
      },
    },
  });

  if (!shot || shot.movie.userId !== userId) {
    return NextResponse.json(
      { success: false, error: "Shot not found" },
      { status: 404 }
    );
  }

  // Fetch characters for the movie
  const characters = await db.character.findMany({
    where: { movieId: shot.movie.id },
    select: {
      id: true,
      name: true,
      visualDescription: true,
      klingElementId: true,
    },
  });

  // Check credits
  const creditCost = getCreditCost(input.quality, shot.durationSeconds);
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { creditsBalance: true },
  });

  if (!user || user.creditsBalance < creditCost) {
    return NextResponse.json(
      {
        success: false,
        error: `Insufficient credits. Need ${creditCost}, have ${user?.creditsBalance ?? 0}`,
      },
      { status: 402 }
    );
  }

  // Build the prompt — prefer user-edited stored prompt when available
  const styleBible = shot.movie.styleBible as StyleBible | null;
  const hasDialogue = !!(shot.dialogue as { line?: string } | null)?.line;
  const shouldIncludeDialogue = input.generateAudio && hasDialogue;

  // Use stored prompt if it exists AND (no dialogue to strip OR audio is on).
  // If the shot has dialogue but audio is off, we must re-assemble to exclude
  // the dialogue formatting that the planner always includes.
  const useStoredPrompt = !!shot.generatedPrompt && (!hasDialogue || input.generateAudio);

  let finalPrompt: string;
  if (useStoredPrompt) {
    finalPrompt = shot.generatedPrompt!;
  } else {
    const promptShot = {
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
    };
    finalPrompt = assemblePrompt(promptShot, characters, styleBible);
  }

  const negativePrompt = shot.negativePrompt || formatNegativePrompt(styleBible);

  // Mark shot as generating — always write the final prompt for audit trail
  await db.shot.update({
    where: { id: shot.id },
    data: {
      status: "GENERATING",
      generatedPrompt: finalPrompt,
      negativePrompt: negativePrompt,
    },
  });

  // Deduct credits atomically
  await db.$transaction([
    db.user.update({
      where: { id: userId },
      data: { creditsBalance: { decrement: creditCost } },
    }),
    db.creditLedger.create({
      data: {
        userId,
        amount: -creditCost,
        type: "USAGE",
        movieId: shot.movie.id,
        shotId: shot.id,
        memo: `Video generation: ${input.quality} ${shot.durationSeconds}s (${isDryRunMode() ? "dry-run" : "live"})`,
      },
    }),
  ]);

  // Continuity chaining: use previous shot's last frame as start image
  let startImageUrl: string | undefined;
  if (shot.order > 0) {
    const prevShot = await db.shot.findFirst({
      where: {
        movieId: shot.movieId,
        order: shot.order - 1,
        status: "COMPLETE",
      },
      select: {
        endFrameUrl: true,
        takes: {
          where: { isHero: true },
          select: { videoUrl: true },
          take: 1,
        },
      },
    });

    // Prefer stored end frame URL, otherwise extract from hero take
    if (prevShot?.endFrameUrl) {
      startImageUrl = prevShot.endFrameUrl;
    } else if (prevShot?.takes?.[0]?.videoUrl) {
      const frameUrl = await extractLastFrame(prevShot.takes[0].videoUrl);
      if (frameUrl) {
        startImageUrl = frameUrl;
        // Cache it on the shot for future use
        await db.shot.updateMany({
          where: {
            movieId: shot.movieId,
            order: shot.order - 1,
          },
          data: { endFrameUrl: frameUrl },
        });
      }
    }
  }

  // Use character reference images for image-to-video when no continuity frame
  // This ensures the character from the uploaded photo appears in the video
  if (!startImageUrl && input.characterReferenceImages?.length) {
    startImageUrl = input.characterReferenceImages[0];
  }

  // Fallback: check DB for any character with reference images
  if (!startImageUrl) {
    const charWithRef = await db.character.findFirst({
      where: {
        movieId: shot.movie.id,
        referenceImages: { isEmpty: false },
      },
      select: { referenceImages: true },
    });
    if (charWithRef?.referenceImages?.[0]) {
      startImageUrl = charWithRef.referenceImages[0];
    }
  }

  // Generate the video
  try {
    const result = await generateVideo({
      prompt: finalPrompt,
      negativePrompt,
      duration: shot.durationSeconds,
      aspectRatio: (shot.movie.aspectRatio as "16:9" | "9:16" | "1:1") ?? "16:9",
      quality: input.quality,
      generateAudio: input.generateAudio,
      startImageUrl,
    });

    // Create a Take record
    const take = await db.take.create({
      data: {
        shotId: shot.id,
        videoUrl: result.videoUrl,
        isHero: true, // first take is auto-hero
        generationParams: {
          prompt: finalPrompt,
          negativePrompt,
          quality: input.quality,
          duration: shot.durationSeconds,
          dryRun: result.isDryRun,
          generationTimeMs: result.durationMs,
        },
      },
    });

    // Extract end frame for continuity chaining to the next shot
    const endFrameUrl = await extractLastFrame(result.videoUrl);

    // Mark shot as complete and cache the end frame
    await db.shot.update({
      where: { id: shot.id },
      data: {
        status: "COMPLETE",
        endFrameUrl: endFrameUrl ?? undefined,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        take,
        creditCost,
        isDryRun: result.isDryRun,
        generationTimeMs: result.durationMs,
        continuityChained: !!startImageUrl,
      },
    });
  } catch (error) {
    const err = error as { status?: number; body?: unknown; message?: string };
    console.error("Generation failed:", {
      message: err.message,
      status: err.status,
      body: JSON.stringify(err.body, null, 2),
    });

    // Mark shot as failed
    await db.shot.update({
      where: { id: shot.id },
      data: { status: "FAILED" },
    });

    // Refund credits
    await db.$transaction([
      db.user.update({
        where: { id: userId },
        data: { creditsBalance: { increment: creditCost } },
      }),
      db.creditLedger.create({
        data: {
          userId,
          amount: creditCost,
          type: "REFUND",
          movieId: shot.movie.id,
          shotId: shot.id,
          memo: `Refund: generation failed for ${input.quality} ${shot.durationSeconds}s`,
        },
      }),
    ]);

    return NextResponse.json(
      { success: false, error: "Video generation failed", refunded: true },
      { status: 500 }
    );
  }
}

// ─── Batch generation ──────────────────────────────────────────

async function handleBatch(
  userId: string,
  input: { movieId: string; quality: QualityTier; generateAudio: boolean }
) {
  // Fetch all draft shots for the movie
  const movie = await db.movie.findFirst({
    where: { id: input.movieId, userId },
    select: { id: true },
  });

  if (!movie) {
    return NextResponse.json(
      { success: false, error: "Movie not found" },
      { status: 404 }
    );
  }

  const shots = await db.shot.findMany({
    where: {
      movieId: input.movieId,
      status: { in: ["DRAFT", "FAILED"] },
    },
    orderBy: { order: "asc" },
    select: { id: true, durationSeconds: true },
  });

  if (shots.length === 0) {
    return NextResponse.json(
      { success: false, error: "No shots to generate" },
      { status: 400 }
    );
  }

  // Calculate total cost
  const totalCost = shots.reduce(
    (sum, s) => sum + getCreditCost(input.quality, s.durationSeconds),
    0
  );

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { creditsBalance: true },
  });

  if (!user || user.creditsBalance < totalCost) {
    return NextResponse.json(
      {
        success: false,
        error: `Insufficient credits. Need ${totalCost}, have ${user?.creditsBalance ?? 0}`,
        totalCost,
        shotCount: shots.length,
      },
      { status: 402 }
    );
  }

  // Return the batch info — actual generation is triggered per-shot from the frontend
  // This avoids long-running API requests and gives the UI control over sequencing
  return NextResponse.json({
    success: true,
    data: {
      shotIds: shots.map((s) => s.id),
      shotCount: shots.length,
      totalCost,
      perShotCosts: shots.map((s) => ({
        shotId: s.id,
        cost: getCreditCost(input.quality, s.durationSeconds),
      })),
      isDryRun: isDryRunMode(),
    },
  });
}

// ─── GET: Check generation status ──────────────────────────────

export async function GET(req: NextRequest) {
  const userId = await ensureUser();

  const movieId = req.nextUrl.searchParams.get("movieId");
  if (!movieId) {
    return NextResponse.json(
      { success: false, error: "movieId required" },
      { status: 400 }
    );
  }

  const shots = await db.shot.findMany({
    where: { movieId },
    orderBy: { order: "asc" },
    include: {
      takes: {
        select: {
          id: true,
          videoUrl: true,
          thumbnailUrl: true,
          isHero: true,
          qualityScore: true,
          generationParams: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  const summary = {
    total: shots.length,
    draft: shots.filter((s) => s.status === "DRAFT").length,
    generating: shots.filter((s) => s.status === "GENERATING").length,
    complete: shots.filter((s) => s.status === "COMPLETE").length,
    failed: shots.filter((s) => s.status === "FAILED").length,
  };

  return NextResponse.json({
    success: true,
    data: { shots, summary, isDryRun: isDryRunMode() },
  });
}
