import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { ensureUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { CREDIT_COSTS } from "@/lib/constants/pricing";
import type { Prisma } from "@/generated/prisma/client";
import { deductCredits, refundCredits } from "@/lib/credits";
import { generateScenePack, getScenePackImageCount } from "@/lib/scene-packs/generator";
import type { ScenePack, Script, StyleBible } from "@/types/movie";

// ─── POST — Generate scene pack(s) ─────────────────────────────

const PostSchema = z.object({
  movieId: z.string().min(1),
  sceneIndex: z.number().int().min(0).optional(),
});

export async function POST(req: Request) {
  try {
    const userId = await ensureUser();

    const body = await req.json();
    const parsed = PostSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: z.prettifyError(parsed.error) },
        { status: 400 },
      );
    }

    const { movieId, sceneIndex } = parsed.data;

    // Fetch movie with script + style bible
    const movie = await db.movie.findFirst({
      where: { id: movieId, userId },
      select: {
        id: true,
        script: true,
        styleBible: true,
        aspectRatio: true,
        scenePacks: true,
        shots: {
          select: { sceneIndex: true, environment: true },
          orderBy: { order: "asc" },
        },
      },
    });

    if (!movie) {
      return NextResponse.json(
        { success: false, error: "Movie not found" },
        { status: 404 },
      );
    }

    const script = movie.script as Script | null;
    if (!script?.scenes?.length) {
      return NextResponse.json(
        { success: false, error: "Movie has no script scenes" },
        { status: 400 },
      );
    }

    const styleBible = movie.styleBible as StyleBible | null;
    const existingPacks = (movie.scenePacks as ScenePack[] | null) ?? [];
    const aspectRatio = movie.aspectRatio === "9:16" ? "9:16" : "16:9";

    // Determine which scenes to generate
    const scenesToGenerate = sceneIndex !== undefined
      ? [sceneIndex]
      : script.scenes.map((_, i) => i);

    // Validate scene indices
    for (const idx of scenesToGenerate) {
      if (idx >= script.scenes.length) {
        return NextResponse.json(
          { success: false, error: `Scene index ${idx} out of range (${script.scenes.length} scenes)` },
          { status: 400 },
        );
      }
    }

    // Calculate total credit cost
    const costPerImage = CREDIT_COSTS.SCENE_PACK_IMAGE;
    let totalImages = 0;
    for (const idx of scenesToGenerate) {
      totalImages += getScenePackImageCount(script.scenes[idx]);
    }
    const totalCost = totalImages * costPerImage;

    // Deduct credits upfront
    const newBalance = await deductCredits({
      userId,
      amount: totalCost,
      type: "USAGE",
      movieId,
      memo: `Scene pack generation (${scenesToGenerate.length} scene${scenesToGenerate.length !== 1 ? "s" : ""}, ${totalImages} images)`,
    });

    if (newBalance === null) {
      return NextResponse.json(
        { success: false, error: `Insufficient credits. Need ${totalCost} credits.` },
        { status: 402 },
      );
    }

    // Group shot environments by scene
    const envByScene = new Map<number, string[]>();
    for (const shot of movie.shots) {
      const envs = envByScene.get(shot.sceneIndex) ?? [];
      if (shot.environment) envs.push(shot.environment);
      envByScene.set(shot.sceneIndex, envs);
    }

    // Generate packs
    const updatedPacks = [...existingPacks];
    let failedImages = 0;

    for (const idx of scenesToGenerate) {
      const scene = script.scenes[idx];

      const pack = await generateScenePack({
        sceneIndex: idx,
        scene,
        styleBible,
        aspectRatio,
        shotEnvironments: envByScene.get(idx) ?? [],
      });

      // Count failed images for refund
      failedImages += pack.images.filter((img) => img.status === "failed").length;

      // Replace or append pack
      const existingIdx = updatedPacks.findIndex((p) => p.sceneIndex === idx);
      if (existingIdx >= 0) {
        updatedPacks[existingIdx] = pack;
      } else {
        updatedPacks.push(pack);
      }
    }

    // Sort packs by scene index
    updatedPacks.sort((a, b) => a.sceneIndex - b.sceneIndex);

    // Persist to movie
    await db.movie.update({
      where: { id: movieId },
      data: { scenePacks: updatedPacks as unknown as Prisma.InputJsonValue },
    });

    // Refund credits for failed images
    if (failedImages > 0) {
      const refundAmount = failedImages * costPerImage;
      await refundCredits({
        userId,
        amount: refundAmount,
        movieId,
        memo: `Refund: ${failedImages} scene pack image${failedImages !== 1 ? "s" : ""} failed`,
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        scenePacks: updatedPacks,
        imagesGenerated: totalImages - failedImages,
        imagesFailed: failedImages,
        creditsUsed: (totalImages - failedImages) * costPerImage,
      },
    });
  } catch (error) {
    console.error("[scene-packs] POST error:", error);
    return NextResponse.json(
      { success: false, error: "Scene pack generation failed" },
      { status: 500 },
    );
  }
}

// ─── GET — Fetch current scene packs ────────────────────────────

export async function GET(req: Request) {
  try {
    const userId = await ensureUser();

    const { searchParams } = new URL(req.url);
    const movieId = searchParams.get("movieId");
    if (!movieId) {
      return NextResponse.json(
        { success: false, error: "movieId is required" },
        { status: 400 },
      );
    }

    const movie = await db.movie.findFirst({
      where: { id: movieId, userId },
      select: { scenePacks: true },
    });

    if (!movie) {
      return NextResponse.json(
        { success: false, error: "Movie not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      data: (movie.scenePacks as ScenePack[] | null) ?? [],
    });
  } catch (error) {
    console.error("[scene-packs] GET error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch scene packs" },
      { status: 500 },
    );
  }
}

// ─── DELETE — Remove a scene pack (to regenerate) ───────────────

const DeleteSchema = z.object({
  movieId: z.string().min(1),
  sceneIndex: z.number().int().min(0),
});

export async function DELETE(req: Request) {
  try {
    const userId = await ensureUser();

    const body = await req.json();
    const parsed = DeleteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: z.prettifyError(parsed.error) },
        { status: 400 },
      );
    }

    const { movieId, sceneIndex } = parsed.data;

    const movie = await db.movie.findFirst({
      where: { id: movieId, userId },
      select: { scenePacks: true },
    });

    if (!movie) {
      return NextResponse.json(
        { success: false, error: "Movie not found" },
        { status: 404 },
      );
    }

    const packs = (movie.scenePacks as ScenePack[] | null) ?? [];
    const updatedPacks = packs.filter((p) => p.sceneIndex !== sceneIndex);

    await db.movie.update({
      where: { id: movieId },
      data: { scenePacks: updatedPacks as unknown as Prisma.InputJsonValue },
    });

    return NextResponse.json({
      success: true,
      data: updatedPacks,
    });
  } catch (error) {
    console.error("[scene-packs] DELETE error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete scene pack" },
      { status: 500 },
    );
  }
}
