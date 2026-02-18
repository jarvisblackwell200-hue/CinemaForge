import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { MovieStatus } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { ensureUser } from "@/lib/auth";

const UpdateMovieSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  synopsis: z.string().optional(),
  genre: z.string().optional(),
  targetDuration: z.number().int().min(30).max(180).optional(),
  aspectRatio: z.enum(["16:9", "9:16", "1:1", "21:9"]).optional(),
  status: z
    .enum([
      "CONCEPT",
      "SCRIPTING",
      "CHARACTERS",
      "STORYBOARDING",
      "GENERATING",
      "ASSEMBLING",
      "COMPLETE",
    ])
    .optional(),
  styleBible: z.any().optional(),
  script: z.any().optional(),
  conceptChat: z.any().optional(),
});

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ movieId: string }> }
) {
  try {
    const { movieId } = await params;
    const userId = await ensureUser();

    const movie = await db.movie.findFirst({
      where: { id: movieId, userId },
      include: {
        characters: {
          select: {
            id: true,
            name: true,
            role: true,
            visualDescription: true,
            referenceImages: true,
            createdAt: true,
          },
        },
        shots: {
          select: {
            id: true,
            sceneIndex: true,
            order: true,
            shotType: true,
            cameraMovement: true,
            subject: true,
            durationSeconds: true,
            status: true,
          },
          orderBy: { order: "asc" },
        },
        timeline: true,
        _count: { select: { shots: true, characters: true } },
      },
    });

    if (!movie) {
      return NextResponse.json(
        { success: false, error: "Movie not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: movie });
  } catch (error) {
    console.error("Failed to get movie:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ movieId: string }> }
) {
  let step = "init";
  let body: Record<string, unknown> = {};
  try {
    step = "params";
    const { movieId } = await params;

    step = "auth";
    const userId = await ensureUser();

    step = "find";
    const existing = await db.movie.findFirst({
      where: { id: movieId, userId },
      select: { id: true },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Movie not found" },
        { status: 404 }
      );
    }

    step = "parse-body";
    body = await req.json();

    step = "validate";
    const parsed = UpdateMovieSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: z.prettifyError(parsed.error) },
        { status: 400 }
      );
    }

    step = "build-update";
    const { status, ...rest } = parsed.data;
    const updateData = {
      ...rest,
      ...(status !== undefined && { status: status as MovieStatus }),
    };

    step = "db-update";
    const movie = await db.movie.update({
      where: { id: movieId },
      data: updateData,
      select: {
        id: true,
        title: true,
        genre: true,
        synopsis: true,
        status: true,
        targetDuration: true,
        styleBible: true,
        script: true,
        conceptChat: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ success: true, data: movie });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;
    console.error(`[PATCH /movies] FAILED at step="${step}":`, message);
    if (stack) console.error(stack);
    console.error("[PATCH /movies] body keys:", Object.keys(body));
    return NextResponse.json(
      { success: false, error: message, step },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ movieId: string }> }
) {
  try {
    const { movieId } = await params;
    const userId = await ensureUser();

    const existing = await db.movie.findFirst({
      where: { id: movieId, userId },
      select: { id: true },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Movie not found" },
        { status: 404 }
      );
    }

    await db.movie.delete({ where: { id: movieId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete movie:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
