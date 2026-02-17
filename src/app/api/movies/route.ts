import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { db } from "@/lib/db";
import { ensureUser } from "@/lib/auth";

const CreateMovieSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  genre: z.string().optional(),
  targetDuration: z.number().int().min(30).max(180).optional(),
  aspectRatio: z.enum(["16:9", "9:16", "1:1", "21:9"]).optional(),
});

export async function POST(req: Request) {
  try {
    const userId = await ensureUser();

    const body = await req.json();
    const parsed = CreateMovieSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: z.prettifyError(parsed.error) },
        { status: 400 }
      );
    }

    const movie = await db.movie.create({
      data: {
        userId,
        title: parsed.data.title,
        genre: parsed.data.genre,
        targetDuration: parsed.data.targetDuration ?? 60,
        aspectRatio: parsed.data.aspectRatio ?? "16:9",
      },
      select: {
        id: true,
        title: true,
        genre: true,
        status: true,
        targetDuration: true,
        aspectRatio: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ success: true, data: movie }, { status: 201 });
  } catch (error) {
    console.error("Failed to create movie:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const userId = await ensureUser();

    const movies = await db.movie.findMany({
      where: { userId },
      select: {
        id: true,
        title: true,
        genre: true,
        status: true,
        targetDuration: true,
        synopsis: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { shots: true, characters: true } },
      },
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json({ success: true, data: movies });
  } catch (error) {
    console.error("Failed to list movies:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
