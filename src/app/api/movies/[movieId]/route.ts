import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import { type Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";

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
  styleBible: z.any().optional() as z.ZodOptional<z.ZodType<Prisma.InputJsonValue>>,
  script: z.any().optional() as z.ZodOptional<z.ZodType<Prisma.InputJsonValue>>,
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ movieId: string }> }
) {
  try {
    const { movieId } = await params;
    const userId = _req.headers.get("x-user-id");
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

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
  req: NextRequest,
  { params }: { params: Promise<{ movieId: string }> }
) {
  try {
    const { movieId } = await params;
    const userId = req.headers.get("x-user-id");
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

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

    const body = await req.json();
    const parsed = UpdateMovieSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: z.prettifyError(parsed.error) },
        { status: 400 }
      );
    }

    const movie = await db.movie.update({
      where: { id: movieId },
      data: parsed.data,
      select: {
        id: true,
        title: true,
        genre: true,
        synopsis: true,
        status: true,
        targetDuration: true,
        styleBible: true,
        script: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ success: true, data: movie });
  } catch (error) {
    console.error("Failed to update movie:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ movieId: string }> }
) {
  try {
    const { movieId } = await params;
    const userId = req.headers.get("x-user-id");
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

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
