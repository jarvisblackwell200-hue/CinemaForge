import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import { db } from "@/lib/db";

const CreateCharacterSchema = z.object({
  movieId: z.string(),
  name: z.string().min(1, "Name is required"),
  role: z.enum(["protagonist", "antagonist", "supporting", "background"]).optional(),
  visualDescription: z
    .string()
    .min(20, "Visual description must be at least 20 characters for consistent generation"),
  referenceImages: z.array(z.string()).optional(),
  voiceProfile: z
    .object({
      language: z.string(),
      accent: z.string(),
      tone: z.string(),
      speed: z.enum(["slow", "normal", "fast"]),
    })
    .optional(),
  styleBibleEntry: z.string().optional(),
});

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
    const parsed = CreateCharacterSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: z.prettifyError(parsed.error) },
        { status: 400 }
      );
    }

    // Verify movie ownership
    const movie = await db.movie.findFirst({
      where: { id: parsed.data.movieId, userId },
      select: { id: true },
    });

    if (!movie) {
      return NextResponse.json(
        { success: false, error: "Movie not found" },
        { status: 404 }
      );
    }

    const character = await db.character.create({
      data: {
        movieId: parsed.data.movieId,
        name: parsed.data.name,
        role: parsed.data.role,
        visualDescription: parsed.data.visualDescription,
        referenceImages: parsed.data.referenceImages ?? [],
        voiceProfile: parsed.data.voiceProfile ?? undefined,
        styleBibleEntry: parsed.data.styleBibleEntry,
      },
    });

    return NextResponse.json(
      { success: true, data: character },
      { status: 201 }
    );
  } catch (error) {
    console.error("Failed to create character:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
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
        { success: false, error: "movieId is required" },
        { status: 400 }
      );
    }

    // Verify movie ownership
    const movie = await db.movie.findFirst({
      where: { id: movieId, userId },
      select: { id: true },
    });

    if (!movie) {
      return NextResponse.json(
        { success: false, error: "Movie not found" },
        { status: 404 }
      );
    }

    const characters = await db.character.findMany({
      where: { movieId },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({ success: true, data: characters });
  } catch (error) {
    console.error("Failed to list characters:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
