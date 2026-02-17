import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import { db } from "@/lib/db";
import { generateVideo, isDryRunMode } from "@/lib/kling/client";
import { assemblePrompt, formatNegativePrompt } from "@/lib/kling/prompts";
import { getCreditCost } from "@/lib/constants/pricing";
import type { QualityTier } from "@/lib/kling/types";
import type { StyleBible } from "@/types/movie";

// ─── Validation ────────────────────────────────────────────────

const GenerateSchema = z.object({
  shotId: z.string(),
  quality: z.enum(["draft", "standard", "cinema"]).default("draft"),
  generateAudio: z.boolean().default(false),
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
    const userId = req.headers.get("x-user-id");
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

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
  input: { shotId: string; quality: QualityTier; generateAudio: boolean }
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

  // Assemble the prompt
  const styleBible = shot.movie.styleBible as StyleBible | null;
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
  };

  const assembledPrompt = assemblePrompt(promptShot, characters, styleBible);
  const negativePrompt = formatNegativePrompt(styleBible);

  // Mark shot as generating
  await db.shot.update({
    where: { id: shot.id },
    data: {
      status: "GENERATING",
      generatedPrompt: assembledPrompt,
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

  // Get the previous shot's hero take for continuity chaining
  let startImageUrl: string | undefined;
  if (shot.order > 0) {
    const prevShot = await db.shot.findFirst({
      where: {
        movieId: shot.movieId,
        order: shot.order - 1,
        status: "COMPLETE",
      },
      include: {
        takes: {
          where: { isHero: true },
          select: { videoUrl: true },
          take: 1,
        },
      },
    });
    // In the future, extract last frame from the hero take
    // For now, continuity chaining is a placeholder
    if (prevShot?.takes?.[0]?.videoUrl) {
      // TODO: extract last frame and use as startImageUrl
    }
  }

  // Generate the video
  try {
    const result = await generateVideo({
      prompt: assembledPrompt,
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
          prompt: assembledPrompt,
          negativePrompt,
          quality: input.quality,
          duration: shot.durationSeconds,
          dryRun: result.isDryRun,
          generationTimeMs: result.durationMs,
        },
      },
    });

    // Mark shot as complete
    await db.shot.update({
      where: { id: shot.id },
      data: { status: "COMPLETE" },
    });

    return NextResponse.json({
      success: true,
      data: {
        take,
        creditCost,
        isDryRun: result.isDryRun,
        generationTimeMs: result.durationMs,
      },
    });
  } catch (error) {
    console.error("Generation failed:", error);

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
  const userId = req.headers.get("x-user-id");
  if (!userId) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

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
