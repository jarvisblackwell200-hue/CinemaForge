import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import { db } from "@/lib/db";
import { ensureUser } from "@/lib/auth";
import { assembleMovie } from "@/lib/video/assembler";
import type { AssemblyTransition } from "@/lib/video/assembler";
import { CREDIT_COSTS } from "@/lib/constants/pricing";

// ─── Validation ────────────────────────────────────────────────

const TransitionSchema = z.object({
  type: z.enum(["cut", "crossfade", "fade-black"]),
  durationMs: z.number().min(0).max(3000).default(500),
});

const AssembleSchema = z.object({
  movieId: z.string(),
  transitions: z.array(TransitionSchema).optional(),
});

// ─── POST: Assemble a movie from hero takes ────────────────────

export async function POST(req: NextRequest) {
  try {
    const userId = await ensureUser();

    const body = await req.json();
    const parsed = AssembleSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: z.prettifyError(parsed.error) },
        { status: 400 },
      );
    }

    const { movieId, transitions: inputTransitions } = parsed.data;

    // Verify movie ownership
    const movie = await db.movie.findFirst({
      where: { id: movieId, userId },
      select: { id: true, title: true },
    });

    if (!movie) {
      return NextResponse.json(
        { success: false, error: "Movie not found" },
        { status: 404 },
      );
    }

    // Get all shots with hero takes, ordered
    const shots = await db.shot.findMany({
      where: {
        movieId,
        status: "COMPLETE",
      },
      orderBy: { order: "asc" },
      select: {
        id: true,
        order: true,
        durationSeconds: true,
        takes: {
          where: { isHero: true },
          select: { videoUrl: true },
          take: 1,
        },
      },
    });

    // Filter to shots that have a hero take with a video URL
    const validShots = shots.filter(
      (s) => s.takes.length > 0 && s.takes[0].videoUrl,
    );

    if (validShots.length === 0) {
      return NextResponse.json(
        { success: false, error: "No completed shots with hero takes found" },
        { status: 400 },
      );
    }

    // Check credits
    const creditCost = CREDIT_COSTS.ASSEMBLY_EXPORT;
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
        { status: 402 },
      );
    }

    // Deduct credits
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
          movieId,
          memo: `Movie assembly: ${validShots.length} shots`,
        },
      }),
    ]);

    // Update movie status
    await db.movie.update({
      where: { id: movieId },
      data: { status: "ASSEMBLING" },
    });

    // Build clips and transitions
    const clips = validShots.map((s) => ({
      videoUrl: s.takes[0].videoUrl,
      durationSeconds: s.durationSeconds,
    }));

    const transitions: AssemblyTransition[] | undefined = inputTransitions?.slice(
      0,
      validShots.length - 1,
    );

    try {
      const result = await assembleMovie({
        clips,
        transitions,
        outputName: movie.title.replace(/[^a-zA-Z0-9-_]/g, "-").toLowerCase(),
      });

      // Create or update timeline record
      await db.timeline.upsert({
        where: { movieId },
        create: {
          movieId,
          orderedShotIds: validShots.map((s) => s.id),
          transitions: inputTransitions ?? null,
          exportedUrl: result.videoUrl,
        },
        update: {
          orderedShotIds: validShots.map((s) => s.id),
          transitions: inputTransitions ?? null,
          exportedUrl: result.videoUrl,
        },
      });

      // Update movie status
      await db.movie.update({
        where: { id: movieId },
        data: { status: "COMPLETE" },
      });

      return NextResponse.json({
        success: true,
        data: {
          videoUrl: result.videoUrl,
          fileSize: result.fileSize,
          durationSeconds: result.durationSeconds,
          shotCount: validShots.length,
          creditCost,
        },
      });
    } catch (error) {
      console.error("Assembly failed:", error);

      // Revert movie status
      await db.movie.update({
        where: { id: movieId },
        data: { status: "GENERATING" },
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
            movieId,
            memo: "Refund: movie assembly failed",
          },
        }),
      ]);

      return NextResponse.json(
        { success: false, error: "Assembly failed", refunded: true },
        { status: 500 },
      );
    }
  } catch (error) {
    console.error("Assemble error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
